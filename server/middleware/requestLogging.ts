import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppLogger } from "../logger";

const MAX_RESPONSE_PREVIEW_LENGTH = 500;

function createResponsePreview(payload: unknown) {
  if (payload === undefined || payload === null) {
    return undefined;
  }

  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);

    if (serialized.length <= MAX_RESPONSE_PREVIEW_LENGTH) {
      return serialized;
    }

    return `${serialized.slice(0, MAX_RESPONSE_PREVIEW_LENGTH)}…`;
  } catch (error) {
    return `Failed to serialize response preview: ${(error as Error).message}`;
  }
}

export function createRequestLoggingMiddleware(logger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();

    res.locals.requestId = requestId;

    let capturedJsonResponse: unknown;
    const originalJson = res.json.bind(res) as typeof res.json;
    res.json = ((...args: Parameters<typeof res.json>) => {
      capturedJsonResponse = args[0];
      return originalJson(...args);
    }) as typeof res.json;

    res.on("finish", () => {
      if (!req.originalUrl.startsWith("/api")) {
        return;
      }

      const durationMs = Date.now() - start;
      const responsePreview = createResponsePreview(capturedJsonResponse);
      const metadata = {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ...(responsePreview ? { responsePreview } : {}),
      };

      logger.info("API request completed", metadata);
    });

    next();
  };
}
