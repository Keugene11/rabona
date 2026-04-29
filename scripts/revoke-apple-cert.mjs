#!/usr/bin/env node
// Revokes a distribution certificate by ID (passed as argv[2]).

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const certId = process.argv[2];
if (!certId) {
  console.error('Usage: node scripts/revoke-apple-cert.mjs <certId>');
  process.exit(1);
}

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

const res = await fetch(`https://api.appstoreconnect.apple.com/v1/certificates/${certId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${jwt()}` },
});
if (!res.ok) {
  console.error(`DELETE failed: ${res.status}\n${await res.text()}`);
  process.exit(1);
}
console.log(`Revoked ${certId}`);
