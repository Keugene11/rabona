#!/usr/bin/env node
// Uploads .signing/screenshots/*.png to the App Store Connect listing for
// live.rabona.app, version 1.0, en-US localization, as iPhone 6.9" screenshots.
//
// Multi-step Apple flow: create screenshot set → create screenshot record →
// upload bytes via presigned URLs → commit with checksum.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';
const VERSION_STRING = '1.0';
const LOCALE = 'en-US';
const DISPLAY_TYPE = 'APP_IPHONE_67';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const shotsDir = path.join(projectRoot, '.signing', 'screenshots');
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

function authHeaders() {
  return { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' };
}

async function api(method, pathname, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}\n${text}`);
  return json;
}

async function findContext() {
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error('App not found');

  const versions = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=50`);
  const v = (versions.data || []).find((x) => x.attributes.versionString === VERSION_STRING);
  if (!v) throw new Error(`Version ${VERSION_STRING} not found`);

  const locs = await api('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  const loc = (locs.data || []).find((l) => l.attributes.locale === LOCALE);
  if (!loc) throw new Error(`Locale ${LOCALE} not found`);

  return { appId: app.id, versionId: v.id, locId: loc.id };
}

async function findOrCreateSet(locId) {
  const sets = await api(
    'GET',
    `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=50`,
  );
  let set = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY_TYPE);
  if (set) {
    console.log(`  set exists (id=${set.id}); deleting old screenshots...`);
    const existing = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    for (const sc of existing.data || []) {
      console.log(`    deleting ${sc.id} (${sc.attributes.fileName || 'unnamed'})`);
      await api('DELETE', `/v1/appScreenshots/${sc.id}`);
    }
    return set.id;
  }
  console.log('  creating new screenshot set...');
  const created = await api('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: DISPLAY_TYPE },
      relationships: {
        appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } },
      },
    },
  });
  return created.data.id;
}

async function uploadOne(setId, filePath) {
  const fileName = path.basename(filePath);
  const buf = fs.readFileSync(filePath);
  const fileSize = buf.length;
  console.log(`\n  ${fileName} (${(fileSize / 1024).toFixed(0)} KB)`);

  const created = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  const sc = created.data;
  const ops = sc.attributes.uploadOperations || [];
  console.log(`    record id=${sc.id}, ${ops.length} upload op(s)`);

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const slice = buf.subarray(op.offset, op.offset + op.length);
    const reqHeaders = {};
    for (const h of op.requestHeaders || []) reqHeaders[h.name] = h.value;
    const res = await fetch(op.url, { method: op.method, headers: reqHeaders, body: slice });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Upload op ${i + 1}/${ops.length} failed: ${res.status}\n${t}`);
    }
    console.log(`    op ${i + 1}/${ops.length}: ${slice.length} bytes uploaded`);
  }

  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  await api('PATCH', `/v1/appScreenshots/${sc.id}`, {
    data: {
      type: 'appScreenshots',
      id: sc.id,
      attributes: { uploaded: true, sourceFileChecksum: md5 },
    },
  });
  console.log(`    committed (md5=${md5})`);
  return sc.id;
}

async function main() {
  const ctx = await findContext();
  console.log('App Store context:');
  console.log(`  appId   = ${ctx.appId}`);
  console.log(`  vId     = ${ctx.versionId}`);
  console.log(`  locId   = ${ctx.locId}`);

  console.log('\nFinding/creating iPhone 6.9" screenshot set...');
  const setId = await findOrCreateSet(ctx.locId);
  console.log(`  setId = ${setId}`);

  const files = fs
    .readdirSync(shotsDir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  console.log(`\nUploading ${files.length} screenshot(s)...`);

  const ids = [];
  for (const f of files) {
    const id = await uploadOne(setId, path.join(shotsDir, f));
    ids.push(id);
  }

  if (ids.length > 1) {
    console.log('\nReordering screenshots...');
    await api('PATCH', `/v1/appScreenshotSets/${setId}/relationships/appScreenshots`, {
      data: ids.map((id) => ({ type: 'appScreenshots', id })),
    });
    console.log('  done');
  }

  console.log(`\nDone. ${ids.length} iPhone 6.9" screenshot(s) attached to v${VERSION_STRING}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
