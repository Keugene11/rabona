#!/usr/bin/env node
// Prepares all visual assets for the Google Play Store listing:
//   - 8 phone screenshots (reused from iPhone 6.7" captures, 1290×2796)
//   - 1 hi-res icon (512×512, from resources/icon-only.png)
//   - 1 feature graphic (1024×500, generated as SVG → PNG)
// All output to .signing/play-listing/.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const outDir = path.join(projectRoot, '.signing', 'play-listing');
fs.mkdirSync(outDir, { recursive: true });

// 1. Phone screenshots — reuse iPhone 6.7" captures (1290×2796 is within Play's
// allowed 16:9-to-9:32 aspect ratio range).
console.log('Copying iPhone screenshots → Play phone screenshots...');
const iPhoneShotsDir = path.join(projectRoot, '.signing', 'screenshots');
const phoneShotsDir = path.join(outDir, 'phone');
fs.mkdirSync(phoneShotsDir, { recursive: true });
for (const f of fs.readdirSync(iPhoneShotsDir).filter((n) => n.endsWith('.png'))) {
  fs.copyFileSync(path.join(iPhoneShotsDir, f), path.join(phoneShotsDir, f));
  console.log(`  ${f}`);
}

// 2. Hi-res icon: 512×512 PNG, no alpha (Play strips transparency).
console.log('\nGenerating 512×512 hi-res icon...');
const iconOut = path.join(outDir, 'icon-512.png');
await sharp(path.join(projectRoot, 'resources', 'icon-only.png'))
  .resize(512, 512, { fit: 'contain', background: '#000000' })
  .flatten({ background: '#000000' })
  .png()
  .toFile(iconOut);
console.log(`  saved ${iconOut}`);

// 3. Feature graphic: 1024×500. Black background, white "[ Rabona ]" wordmark
// + subtitle, mirrors the brand identity.
console.log('\nGenerating 1024×500 feature graphic...');
const featureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="#000000"/>
  <text x="512" y="240" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="120" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-2">[ Rabona ]</text>
  <text x="512" y="320" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="34" font-weight="400" fill="#999999" text-anchor="middle">A social network — open to anyone</text>
  <text x="512" y="380" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="22" font-weight="400" fill="#666666" text-anchor="middle">Friends · Walls · Photos · Messages · Pokes</text>
</svg>
`;
const featureOut = path.join(outDir, 'feature-graphic-1024x500.png');
await sharp(Buffer.from(featureSvg))
  .png()
  .toFile(featureOut);
console.log(`  saved ${featureOut}`);

console.log('\nAll Play listing assets ready in', outDir);
