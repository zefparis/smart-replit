import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory does not exist: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy necessary assets to dist directory
 */
function copyAssets() {
  console.log('Copying assets to dist directory...');

  const distDir = path.join(projectRoot, 'dist');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy external_scrapers directory if it exists
  const externalScrapersSource = path.join(projectRoot, 'external_scrapers');
  const externalScrapersTarget = path.join(distDir, 'external_scrapers');
  
  if (fs.existsSync(externalScrapersSource)) {
    console.log('Copying external_scrapers directory...');
    copyDir(externalScrapersSource, externalScrapersTarget);
  } else {
    console.warn('external_scrapers directory not found, skipping...');
  }

  // Copy shared directory if it exists
  const sharedSource = path.join(projectRoot, 'shared');
  const sharedTarget = path.join(distDir, 'shared');
  
  if (fs.existsSync(sharedSource)) {
    console.log('Copying shared directory...');
    copyDir(sharedSource, sharedTarget);
  }

  // Copy contracts directory if it exists
  const contractsSource = path.join(projectRoot, 'contracts');
  const contractsTarget = path.join(distDir, 'contracts');
  
  if (fs.existsSync(contractsSource)) {
    console.log('Copying contracts directory...');
    copyDir(contractsSource, contractsTarget);
  }

  // Copy any .env.example files
  const envExampleSource = path.join(projectRoot, 'server', '.env.example');
  const envExampleTarget = path.join(distDir, '.env.example');
  
  if (fs.existsSync(envExampleSource)) {
    console.log('Copying .env.example...');
    fs.copyFileSync(envExampleSource, envExampleTarget);
  }

  console.log('Assets copied successfully!');
}

// Run the copy operation
copyAssets();
