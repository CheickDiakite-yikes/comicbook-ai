import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import { extname } from "path";
import { logger } from "./logger";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl.js";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const LIFECYCLE_METADATA_KEY = "custom:lifecyclePolicy";
export const VARIANT_METADATA_KEY = "custom:variantType";
export const DEFAULT_LIFECYCLE_TAG = "archive-after-90-days";
export const DEFAULT_VARIANT_TAG = "non-canonical";

interface ObjectMetadataOptions {
  contentTypeHint?: string;
  lifecycleTag?: string | null;
  variantType?: string;
  cacheControl?: string;
}

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  private inferContentType(objectName: string, fallback: string = "application/octet-stream"): string {
    const extension = extname(objectName).toLowerCase();
    switch (extension) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      case ".svg":
        return "image/svg+xml";
      case ".json":
        return "application/json";
      case ".txt":
        return "text/plain";
      case ".pdf":
        return "application/pdf";
      default:
        return fallback;
    }
  }

  private async ensureObjectMetadata(
    objectFile: File,
    options: ObjectMetadataOptions = {},
  ) {
    const [metadata] = await objectFile.getMetadata();
    const updates: Record<string, unknown> = {};
    const existingCustomMetadata = { ...(metadata.metadata ?? {}) };

    const lifecycleTag = options.lifecycleTag === null
      ? null
      : options.lifecycleTag ?? DEFAULT_LIFECYCLE_TAG;
    const variantTag = options.variantType ?? existingCustomMetadata[VARIANT_METADATA_KEY] ?? DEFAULT_VARIANT_TAG;
    const inferredContentType = options.contentTypeHint ?? metadata.contentType ?? this.inferContentType(objectFile.name);

    let requiresUpdate = false;

    if (!metadata.contentType || metadata.contentType === "application/octet-stream") {
      updates.contentType = inferredContentType;
      requiresUpdate = true;
    }

    if (lifecycleTag === null) {
      if (existingCustomMetadata[LIFECYCLE_METADATA_KEY]) {
        delete existingCustomMetadata[LIFECYCLE_METADATA_KEY];
        requiresUpdate = true;
      }
    } else if (lifecycleTag && existingCustomMetadata[LIFECYCLE_METADATA_KEY] !== lifecycleTag) {
      existingCustomMetadata[LIFECYCLE_METADATA_KEY] = lifecycleTag;
      requiresUpdate = true;
    }

    if (variantTag && existingCustomMetadata[VARIANT_METADATA_KEY] !== variantTag) {
      existingCustomMetadata[VARIANT_METADATA_KEY] = variantTag;
      requiresUpdate = true;
    }

    if (options.cacheControl && metadata.cacheControl !== options.cacheControl) {
      updates.cacheControl = options.cacheControl;
      requiresUpdate = true;
    }

    if (requiresUpdate) {
      if (Object.keys(existingCustomMetadata).length > 0) {
        updates.metadata = existingCustomMetadata;
      }

      try {
        await objectFile.setMetadata(updates);
      } catch (error) {
        logger.warn("Failed to update object metadata", {
          objectName: objectFile.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const [updatedMetadata] = await objectFile.getMetadata();
      return updatedMetadata;
    }

    return metadata;
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(
    file: File,
    res: Response,
    cacheTtlSec: number = 3600,
    metadataOptions: ObjectMetadataOptions = {},
  ) {
    try {
      // Ensure metadata is populated with lifecycle + mime type tagging
      const metadata = await this.ensureObjectMetadata(file, metadataOptions);
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      const contentType = metadata.contentType ?? this.inferContentType(file.name);
      const cacheControlHeader = metadata.cacheControl || `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`;
      // Set appropriate headers
      res.set({
        "Content-Type": contentType,
        "Content-Length": metadata.size,
        "Cache-Control": cacheControlHeader,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getSignedObjectDownloadURL(
    objectPath: string,
    options: (ObjectMetadataOptions & { ttlSec?: number; downloadFileName?: string }) = {},
  ): Promise<{ url: string; expiresAt: string; contentType: string }> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    const metadata = await this.ensureObjectMetadata(objectFile, options);
    const expiresAt = new Date(Date.now() + (options.ttlSec ?? 900) * 1000);
    const contentType = metadata.contentType ?? this.inferContentType(objectFile.name);

    const [signedUrl] = await objectFile.getSignedUrl({
      action: "read",
      expires: expiresAt,
      responseDisposition: options.downloadFileName
        ? `attachment; filename="${options.downloadFileName}"`
        : undefined,
      responseType: contentType,
    });

    return {
      url: signedUrl,
      expiresAt: expiresAt.toISOString(),
      contentType,
    };
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
    metadataOptions: ObjectMetadataOptions = {},
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    await this.ensureObjectMetadata(objectFile, metadataOptions);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

export function parseBucketAndPrefix(path: string): {
  bucketName: string;
  prefix: string;
} {
  let normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  const firstSlash = normalized.indexOf("/");
  if (firstSlash === -1) {
    throw new Error("Invalid path: must include bucket and prefix");
  }

  const bucketName = normalized.slice(0, firstSlash);
  const prefix = normalized.slice(firstSlash + 1);

  return {
    bucketName,
    prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}