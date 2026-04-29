#!/usr/bin/env node
// Pushes the Google Play Store listing metadata + assets via the Play
// Developer API. Reads the service account JSON from ~/Downloads.
//
// Sets:
//   - en-US listing: title, short description, full description
//   - icon (512×512)
//   - feature graphic (1024×500)
//   - phone screenshots (3, reused from iPhone 6.7")
//
// Re-runnable. Each run creates a fresh edit, replaces all assets, and
// commits.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PACKAGE_NAME = 'live.rabona.app';
const LANG = 'en-US';
const SERVICE_ACCOUNT_PATH = path.join(os.homedir(), 'Downloads', 'voicenote-pro-484818-6d6db67c7fdb.json');

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const assetsDir = path.join(projectRoot, '.signing', 'play-listing');

const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

const TITLE = 'Rabona';
const SHORT_DESCRIPTION =
  'A social network for the people who miss the old days — friends, walls, photos, pokes.';
const FULL_DESCRIPTION = `Rabona is a social network — open to anyone, inspired by early Facebook.

Write short updates and posts your friends can read, like, and comment on. Send friend requests, build your circle, and message anyone privately. Every profile has a wall where friends can post photos, videos, and notes.

FEATURES
• Friends — send requests, accept invites, share your invite link
• The Wall — friends post on your profile, you post on theirs
• Photos & Videos — share what you're up to
• Direct Messages — private 1-on-1 conversations
• Pokes — a low-pressure way to say hi
• Notifications — never miss a like, comment, or friend request
• Friend Network — see your social circle as an interactive graph
• Privacy controls — pick exactly which profile fields are public

Sign in with Google or email to get started in seconds.`;

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.sign('sha256', Buffer.from(data), sa.private_key);
  const assertion = `${data}.${b64url(sig)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Token request failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

const token = await getAccessToken();
console.log('Got Play API access token');

const baseUrl = `https://www.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
const uploadBaseUrl = `https://www.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}`;
const headers = { Authorization: `Bearer ${token}` };

async function api(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...headers, ...extraHeaders, ...(body && !extraHeaders['Content-Type'] ? { 'Content-Type': 'application/json' } : {}) },
    body: body && (typeof body === 'string' || body instanceof Uint8Array) ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}\n${text}`);
  return json;
}

console.log('\n[1/5] Creating edit transaction...');
const edit = await api('POST', `${baseUrl}/edits`);
const editId = edit.id;
console.log(`  editId=${editId}, expires in ${edit.expiryTimeSeconds}s`);

console.log('\n[2/5] Setting en-US listing...');
await api('PUT', `${baseUrl}/edits/${editId}/listings/${LANG}`, {
  language: LANG,
  title: TITLE,
  shortDescription: SHORT_DESCRIPTION,
  fullDescription: FULL_DESCRIPTION,
});
console.log('  done');

async function uploadImage(imageType, filePath) {
  const bytes = fs.readFileSync(filePath);
  const url = `${uploadBaseUrl}/edits/${editId}/listings/${LANG}/${imageType}?uploadType=media`;
  console.log(`  uploading ${imageType}: ${path.basename(filePath)} (${(bytes.length / 1024).toFixed(0)} KB)`);
  return api('POST', url, bytes, { 'Content-Type': 'image/png' });
}

console.log('\n[3/5] Replacing image assets...');
// Delete existing images first so we don't accumulate.
for (const imageType of ['icon', 'featureGraphic', 'phoneScreenshots']) {
  try {
    await api('DELETE', `${baseUrl}/edits/${editId}/listings/${LANG}/${imageType}`);
    console.log(`  cleared ${imageType}`);
  } catch (e) {
    // Probably no existing image — that's fine.
    console.log(`  ${imageType}: no existing image to clear`);
  }
}

await uploadImage('icon', path.join(assetsDir, 'icon-512.png'));
await uploadImage('featureGraphic', path.join(assetsDir, 'feature-graphic-1024x500.png'));

const phoneShots = fs
  .readdirSync(path.join(assetsDir, 'phone'))
  .filter((f) => f.endsWith('.png'))
  .sort();
for (const f of phoneShots) {
  await uploadImage('phoneScreenshots', path.join(assetsDir, 'phone', f));
}

console.log('\n[4/5] Validating edit...');
await api('POST', `${baseUrl}/edits/${editId}:validate`);
console.log('  validation passed');

console.log('\n[5/5] Committing edit...');
const committed = await api('POST', `${baseUrl}/edits/${editId}:commit`);
console.log(`  committed (id=${committed.id}, no longer editable)`);

console.log('\nDone. Check the listing at https://play.google.com/console');
