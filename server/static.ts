import express, { type Express } from "express";
import path from "path";
import { getBuildPath } from "./utils/path-resolver";

export function serveStatic(app: Express) {
  const distPath = getBuildPath();

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
