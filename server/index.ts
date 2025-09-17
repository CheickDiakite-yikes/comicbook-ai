import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
// Increase body parser limits for large script payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
        // If not found in object storage either, serve a placeholder image
        console.log(`Image not found in local or object storage: ${filename}, serving placeholder`);
        
        // Generate a simple placeholder image
        const placeholderSvg = `
          <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="400" fill="#f3f4f6"/>
            <text x="200" y="200" font-family="Arial, sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">
              <tspan x="200" dy="0">Image Missing</tspan>
              <tspan x="200" dy="20">Click to Regenerate</tspan>
            </text>
          </svg>
        `;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(placeholderSvg);
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
