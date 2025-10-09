import {
  GoogleGenAI,
  type GenerateVideosConfig,
  type GenerateVideosOperation,
  type GenerateVideosParameters,
  type GeneratedVideo,
} from "@google/genai";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  type InferModel,
} from "drizzle-orm";
import { db } from "../db";
import {
  panelVideoRequests,
  panelVideoVersions,
  type PanelVideoRequest,
  type PanelVideoVersion,
} from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { AppLogger, logger as appLogger } from "../logger";
import { randomUUID } from "crypto";

type GoogleGenAiInstance = InstanceType<typeof GoogleGenAI>;
type GoogleModelsClient = GoogleGenAiInstance["models"];
type GoogleOperationsClient = GoogleGenAiInstance["operations"];

const JOB_STATUSES = ["queued", "processing", "succeeded", "failed"] as const;
export type Veo3JobStatus = (typeof JOB_STATUSES)[number];

export type PanelVideoRequestRecord = PanelVideoRequest;
export type NewPanelVideoRequestRecord = InferModel<typeof panelVideoRequests, "insert">;
export type PanelVideoVersionRecord = PanelVideoVersion;
export type NewPanelVideoVersionRecord = InferModel<typeof panelVideoVersions, "insert">;

type StoredGenerateVideosPayload = Pick<GenerateVideosParameters, "source" | "config">;

export type Veo3ModelKey = "veo-3.0" | "veo-3.0-lite";

interface ResolvedModelConfig {
  model: string;
  version: string;
  defaultConfig?: Partial<GenerateVideosConfig>;
}

interface Veo3ModelVersionConfig {
  version: string;
  defaultConfig?: Partial<GenerateVideosConfig>;
}

const MODEL_VERSION_CONFIG: Record<
  Veo3ModelKey,
  {
    model: string;
    defaultVersion: string;
    versions: Record<string, Veo3ModelVersionConfig>;
  }
> = {
  "veo-3.0": {
    model: "veo-3.0",
    defaultVersion: "quality",
    versions: {
      quality: {
        version: "quality",
        defaultConfig: {
          resolution: "1080p",
          aspectRatio: "16:9",
          fps: 24,
          durationSeconds: 8,
        },
      },
      standard: {
        version: "standard",
        defaultConfig: {
          resolution: "720p",
          aspectRatio: "16:9",
          fps: 24,
          durationSeconds: 6,
        },
      },
      social: {
        version: "social",
        defaultConfig: {
          resolution: "720p",
          aspectRatio: "9:16",
          fps: 24,
          durationSeconds: 6,
        },
      },
    },
  },
  "veo-3.0-lite": {
    model: "veo-3.0-lite",
    defaultVersion: "fast",
    versions: {
      fast: {
        version: "fast",
        defaultConfig: {
          resolution: "720p",
          aspectRatio: "16:9",
          fps: 20,
          durationSeconds: 4,
        },
      },
      storyboard: {
        version: "storyboard",
        defaultConfig: {
          resolution: "720p",
          aspectRatio: "1:1",
          fps: 12,
          durationSeconds: 4,
        },
      },
    },
  },
};

export interface CreateVeo3JobOptions {
  panelId: string;
  prompt?: string;
  model?: Veo3ModelKey;
  version?: string;
  source?: GenerateVideosParameters["source"];
  config?: GenerateVideosConfig;
  maxRetries?: number;
}

interface Veo3JobServiceOptions {
  defaultModel: Veo3ModelKey;
  defaultMaxRetries: number;
  initialPollDelayMs: number;
  pendingPollIntervalMs: number;
  retryBaseDelayMs: number;
  maxPollIntervalMs: number;
  pollBatchSize: number;
}

const DEFAULT_OPTIONS: Veo3JobServiceOptions = {
  defaultModel: "veo-3.0",
  defaultMaxRetries: 3,
  initialPollDelayMs: 5_000,
  pendingPollIntervalMs: 10_000,
  retryBaseDelayMs: 5_000,
  maxPollIntervalMs: 60_000,
  pollBatchSize: 10,
};

type Veo3ModelsClient = Pick<GoogleModelsClient, "generateVideos">;
type Veo3OperationsClient = Pick<GoogleOperationsClient, "getVideosOperation">;

interface Veo3GenAiClient {
  models: Veo3ModelsClient;
  operations: Veo3OperationsClient;
}

export interface Veo3JobRepository {
  createRequest(values: NewPanelVideoRequestRecord): Promise<PanelVideoRequestRecord>;
  updateRequest(
    id: string,
    updates: Partial<Omit<PanelVideoRequestRecord, "id" | "panelId" | "createdAt">>,
  ): Promise<PanelVideoRequestRecord | undefined>;
  findPollableRequests(now: Date, limit: number): Promise<PanelVideoRequestRecord[]>;
  createVersion(values: NewPanelVideoVersionRecord): Promise<PanelVideoVersionRecord>;
}

class DrizzleVeo3JobRepository implements Veo3JobRepository {
  async createRequest(values: NewPanelVideoRequestRecord): Promise<PanelVideoRequestRecord> {
    const now = new Date();
    const payload: NewPanelVideoRequestRecord = {
      createdAt: now,
      updatedAt: now,
      status: "queued",
      retryCount: 0,
      maxRetries: DEFAULT_OPTIONS.defaultMaxRetries,
      ...values,
    };
    const [record] = await db.insert(panelVideoRequests).values(payload).returning();
    return record;
  }

  async updateRequest(
    id: string,
    updates: Partial<Omit<PanelVideoRequestRecord, "id" | "panelId" | "createdAt">>,
  ): Promise<PanelVideoRequestRecord | undefined> {
    const [record] = await db
      .update(panelVideoRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(panelVideoRequests.id, id))
      .returning();

    return record;
  }

  async findPollableRequests(now: Date, limit: number): Promise<PanelVideoRequestRecord[]> {
    const statuses: Veo3JobStatus[] = ["queued", "processing"];
    return db
      .select()
      .from(panelVideoRequests)
      .where(
        and(
          inArray(panelVideoRequests.status, statuses),
          or(isNull(panelVideoRequests.nextPollAt), lte(panelVideoRequests.nextPollAt, now)),
        ),
      )
      .orderBy(asc(panelVideoRequests.createdAt))
      .limit(limit);
  }

  async createVersion(values: NewPanelVideoVersionRecord): Promise<PanelVideoVersionRecord> {
    const payload: NewPanelVideoVersionRecord = {
      id: values.id ?? randomUUID(),
      createdAt: values.createdAt ?? new Date(),
      ...values,
    };
    const [record] = await db.insert(panelVideoVersions).values(payload).returning();
    return record;
  }
}

interface Veo3JobServiceDependencies {
  client?: Veo3GenAiClient;
  repository?: Veo3JobRepository;
  objectStorage?: ObjectStorageService;
  logger?: AppLogger;
  options?: Partial<Veo3JobServiceOptions>;
}

export class Veo3JobService {
  private readonly client: Veo3GenAiClient;
  private readonly repository: Veo3JobRepository;
  private readonly objectStorage: ObjectStorageService;
  private readonly logger: AppLogger;
  private readonly options: Veo3JobServiceOptions;

  constructor(dependencies: Veo3JobServiceDependencies = {}) {
    this.client =
      dependencies.client ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
    this.repository = dependencies.repository ?? new DrizzleVeo3JobRepository();
    this.objectStorage = dependencies.objectStorage ?? new ObjectStorageService();
    this.logger = (dependencies.logger ?? appLogger).child({ context: "Veo3JobService" });
    this.options = { ...DEFAULT_OPTIONS, ...(dependencies.options ?? {}) };
  }

  getIdlePollDelayMs(): number {
    return this.options.pendingPollIntervalMs;
  }

  getActivePollDelayMs(): number {
    return this.options.initialPollDelayMs;
  }

  async createJob(options: CreateVeo3JobOptions): Promise<PanelVideoRequestRecord> {
    const resolvedModel = this.resolveModelConfig(
      options.model ?? this.options.defaultModel,
      options.version,
    );
    const source = this.buildSource(options);
    const config = this.mergeConfig(resolvedModel.defaultConfig, options.config);
    const promptText = this.extractPromptFromSource(source, options.prompt);

    const payload: GenerateVideosParameters = {
      model: resolvedModel.model,
      source,
      config,
    };

    const operation = await this.client.models.generateVideos(payload);

    if (!operation?.name) {
      throw new Error("Veo3 operation did not return an operation name");
    }

    const storedPayload: StoredGenerateVideosPayload = this.sanitizeForJson({
      source,
      config,
    });

    const created = await this.repository.createRequest({
      panelId: options.panelId,
      model: resolvedModel.model,
      modelVariant: resolvedModel.version,
      prompt: promptText,
      operationName: operation.name,
      status: "queued",
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.options.defaultMaxRetries,
      requestConfig: this.sanitizeForJson(config),
      requestPayload: storedPayload,
      nextPollAt: new Date(Date.now() + this.options.initialPollDelayMs),
    });

    this.logger.info("Created Veo3 job", {
      requestId: created.id,
      panelId: options.panelId,
      model: resolvedModel.model,
      version: resolvedModel.version,
    });

    return created;
  }

  async pollOutstandingOperations(limit: number = this.options.pollBatchSize): Promise<number> {
    const now = new Date();
    const requests = await this.repository.findPollableRequests(now, limit);

    for (const request of requests) {
      await this.processRequest(request, now);
    }

    return requests.length;
  }

  private async processRequest(request: PanelVideoRequestRecord, polledAt: Date) {
    if (!request.operationName) {
      await this.markFailure(request, "Missing operation name", polledAt, request.retryCount + 1);
      return;
    }

    try {
      const operationRef = new GenerateVideosOperation();
      operationRef.name = request.operationName;
      const operation = await this.client.operations.getVideosOperation({
        operation: operationRef,
      });

      if (!operation.done) {
        await this.repository.updateRequest(request.id, {
          status: "processing",
          lastPolledAt: polledAt,
          nextPollAt: new Date(polledAt.getTime() + this.options.pendingPollIntervalMs),
        });
        return;
      }

      if (operation.error) {
        await this.handleOperationFailure(request, operation, polledAt);
        return;
      }

      await this.handleOperationSuccess(request, operation, polledAt);
    } catch (error) {
      await this.handleOperationError(request, error as Error, polledAt);
    }
  }

  private async handleOperationSuccess(
    request: PanelVideoRequestRecord,
    operation: GenerateVideosOperation,
    polledAt: Date,
  ) {
    const generatedVideos = operation.response?.generatedVideos ?? [];
    const versionPayloads: NewPanelVideoVersionRecord[] = [];

    for (const videoSample of generatedVideos) {
      const videoPath = this.normalizeStoragePath(videoSample.video?.uri);
      if (!videoPath) {
        continue;
      }

      const posterUri = this.extractPosterUri(videoSample);
      const posterPath = posterUri ? this.normalizeStoragePath(posterUri) : undefined;

      const [videoPrimed, posterPrimed] = await Promise.all([
        this.primeCdnCache(videoPath),
        posterPath ? this.primeCdnCache(posterPath) : Promise.resolve(false),
      ]);

      versionPayloads.push({
        requestId: request.id,
        videoPath,
        posterPath,
        durationMs: this.extractDuration(videoSample),
        metadata: this.sanitizeForJson(videoSample),
        videoPrimedAt: videoPrimed ? polledAt : undefined,
        posterPrimedAt: posterPrimed ? polledAt : undefined,
      });
    }

    for (const payload of versionPayloads) {
      await this.repository.createVersion(payload);
    }

    await this.repository.updateRequest(request.id, {
      status: "succeeded",
      completedAt: polledAt,
      lastPolledAt: polledAt,
      nextPollAt: null,
      failureReason: null,
    });

    this.logger.info("Veo3 job completed", {
      requestId: request.id,
      panelId: request.panelId,
      generatedVideos: versionPayloads.length,
    });
  }

  private async handleOperationFailure(
    request: PanelVideoRequestRecord,
    operation: GenerateVideosOperation,
    polledAt: Date,
  ) {
    const errorMessage = this.getOperationErrorMessage(operation);
    const nextRetryCount = request.retryCount + 1;

    if (nextRetryCount > request.maxRetries) {
      await this.markFailure(request, errorMessage ?? "Unknown failure", polledAt, nextRetryCount);
      return;
    }

    const payload = this.rebuildPayloadFromRequest(request);
    if (!payload) {
      await this.markFailure(request, errorMessage ?? "Unable to rebuild payload", polledAt, nextRetryCount);
      return;
    }

    let newOperation: GenerateVideosOperation;
    try {
      newOperation = await this.client.models.generateVideos(payload);
    } catch (err) {
      await this.markFailure(
        request,
        errorMessage ?? (err as Error).message,
        polledAt,
        nextRetryCount,
      );
      return;
    }

    if (!newOperation?.name) {
      await this.markFailure(request, "Retry operation missing name", polledAt, nextRetryCount);
      return;
    }

    await this.repository.updateRequest(request.id, {
      status: "queued",
      retryCount: nextRetryCount,
      failureReason: errorMessage,
      operationName: newOperation.name,
      lastPolledAt: polledAt,
      nextPollAt: new Date(polledAt.getTime() + this.options.initialPollDelayMs),
    });

    this.logger.warn("Retrying Veo3 job after failure", {
      requestId: request.id,
      retryCount: nextRetryCount,
      previousOperation: request.operationName,
      nextOperation: newOperation.name,
    });
  }

  private async handleOperationError(
    request: PanelVideoRequestRecord,
    error: Error,
    polledAt: Date,
  ) {
    const nextRetryCount = request.retryCount + 1;

    if (nextRetryCount > request.maxRetries) {
      await this.markFailure(request, error.message, polledAt, nextRetryCount);
      return;
    }

    await this.repository.updateRequest(request.id, {
      status: "processing",
      retryCount: nextRetryCount,
      failureReason: error.message,
      lastPolledAt: polledAt,
      nextPollAt: new Date(polledAt.getTime() + this.computeRetryDelay(nextRetryCount)),
    });

    this.logger.warn("Error polling Veo3 job, scheduling retry", {
      requestId: request.id,
      retryCount: nextRetryCount,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  private async markFailure(
    request: PanelVideoRequestRecord,
    reason: string,
    polledAt: Date,
    retryCount: number,
  ) {
    await this.repository.updateRequest(request.id, {
      status: "failed",
      failureReason: reason,
      completedAt: polledAt,
      lastPolledAt: polledAt,
      nextPollAt: null,
      retryCount,
    });

    this.logger.error("Veo3 job failed", {
      requestId: request.id,
      panelId: request.panelId,
      retryCount,
      reason,
    });
  }

  private resolveModelConfig(model: Veo3ModelKey, version?: string): ResolvedModelConfig {
    const modelConfig = MODEL_VERSION_CONFIG[model];
    if (!modelConfig) {
      throw new Error(`Unsupported Veo3 model: ${model}`);
    }

    const versionKey = version ?? modelConfig.defaultVersion;
    const versionConfig = modelConfig.versions[versionKey];
    if (!versionConfig) {
      throw new Error(`Unsupported Veo3 model version: ${versionKey}`);
    }

    return {
      model: modelConfig.model,
      version: versionConfig.version,
      defaultConfig: versionConfig.defaultConfig,
    };
  }

  private buildSource(options: CreateVeo3JobOptions): GenerateVideosParameters["source"] {
    const source: GenerateVideosParameters["source"] = options.source
      ? { ...options.source }
      : {};

    if (options.prompt && !source.prompt) {
      source.prompt = options.prompt;
    }

    return Object.keys(source).length > 0 ? source : { prompt: options.prompt ?? "" };
  }

  private mergeConfig(
    baseConfig?: Partial<GenerateVideosConfig>,
    overrideConfig?: GenerateVideosConfig,
  ): GenerateVideosConfig | undefined {
    const merged = {
      ...(baseConfig ?? {}),
      ...(overrideConfig ?? {}),
    } as GenerateVideosConfig;

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private extractPromptFromSource(
    source: GenerateVideosParameters["source"] | undefined,
    fallback?: string,
  ): string {
    const prompt = source?.prompt ?? fallback ?? "";
    return prompt;
  }

  private getOperationErrorMessage(operation: GenerateVideosOperation): string | undefined {
    const error = operation.error as { message?: string } | undefined;
    if (!error) {
      return undefined;
    }
    if (typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    return JSON.stringify(error);
  }

  private rebuildPayloadFromRequest(
    request: PanelVideoRequestRecord,
  ): GenerateVideosParameters | undefined {
    const stored = request.requestPayload as StoredGenerateVideosPayload | null | undefined;
    const source = stored?.source ?? (request.prompt ? { prompt: request.prompt } : undefined);
    const config = stored?.config ?? (request.requestConfig as GenerateVideosConfig | undefined);

    if (!source && !config) {
      return undefined;
    }

    return {
      model: request.model,
      source,
      config: config as GenerateVideosConfig | undefined,
    };
  }

  private computeRetryDelay(retryCount: number): number {
    const exponent = Math.max(0, retryCount - 1);
    const delay = this.options.retryBaseDelayMs * Math.pow(2, exponent);
    return Math.min(delay, this.options.maxPollIntervalMs);
  }

  private normalizeStoragePath(uri?: string | null): string | undefined {
    if (!uri) {
      return undefined;
    }

    try {
      return this.objectStorage.normalizeObjectEntityPath(uri);
    } catch (error) {
      this.logger.warn("Failed to normalize storage path", {
        uri,
        error: error instanceof Error ? error.message : error,
      });
      return uri;
    }
  }

  private extractPosterUri(videoSample: GeneratedVideo | Record<string, unknown>): string | undefined {
    const candidates = [
      (videoSample as any)?.poster?.uri,
      (videoSample as any)?.posterFrame?.uri,
      (videoSample as any)?.previewImage?.uri,
      (videoSample as any)?.thumbnail?.uri,
      (videoSample as any)?.thumbnails?.[0]?.uri,
      (videoSample as any)?.posterUri,
    ];

    return candidates.find((value): value is string => typeof value === "string" && value.length > 0);
  }

  private extractDuration(videoSample: GeneratedVideo | Record<string, unknown>): number | undefined {
    const raw =
      (videoSample as any)?.durationMs ??
      (videoSample as any)?.video?.durationMs ??
      (videoSample as any)?.metadata?.durationMs;

    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private async primeCdnCache(path?: string): Promise<boolean> {
    if (!path) {
      return false;
    }

    const targets = this.resolveCdnTargets(path);
    if (targets.length === 0) {
      return false;
    }

    let success = false;

    for (const url of targets) {
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok) {
          success = true;
        } else {
          this.logger.debug("CDN prime request returned non-OK status", {
            url,
            status: response.status,
          });
        }
      } catch (error) {
        this.logger.debug("CDN prime request failed", {
          url,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return success;
  }

  private resolveCdnTargets(path: string): string[] {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return [path];
    }

    const envValue =
      process.env.CDN_CACHE_PRIME_URLS ?? process.env.CDN_CACHE_PRIME_URL ?? "";
    const baseUrls = envValue
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (baseUrls.length === 0) {
      return [];
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return baseUrls.map((base) => {
      const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
      return `${trimmed}${normalizedPath}`;
    });
  }

  private sanitizeForJson<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }

    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}
