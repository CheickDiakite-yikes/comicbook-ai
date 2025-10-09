import express from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createRequestLoggingMiddleware } from "./middleware/requestLogging";
import { createErrorHandler } from "./middleware/errorHandler";
import { logger, registerGlobalErrorHandlers } from "./logger";

registerGlobalErrorHandlers(logger);

const app = express();
// Increase body parser limits for large script payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(createRequestLoggingMiddleware(logger));

(async () => {
  const server = await registerRoutes(app);

  // Serve generated images with object storage fallback
  app.use("/generated", express.static(path.join(process.cwd(), "public", "generated")));

  // Fallback route for missing generated images - try object storage
  app.get("/generated/:filename", async (req, res, next) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const filename = req.params.filename;

      const publicFile = await objectStorageService.searchPublicObject(filename);
      if (publicFile) {
        return objectStorageService.downloadObject(publicFile, res);
      }

      try {
        const privateFile = await objectStorageService.getObjectEntityFile(`/objects/uploads/${filename}`);
        return objectStorageService.downloadObject(privateFile, res);
      } catch (privateError) {
        logger.warn("Generated image not found in object storage, serving placeholder", {
          filename,
          requestId: res.locals.requestId,
          error: privateError instanceof Error ? privateError : undefined,
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
