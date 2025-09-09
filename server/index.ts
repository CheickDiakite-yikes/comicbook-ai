import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Serve generated images with object storage fallback
  app.use("/generated", express.static(path.join(process.cwd(), "public", "generated")));
  
  // Fallback route for missing generated images - try object storage
  app.get("/generated/:filename", async (req, res, next) => {
    // If we get here, the static file wasn't found, so try object storage
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      // Try to find the image in object storage 
      const filename = req.params.filename;
      
      // Check if file exists in public object storage paths
      const publicFile = await objectStorageService.searchPublicObject(filename);
      if (publicFile) {
        return objectStorageService.downloadObject(publicFile, res);
      }
      
      // If not found in public storage, check private storage (for backwards compatibility)
      try {
        const privateFile = await objectStorageService.getObjectEntityFile(`/objects/uploads/${filename}`);
        return objectStorageService.downloadObject(privateFile, res);
      } catch (privateError) {
        // If not found in object storage either, return 404
        console.log(`Image not found in local or object storage: ${filename}`);
        return res.status(404).json({ error: "Image not found" });
      }
    } catch (error) {
      console.error("Error serving generated image from object storage:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
