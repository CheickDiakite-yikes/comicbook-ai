import type { NextFunction, Request, Response } from "express";
import type { AppLogger } from "../logger";

function resolveStatusCode(error: unknown) {
  const statusFromError =
    (typeof error === "object" && error !== null && "status" in error && typeof (error as Record<string, unknown>).status === "number"
      ? (error as Record<string, unknown>).status
      : undefined) ??
    (typeof error === "object" && error !== null && "statusCode" in error &&
    typeof (error as Record<string, unknown>).statusCode === "number"
      ? (error as Record<string, unknown>).statusCode
      : undefined);

  if (typeof statusFromError === "number" && statusFromError >= 400 && statusFromError < 600) {
    return statusFromError;
  }

  return 500;
}

export function createErrorHandler(logger: AppLogger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status = resolveStatusCode(error);
    const requestId = res.locals.requestId as string | undefined;

    const metadata = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: status,
      query: req.query,
    };

    if (error instanceof Error) {
      logger.error("Unhandled error while processing request", error, metadata);
    } else {
      logger.error("Unhandled error while processing request", { ...metadata, error });
    }

    if (res.headersSent) {
      return;
    }

    const message =
      status >= 500
        ? "Internal Server Error"
        : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
        ? String((error as Record<string, unknown>).message)
        : "Request failed";

    res.status(status).json({ message, requestId });
  };
}
