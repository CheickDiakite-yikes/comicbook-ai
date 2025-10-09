import express from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createRequestLoggingMiddleware } from "./middleware/requestLogging";
import { createErrorHandler } from "./middleware/errorHandler";
import { logger, registerGlobalErrorHandlers } from "./logger";
import { resolveUserId } from "./utils/authHelpers";
import { startObjectCleanupWorker } from "./workers/objectCleanupWorker";
import { Veo3JobWorker } from "./parallel-processing/Veo3JobWorker";

registerGlobalErrorHandlers(logger);

const app = express();
// Increase body parser limits for large script payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(createRequestLoggingMiddleware(logger));

const veo3JobWorker = new Veo3JobWorker({ logger });

const stopBackgroundWorkers = () => {
  veo3JobWorker.stop();
};

process.once("SIGTERM", stopBackgroundWorkers);
process.once("SIGINT", stopBackgroundWorkers);

(async () => {
  const server = await registerRoutes(app);

  if (process.env.DISABLE_OBJECT_CLEANUP_WORKER !== "true") {
    startObjectCleanupWorker();
  }
  veo3JobWorker.start();

  // Serve generated images with object storage fallback
  app.use("/generated", express.static(path.join(process.cwd(), "public", "generated")));

  // Fallback route for missing generated images - try object storage
  app.get("/generated/:filename", async (req, res, next) => {
    const filename = req.params.filename;
    const userId = (() => {
      try {
        return (req as any).user ? resolveUserId((req as any).user) : null;
      } catch {
        return null;
      }
    })();

    try {
      await logger.audit("asset.access.requested", {
        userId,
        resourceType: "generated_asset",
        resourceId: filename,
        metadata: { requestId: res.locals.requestId },
      });

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();

      const publicFile = await objectStorageService.searchPublicObject(filename);
      if (publicFile) {
        await logger.audit("asset.access.served", {
          userId,
          resourceType: "generated_asset",
          resourceId: filename,
          metadata: { source: "object_storage_public", requestId: res.locals.requestId },
        });
        return objectStorageService.downloadObject(publicFile, res);
      }

      try {
        const privateFile = await objectStorageService.getObjectEntityFile(`/objects/uploads/${filename}`);
        await logger.audit("asset.access.served", {
          userId,
          resourceType: "generated_asset",
          resourceId: filename,
          metadata: { source: "object_storage_private", requestId: res.locals.requestId },
        });
        return objectStorageService.downloadObject(privateFile, res);
      } catch (privateError) {
        logger.warn("Generated image not found in object storage, serving placeholder", {
          filename,
          requestId: res.locals.requestId,
          error: privateError instanceof Error ? privateError : undefined,
        });

        await logger.audit("asset.access.placeholder", {
          userId,
          resourceType: "generated_asset",
          resourceId: filename,
          metadata: { requestId: res.locals.requestId },
        });

        const placeholderSvg = `
          <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="400" fill="#f3f4f6"/>
            <text x="200" y="200" font-family="Arial, sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">
              <tspan x="200" dy="0">Image Missing</tspan>
              <tspan x="200" dy="20">Click to Regenerate</tspan>
            </text>
          </svg>
        `;

        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "no-cache");
        return res.send(placeholderSvg);
      }
    } catch (error) {
      next(error);
    }
  });

  app.use(createErrorHandler(logger));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info("Serving application", { port });
    },
  );
})();
