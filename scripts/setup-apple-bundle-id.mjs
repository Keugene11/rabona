#!/usr/bin/env node
// Creates the Bundle ID `live.rabona.app` on developer.apple.com via the
// App Store Connect API and enables the Sign in with Apple capability.
//
// Reads the ASC API key from C:/Users/Daniel/Downloads/AuthKey_<KEY_ID>.p8.
// Reuses the same key/issuer/team IDs the GitHub Actions workflow expects.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';
const BUNDLE_NAME = 'Rabona';

const keyPath = path.join(os.homedir(), 'Downloads', `AuthKey_${KEY_ID}.p8`);
const privateKey = fs.readFileSync(keyPath, 'utf8');

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function jwt() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 60 * 15,
    aud: 'appstoreconnect-v1',
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(data), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
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

async function findBundleId(identifier) {
  const q = `?filter[identifier]=${encodeURIComponent(identifier)}&limit=20`;
  const res = await api('GET', `/v1/bundleIds${q}`);
  return (res.data || []).find((b) => b.attributes?.identifier === identifier) || null;
}

async function createBundleId(identifier, name) {
  const res = await api('POST', '/v1/bundleIds', {
    data: {
      type: 'bundleIds',
      attributes: { identifier, name, platform: 'IOS' },
    },
  });
  return res.data;
}

async function listCapabilities(bundleIdRecordId) {
  const res = await api('GET', `/v1/bundleIds/${bundleIdRecordId}/bundleIdCapabilities`);
  return res.data || [];
}

async function enableCapability(bundleIdRecordId, capabilityType, settings) {
  return api('POST', '/v1/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType, ...(settings ? { settings } : {}) },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleIdRecordId } },
      },
    },
  });
}

async function main() {
  console.log(`Looking up bundle ID ${BUNDLE_ID}...`);
  let record = await findBundleId(BUNDLE_ID);
  if (record) {
    console.log(`  already exists (id=${record.id})`);
  } else {
    console.log('  not found, creating...');
    record = await createBundleId(BUNDLE_ID, BUNDLE_NAME);
    console.log(`  created (id=${record.id})`);
  }

  console.log('Checking capabilities...');
  const caps = await listCapabilities(record.id);
  const has = (type) => caps.some((c) => c.attributes?.capabilityType === type);

  if (has('APPLE_ID_AUTH')) {
    console.log('  Sign in with Apple already enabled');
  } else {
    console.log('  enabling Sign in with Apple (primary app ID)...');
    await enableCapability(record.id, 'APPLE_ID_AUTH', [
      {
        key: 'APPLE_ID_AUTH_APP_CONSENT',
        options: [{ key: 'PRIMARY_APP_CONSENT' }],
      },
    ]);
    console.log('  done');
  }

  console.log('\nDone. Bundle ID is ready.');
  console.log('Next: create the App Store Connect app record at');
  console.log('  https://appstoreconnect.apple.com/apps  →  + New App');
  console.log(`  Bundle ID: ${BUNDLE_ID}   SKU: rabona-ios-001   Language: English (U.S.)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
