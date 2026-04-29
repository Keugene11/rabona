#!/usr/bin/env node
// Captures App Store-spec screenshots of rabona.live for iPhone 6.7" Display
// (1290 × 2796). Saves PNGs to .signing/screenshots/.
//
// Notes:
// - Uses no auth, so we capture public/welcome flows. Authenticated screenshots
//   would need a logged-in puppeteer session.
// - App Store Connect's API enum is APP_IPHONE_67 — that's the largest iPhone
//   screenshot tier Apple currently exposes via API (covers iPhone 14/15/16
//   Pro Max). Logical viewport 430×932 at deviceScaleFactor=3 → 1290×2796.

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const outDir = path.join(projectRoot, '.signing', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { name: '01-welcome', url: 'https://rabona.live/login', scrollY: 0 },
  { name: '02-about-features', url: 'https://rabona.live/about', scrollY: 0 },
  { name: '03-about-getstarted', url: 'https://rabona.live/about', scrollY: 2400 },
];

const VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );

  for (const shot of SHOTS) {
    console.log(`Capturing ${shot.url} (scrollY=${shot.scrollY}) → ${shot.name}.png`);
    await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (shot.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
    }
    await new Promise((r) => setTimeout(r, 1000));
    const out = path.join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: out, type: 'png' });
    const size = fs.statSync(out).size;
    console.log(`  saved ${out} (${(size / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
}

console.log(`\nDone. ${SHOTS.length} screenshots in ${outDir}`);
