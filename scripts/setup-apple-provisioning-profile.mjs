#!/usr/bin/env node
// Creates an IOS_APP_STORE provisioning profile for live.rabona.app via the
// App Store Connect API, links it to our distribution certificate, and
// writes the profile content (base64) so it can be added as the GitHub
// secret IOS_DIST_PROFILE_BASE64.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';
const PROFILE_NAME = 'Rabona App Store';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const signingDir = path.join(projectRoot, '.signing');
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

const token = jwt();
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(method, pathname, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}\n${text}`);
  }
  return json;
}

async function main() {
  console.log('Looking up bundle ID record...');
  const bundleIds = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}`);
  const bundleRec = (bundleIds.data || []).find((b) => b.attributes?.identifier === BUNDLE_ID);
  if (!bundleRec) throw new Error(`Bundle ID ${BUNDLE_ID} not found.`);
  console.log(`  bundle id record: ${bundleRec.id}`);

  console.log('\nFinding latest active DISTRIBUTION cert...');
  const certs = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200');
  const active = (certs.data || []).filter((c) => new Date(c.attributes.expirationDate) > new Date());
  active.sort((a, b) => new Date(b.attributes.expirationDate) - new Date(a.attributes.expirationDate));
  const cert = active[0];
  if (!cert) throw new Error('No active distribution cert.');
  console.log(`  cert: ${cert.id}  ${cert.attributes.name}  exp=${cert.attributes.expirationDate}`);

  console.log('\nDeleting any existing profiles with the same name...');
  const existing = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=200`);
  for (const p of existing.data || []) {
    console.log(`  deleting ${p.id} (${p.attributes.name})`);
    await api('DELETE', `/v1/profiles/${p.id}`);
  }

  console.log('\nCreating new IOS_APP_STORE provisioning profile...');
  const created = await api('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleRec.id } },
        certificates: { data: [{ type: 'certificates', id: cert.id }] },
      },
    },
  });

  const profile = created.data;
  console.log(`  profile id: ${profile.id}`);
  console.log(`  uuid:       ${profile.attributes.uuid}`);
  console.log(`  expires:    ${profile.attributes.expirationDate}`);

  const profileBase64 = profile.attributes.profileContent;
  const profileBytes = Buffer.from(profileBase64, 'base64');
  const outPath = path.join(signingDir, 'rabona_app_store.mobileprovision');
  fs.writeFileSync(outPath, profileBytes);
  console.log(`\n  saved → ${outPath}`);

  // Append to existing github-secrets.txt
  const secretsPath = path.join(signingDir, 'github-secrets.txt');
  const append = `\nIOS_DIST_PROFILE_BASE64=\n${profileBase64}\n\nIOS_DIST_PROFILE_NAME=${PROFILE_NAME}\nIOS_DIST_PROFILE_UUID=${profile.attributes.uuid}\n`;
  fs.appendFileSync(secretsPath, append);
  console.log(`  appended secret values to ${secretsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
