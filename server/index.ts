// server/index.ts
const express = require("express");
import { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateRequiredEnvVars, logEnvStatus } from "./utils/env-validator";

const app = express();

// --- Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Logger API (compact, log/monitoring prod-ready)
app.use((req, res, next) => {
  const start = Date.now();
  let capturedBody: any;
  const originalJson = res.json;
  res.json = function (body, ...args) {
    capturedBody = body;
    return originalJson.call(this, body, ...args);
  };
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      let msg = `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (capturedBody) msg += ` :: ${JSON.stringify(capturedBody)}`;
      log(msg.length > 120 ? msg.slice(0, 119) + "…" : msg);
    }
  });
  next();
});

(async () => {
  try {
    // Validate environment variables
    validateRequiredEnvVars();
    logEnvStatus();
  } catch (error) {
    log(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // --- Routing setup (doit retourner un http.Server OU app, cf. plus bas)
  const serverOrApp = await registerRoutes(app);

  // --- Error handler global (évite crash app si erreur 500+)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const msg = err.message || "Internal Server Error";
    log(`ERROR ${status} :: ${msg}`);
    if (!res.headersSent) res.status(status).json({ message: msg });
  });

  // --- Dev: Vite (SSR), Prod: Static
  if (app.get("env") === "development") {
    await setupVite(app, serverOrApp);
  } else {
    serveStatic(app);
  }

  // --- Cloud port auto, 0.0.0.0 obligatoire, fallback 5000
  const port = parseInt(process.env.PORT || "5000", 10);

  // --- Si registerRoutes renvoie un http.Server, .listen() dessus. Sinon fallback app.listen().
  const listener = (typeof serverOrApp.listen === "function" ? serverOrApp : app) as typeof app;
  listener.listen(port, "0.0.0.0", () => log(`🚀 Serving on http://0.0.0.0:${port}`));
})();

// Optionnel : healthcheck pour Railway/Heroku
app.get("/healthz", (_req, res) => res.status(200).send("OK"));
