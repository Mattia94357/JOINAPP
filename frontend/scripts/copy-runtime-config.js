const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'public', 'runtime-config.json');
const outputDir = path.join(__dirname, '..', 'web-build');
const destination = path.join(outputDir, 'runtime-config.json');

if (!fs.existsSync(source)) {
  console.warn('[JOIN] No public/runtime-config.json found; skipping runtime config copy.');
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, destination);

console.log('[JOIN] Copied public/runtime-config.json to web-build/runtime-config.json');
