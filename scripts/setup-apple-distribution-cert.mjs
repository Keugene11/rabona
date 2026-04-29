#!/usr/bin/env node
// Submits .signing/ios_dist.csr to App Store Connect, downloads the resulting
// Apple Distribution certificate, and packages it with .signing/ios_dist.key
// into .signing/ios_dist.p12 using the password in .signing/p12_password.txt.
//
// Outputs base64 strings for the GitHub repo secrets.

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const signingDir = path.join(projectRoot, '.signing');
const csrPath = path.join(signingDir, 'ios_dist.csr');
const keyPath = path.join(signingDir, 'ios_dist.key');
const cerDerPath = path.join(signingDir, 'distribution.cer');
const cerPemPath = path.join(signingDir, 'distribution.pem');
const p12Path = path.join(signingDir, 'ios_dist.p12');
const passwordPath = path.join(signingDir, 'p12_password.txt');
const ascKeyPath = path.join(os.homedir(), 'Downloads', `AuthKey_${KEY_ID}.p8`);

const ascKey = fs.readFileSync(ascKeyPath, 'utf8');
const csrPem = fs.readFileSync(csrPath, 'utf8');
const password = fs.readFileSync(passwordPath, 'utf8').trim();

const csrBase64 = csrPem
  .replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
  .replace(/-----END CERTIFICATE REQUEST-----/, '')
  .replace(/\s+/g, '');

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
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: 'appstoreconnect-v1' };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(data), {
    key: ascKey,
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

async function main() {
  console.log('Listing existing DISTRIBUTION certificates...');
  const existing = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200');
  const active = (existing.data || []).filter((c) => c.attributes?.expirationDate && new Date(c.attributes.expirationDate) > new Date());
  console.log(`  ${active.length} active`);
  for (const c of active) {
    console.log(`    - ${c.id}  name="${c.attributes.name}"  expires=${c.attributes.expirationDate}`);
  }

  console.log('\nSubmitting CSR for new Apple Distribution certificate...');
  const created = await api('POST', '/v1/certificates', {
    data: {
      type: 'certificates',
      attributes: { csrContent: csrBase64, certificateType: 'DISTRIBUTION' },
    },
  });

  const cert = created.data;
  const certBase64 = cert.attributes.certificateContent;
  const derBuf = Buffer.from(certBase64, 'base64');
  fs.writeFileSync(cerDerPath, derBuf);
  console.log(`  saved DER → ${cerDerPath}`);

  console.log('\nConverting DER → PEM via openssl...');
  execFileSync('openssl', ['x509', '-in', cerDerPath, '-inform', 'DER', '-out', cerPemPath, '-outform', 'PEM'], { stdio: 'inherit' });

  console.log('Building .p12 from key + cert...');
  if (fs.existsSync(p12Path)) fs.unlinkSync(p12Path);
  execFileSync(
    'openssl',
    ['pkcs12', '-export', '-legacy', '-inkey', keyPath, '-in', cerPemPath, '-out', p12Path, '-passout', `pass:${password}`],
    { stdio: 'inherit' },
  );
  console.log(`  saved → ${p12Path}`);

  const p12Bytes = fs.readFileSync(p12Path);
  const p12Base64 = p12Bytes.toString('base64');
  const ascP8Base64 = Buffer.from(ascKey, 'utf8').toString('base64');

  const outFile = path.join(signingDir, 'github-secrets.txt');
  const lines = [
    '# Paste these into GitHub → Settings → Secrets and variables → Actions',
    '# Each block below is one secret. Name on the left, value (everything after =) on the right.',
    '',
    'APPLE_TEAM_ID=SDA728W6D9',
    `APP_STORE_CONNECT_API_KEY_ID=${KEY_ID}`,
    `APP_STORE_CONNECT_API_ISSUER_ID=${ISSUER_ID}`,
    `IOS_DIST_CERT_P12_PASSWORD=${password}`,
    '',
    'APP_STORE_CONNECT_API_KEY_BASE64=',
    ascP8Base64,
    '',
    'IOS_DIST_CERT_P12_BASE64=',
    p12Base64,
    '',
  ];
  fs.writeFileSync(outFile, lines.join('\n'));

  console.log('\n=========================================');
  console.log(`GitHub secret values written to: ${outFile}`);
  console.log('=========================================');
  console.log(`Cert: ${cert.attributes.name}, expires ${cert.attributes.expirationDate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
