import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

/**
 * Safe dirname resolution for ESM modules in both development and production
 */
export function getSafeDirname(): string {
  if (typeof import.meta.dirname !== 'undefined') {
    return import.meta.dirname;
  }
  // Fallback for compiled/bundled environments
  if (typeof import.meta.url !== 'undefined') {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  // Last resort fallback
  throw new Error('Cannot determine current directory. import.meta.dirname and import.meta.url are both undefined.');
}

/**
 * Get the project root directory safely
 */
export function getProjectRoot(): string {
  const currentDir = getSafeDirname();
  
  // Check if we're in a bundled/compiled environment by looking for dist in path
  const isInDist = currentDir.includes('dist');
  
  if (isInDist) {
    // In production build: we're in dist/server/utils, go up 3 levels to project root
    return path.resolve(currentDir, '..', '..', '..');
  } else {
    // In development: we're in server/utils, go up 2 levels to project root
    return path.resolve(currentDir, '..', '..');
  }
}

/**
 * Resolve paths safely with existence checks
 */
export function resolvePath(...segments: string[]): string {
  const resolvedPath = path.resolve(...segments);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }
  
  return resolvedPath;
}

/**
 * Resolve paths for external scripts (Python scrapers)
 */
export function resolveExternalScriptsPath(): string {
  const projectRoot = getProjectRoot();
  const scriptsPath = path.join(projectRoot, 'external_scrapers');
  
  if (!fs.existsSync(scriptsPath)) {
    throw new Error(`External scripts directory not found: ${scriptsPath}. Make sure external_scrapers directory exists.`);
  }
  
  return scriptsPath;
}

/**
 * Get client template path with validation
 */
export function getClientTemplatePath(): string {
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'client', 'index.html');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Client template not found: ${templatePath}. Make sure the client directory exists and contains index.html.`);
  }
  
  return templatePath;
}

/**
 * Get production build path with validation
 */
export function getBuildPath(): string {
  const projectRoot = getProjectRoot();
  const buildPath = path.join(projectRoot, 'dist', 'public');
  
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build directory not found: ${buildPath}. Run 'npm run build' first to generate the production build.`);
  }
  
  const indexPath = path.join(buildPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`index.html not found in build directory: ${indexPath}. The build may be incomplete.`);
  }
  
  return buildPath;
}
