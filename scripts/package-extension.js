import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const extensionDir = path.join(rootDir, 'extension');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');
const zipName = 'frontdesk-pro-extension.zip';
const targetZipInPublic = path.join(publicDir, zipName);
const targetZipInDist = path.join(distDir, zipName);

console.log('📦 Packaging FrontDesk Pro Chrome Extension...');

if (!fs.existsSync(extensionDir)) {
  console.error('❌ Extension source directory not found at:', extensionDir);
  process.exit(1);
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Remove old zip in public
if (fs.existsSync(targetZipInPublic)) {
  fs.unlinkSync(targetZipInPublic);
}

// Package files from extension/ into target zip
// Using relative paths inside extension/ so manifest.json is directly accessible
try {
  execSync(`cd "${extensionDir}" && zip -r "${targetZipInPublic}" . -x "*.DS_Store"`, {
    stdio: 'inherit',
  });
  console.log(`✅ Successfully generated: ${targetZipInPublic}`);

  // If dist exists, also copy it into dist
  if (fs.existsSync(distDir)) {
    fs.copyFileSync(targetZipInPublic, targetZipInDist);
    console.log(`✅ Synced to dist: ${targetZipInDist}`);
  }

  const stats = fs.statSync(targetZipInPublic);
  console.log(`📊 Extension package size: ${(stats.size / 1024).toFixed(1)} KB`);
} catch (error) {
  console.error('❌ Failed to zip extension:', error);
  process.exit(1);
}
