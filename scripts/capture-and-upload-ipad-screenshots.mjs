#!/usr/bin/env node
// Captures iPad Pro 12.9" Display screenshots (2048×2732 portrait) of
// rabona.live and uploads them to App Store Connect as APP_IPAD_PRO_3GEN_129.
//
// Apple requires iPad screenshots whenever the build's TARGETED_DEVICE_FAMILY
// includes iPad. Our Capacitor app does, so we provide them here.

import puppeteer from 'puppeteer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';
const VERSION_STRING = '1.0';
const LOCALE = 'en-US';
const DISPLAY_TYPE = 'APP_IPAD_PRO_3GEN_129';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const outDir = path.join(projectRoot, '.signing', 'screenshots-ipad');
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { name: '01-welcome', url: 'https://rabona.live/login', scrollY: 0 },
  { name: '02-about-features', url: 'https://rabona.live/about', scrollY: 0 },
  { name: '03-about-getstarted', url: 'https://rabona.live/about', scrollY: 2000 },
];

// iPad Pro 12.9" Display: 2048×2732 portrait. Logical 1024×1366 at DPR=2.
const VIEWPORT = { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

console.log('Capturing iPad Pro 12.9" screenshots...');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.setUserAgent(
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );

  for (const shot of SHOTS) {
    console.log(`  ${shot.url} → ${shot.name}.png`);
    await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (shot.scrollY) await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(outDir, `${shot.name}.png`), type: 'png' });
  }
} finally {
  await browser.close();
}

// ============== Upload ==============
const ascKey = fs.readFileSync(path.join(os.homedir(), 'Downloads', `AuthKey_${KEY_ID}.p8`), 'utf8');
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function jwt() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: 'appstoreconnect-v1' };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: ascKey, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64url(sig)}`;
}
const headers = { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' };

async function api(method, pathname, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

console.log('\nLooking up App Store version localization...');
const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
const app = apps.data[0];
const versions = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=50`);
const v = versions.data.find((x) => x.attributes.versionString === VERSION_STRING);
const locs = await api('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
const loc = locs.data.find((l) => l.attributes.locale === LOCALE);
console.log(`  loc id = ${loc.id}`);

console.log('\nFinding/creating iPad Pro 12.9" screenshot set...');
const sets = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
let set = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY_TYPE);
if (set) {
  console.log(`  exists (id=${set.id}); clearing old screenshots...`);
  const existing = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  for (const sc of existing.data || []) {
    await api('DELETE', `/v1/appScreenshots/${sc.id}`);
    console.log(`    deleted ${sc.id}`);
  }
} else {
  const created = await api('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: DISPLAY_TYPE },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
    },
  });
  set = created.data;
  console.log(`  created set id=${set.id}`);
}

console.log('\nUploading screenshots...');
const files = fs.readdirSync(outDir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
const uploadedIds = [];
for (const f of files) {
  const filePath = path.join(outDir, f);
  const buf = fs.readFileSync(filePath);
  const fileSize = buf.length;
  console.log(`  ${f} (${(fileSize / 1024).toFixed(0)} KB)`);
  const created = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: f, fileSize },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
    },
  });
  const sc = created.data;
  for (const op of sc.attributes.uploadOperations || []) {
    const slice = buf.subarray(op.offset, op.offset + op.length);
    const reqHeaders = {};
    for (const h of op.requestHeaders || []) reqHeaders[h.name] = h.value;
    const r = await fetch(op.url, { method: op.method, headers: reqHeaders, body: slice });
    if (!r.ok) throw new Error(`upload chunk failed: ${r.status}\n${await r.text()}`);
  }
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  await api('PATCH', `/v1/appScreenshots/${sc.id}`, {
    data: { type: 'appScreenshots', id: sc.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log(`    committed (md5=${md5})`);
  uploadedIds.push(sc.id);
}

if (uploadedIds.length > 1) {
  console.log('\nReordering...');
  await api('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
    data: uploadedIds.map((id) => ({ type: 'appScreenshots', id })),
  });
}

console.log(`\nDone. ${uploadedIds.length} iPad Pro 12.9" screenshot(s) uploaded.`);
