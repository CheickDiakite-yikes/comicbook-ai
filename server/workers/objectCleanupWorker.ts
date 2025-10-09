import { Bucket } from "@google-cloud/storage";
import {
  ObjectStorageService,
  objectStorageClient,
  parseBucketAndPrefix,
  LIFECYCLE_METADATA_KEY,
  VARIANT_METADATA_KEY,
  DEFAULT_LIFECYCLE_TAG,
  DEFAULT_VARIANT_TAG,
} from "../objectStorage";
import { logger } from "../logger";

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = Number(process.env.NON_CANONICAL_RETENTION_DAYS ?? "90");
const DEFAULT_INTERVAL_MS = Number(
  process.env.NON_CANONICAL_CLEANUP_INTERVAL_MS ?? (6 * 60 * 60 * 1000),
);
const NON_CANONICAL_VARIANT = DEFAULT_VARIANT_TAG;

function coerceDate(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export class ObjectCleanupWorker {
  private timer?: NodeJS.Timeout;
  private readonly retentionMs: number;

  constructor(
    private readonly storageService: ObjectStorageService = new ObjectStorageService(),
    private readonly retentionDays: number = DEFAULT_RETENTION_DAYS,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {
    this.retentionMs = Math.max(1, retentionDays) * MS_IN_DAY;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.run().catch((error) => {
        logger.error("Failed to execute non-canonical cleanup cycle", error as Error, {
          component: "object-cleanup-worker",
        });
      });
    }, this.intervalMs);

    void this.run();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async run(): Promise<void> {
    const cutoff = Date.now() - this.retentionMs;
    if (cutoff <= 0) {
      return;
    }

    const privateDir = this.storageService.getPrivateObjectDir();
    const { bucketName, prefix } = parseBucketAndPrefix(privateDir);
    const bucket = objectStorageClient.bucket(bucketName);
    const cleanupPrefixes = [
      `${prefix}uploads/`,
      `${prefix}variants/`,
    ];

    let deletedCount = 0;
    for (const cleanupPrefix of cleanupPrefixes) {
      deletedCount += await this.cleanupPrefix(bucket, cleanupPrefix, cutoff);
    }

    if (deletedCount > 0) {
      logger.info("Purged expired non-canonical assets", {
        deletedCount,
        cutoff: new Date(cutoff).toISOString(),
      });
    }
  }

  private async cleanupPrefix(bucket: Bucket, prefix: string, cutoff: number): Promise<number> {
    try {
      const [files] = await bucket.getFiles({ prefix });
      let removed = 0;

      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          const variantType = metadata.metadata?.[VARIANT_METADATA_KEY];
          const lifecyclePolicy = metadata.metadata?.[LIFECYCLE_METADATA_KEY];

          if (variantType !== NON_CANONICAL_VARIANT) {
            continue;
          }

          if (lifecyclePolicy && lifecyclePolicy !== DEFAULT_LIFECYCLE_TAG) {
            continue;
          }

          const createdAt = coerceDate(metadata.timeCreated) ?? coerceDate(metadata.updated);
          if (!createdAt || createdAt >= cutoff) {
            continue;
          }

          await file.delete();
          removed += 1;
          logger.debug("Deleted expired non-canonical object", {
            objectName: file.name,
            createdAt: new Date(createdAt).toISOString(),
            cutoff: new Date(cutoff).toISOString(),
          });
        } catch (error) {
          logger.warn("Failed to inspect object for cleanup", {
            objectName: file.name,
            prefix,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return removed;
    } catch (error) {
      logger.error("Failed to list objects for cleanup", error as Error, {
        prefix,
      });
      return 0;
    }
  }
}

export function startObjectCleanupWorker() {
  const worker = new ObjectCleanupWorker();
  worker.start();
  return worker;
}
