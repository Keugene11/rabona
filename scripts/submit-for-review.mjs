#!/usr/bin/env node
// Sets App Store Review information (demo account, contact, notes) and then
// attempts to submit v1.0 for App Store review.
//
// If submission fails because App Privacy disclosures aren't filled in, the
// script reports the error and exits non-zero so the user knows what's left.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';
const VERSION_STRING = '1.0';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
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
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  return { ok: res.ok, status: res.status, text, json };
}

async function apiOrThrow(method, pathname, body) {
  const r = await api(method, pathname, body);
  if (!r.ok) throw new Error(`${method} ${pathname} → ${r.status}\n${r.text}`);
  return r.json;
}

async function main() {
  const apps = await apiOrThrow('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error('App not found');
  console.log(`App: ${app.id}  ${app.attributes.name}`);

  const versions = await apiOrThrow('GET', `/v1/apps/${app.id}/appStoreVersions?limit=50`);
  const v = (versions.data || []).find((x) => x.attributes.versionString === VERSION_STRING);
  if (!v) throw new Error(`Version ${VERSION_STRING} not found`);
  console.log(`Version: ${v.id}  state=${v.attributes.appStoreState}`);

  // ========== App Store Review information ==========
  console.log('\n[1/3] Setting App Store Review information (demo creds + notes)...');
  const credsPath = path.join(projectRoot, '.signing', 'app-review-account.txt');
  if (!fs.existsSync(credsPath)) throw new Error('Run create-app-review-account.mjs first.');
  const credsTxt = fs.readFileSync(credsPath, 'utf8');
  const email = credsTxt.match(/email:\s*(\S+)/)?.[1];
  const password = credsTxt.match(/password:\s*(\S+)/)?.[1];
  if (!email || !password) throw new Error('Could not parse demo creds.');

  const REVIEWER_NOTES = `Rabona is a small social network — sign-up is open to anyone, no campus restriction.

Tested on iPhone 16 Pro Max (iOS 17+), iPhone 14 (iOS 16+).

Demo account:
  Email: ${email}
  Password: ${password}

After signing in, you can:
  • View the feed (/feed) — posts from friends
  • Edit your profile (/profile)
  • Browse the directory (/friends)
  • Send a friend request, write on a wall, send a direct message
  • Use the "Pokes" feature — a low-pressure way to ping someone

The whole app is one Capacitor webview wrapping rabona.live. There are no in-app purchases, no third-party advertising, no analytics SDKs. All data is stored in our Supabase backend over HTTPS only.

If you have any questions, please contact keugenelee11@gmail.com.`;

  const detailsRel = await apiOrThrow('GET', `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
  let detailId = detailsRel?.data?.id;
  const reviewAttrs = {
    contactFirstName: 'Keugene',
    contactLastName: 'Lee',
    contactPhone: '+19148394412',
    contactEmail: 'keugenelee11@gmail.com',
    demoAccountName: email,
    demoAccountPassword: password,
    demoAccountRequired: true,
    notes: REVIEWER_NOTES,
  };
  if (!detailId) {
    console.log('  no review details record yet, creating...');
    const created = await apiOrThrow('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails',
        attributes: reviewAttrs,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } },
      },
    });
    detailId = created.data.id;
    console.log(`  created (id=${detailId})`);
  } else {
    console.log(`  found (id=${detailId}), patching...`);
    await apiOrThrow('PATCH', `/v1/appStoreReviewDetails/${detailId}`, {
      data: { type: 'appStoreReviewDetails', id: detailId, attributes: reviewAttrs },
    });
    console.log('  patched');
  }

  // ========== Submit for review ==========
  console.log('\n[2/3] Creating review submission...');
  const platform = 'IOS';
  let submission = null;
  // First, see if there's an open submission already
  const subs = await apiOrThrow('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=${platform}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES,COMPLETE`);
  const open = (subs.data || []).find((s) => ['READY_FOR_REVIEW', 'IN_REVIEW', 'WAITING_FOR_REVIEW'].includes(s.attributes.state));
  if (open) {
    console.log(`  existing submission ${open.id} state=${open.attributes.state}, skipping create`);
    submission = open;
  } else {
    const created = await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    });
    if (!created.ok) {
      console.error(`  create submission failed: ${created.status}`);
      console.error(created.text);
      process.exit(1);
    }
    submission = created.json.data;
    console.log(`  created submission ${submission.id}`);
  }

  // Add the version as an item, if not already added
  console.log('\n  Adding v1.0 as a submission item...');
  const items = await apiOrThrow('GET', `/v1/reviewSubmissions/${submission.id}/items`);
  const hasItem = (items.data || []).some((it) => it.relationships?.appStoreVersion?.data?.id === v.id);
  if (hasItem) {
    console.log('    already has v1.0 as an item, skipping');
  } else {
    const itemRes = await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } },
        },
      },
    });
    if (!itemRes.ok) {
      console.error(`    add item failed: ${itemRes.status}`);
      console.error(itemRes.text);
      process.exit(1);
    }
    console.log(`    item added (${itemRes.json.data.id})`);
  }

  console.log('\n[3/3] Submitting for review...');
  const submitRes = await api('PATCH', `/v1/reviewSubmissions/${submission.id}`, {
    data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
  });
  if (!submitRes.ok) {
    console.error(`  submission failed: ${submitRes.status}`);
    console.error(submitRes.text);
    console.error('\n  Common cause: App Privacy disclosures not filled in.');
    console.error(`  Fill them at https://appstoreconnect.apple.com/apps/${app.id}/distribution/privacy`);
    console.error('  then re-run this script.');
    process.exit(2);
  }
  console.log('  ✓ Submitted! Apple typically reviews social apps in 24–48h.');
  console.log(`  https://appstoreconnect.apple.com/apps/${app.id}/distribution/ios/version/inflight`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
