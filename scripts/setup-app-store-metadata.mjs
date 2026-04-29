#!/usr/bin/env node
// Populates App Store metadata for live.rabona.app via the App Store Connect API:
//   - Finds (or creates) the v1.0 App Store version
//   - Sets en-US description, keywords, promo text, support URL, marketing URL
//   - Sets primary category to Social Networking
//   - Sets copyright
//
// Re-runnable. Will overwrite existing values.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'B53WPHJTLN';
const ISSUER_ID = 'e30fca41-01fd-4020-9b38-9bbde2b0ed44';
const BUNDLE_ID = 'live.rabona.app';

const VERSION_STRING = '1.0';
const COPYRIGHT = `${new Date().getFullYear()} Keugene Lee`;
const SUPPORT_URL = 'https://rabona.live';
const MARKETING_URL = 'https://rabona.live';
const PRIMARY_CATEGORY = 'SOCIAL_NETWORKING';

const PROMO_TEXT =
  'Connect with friends, write on each other’s walls, share photos, send messages, and poke people just for fun. A social network for the people who miss the old days.';

const DESCRIPTION = `Rabona is a social network — open to anyone, inspired by early Facebook.

Write short updates and posts your friends can read, like, and comment on. Send friend requests, build your circle, and message anyone privately. Every profile has a wall where friends can post photos, videos, and notes.

FEATURES
• Friends — send requests, accept invites, share your invite link
• The Wall — friends post on your profile, you post on theirs
• Photos & Videos — share what you’re up to
• Direct Messages — private 1-on-1 conversations
• Pokes — a low-pressure way to say hi
• Notifications — never miss a like, comment, or friend request
• Friend Network — see your social circle as an interactive graph
• Privacy controls — pick exactly which profile fields are public

Sign in with Apple or Google to get started in seconds.`;

// Apple keywords field is 100 chars max, comma-separated, no spaces after commas.
const KEYWORDS = 'social,friends,messaging,wall,profile,network,chat,photos,posts,community,connect,poke';

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
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(method, pathname, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}\n${text}`);
  return json;
}

async function main() {
  console.log(`Looking up app with bundle ID ${BUNDLE_ID}...`);
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error('App not found in App Store Connect. Did you create the app record?');
  console.log(`  app id: ${app.id}  name="${app.attributes.name}"  primaryLocale=${app.attributes.primaryLocale}`);

  console.log('\nUpdating copyright on the app...');
  // Copyright lives on appInfo / app.attributes -- it's settable on the app directly via PATCH /v1/apps/{id}.
  // But the actual editable field is on the app's attributes.
  // We'll do this through appStoreVersion only since that's where it shows in the listing.

  console.log('\nLooking up app store versions...');
  const versions = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=50`);
  let v = (versions.data || []).find((x) => x.attributes.versionString === VERSION_STRING);
  if (!v) {
    console.log(`  v${VERSION_STRING} not found, creating...`);
    const created = await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: VERSION_STRING, copyright: COPYRIGHT },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    });
    v = created.data;
    console.log(`  created v${VERSION_STRING} (id=${v.id})`);
  } else {
    console.log(`  found v${VERSION_STRING} (id=${v.id}, state=${v.attributes.appStoreState})`);
    console.log('  patching copyright...');
    await api('PATCH', `/v1/appStoreVersions/${v.id}`, {
      data: { type: 'appStoreVersions', id: v.id, attributes: { copyright: COPYRIGHT } },
    });
  }

  console.log('\nFinding en-US version localization...');
  const locs = await api('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  let loc = (locs.data || []).find((l) => l.attributes.locale === 'en-US');
  if (!loc) {
    console.log('  en-US not found, creating...');
    const created = await api('POST', '/v1/appStoreVersionLocalizations', {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale: 'en-US',
          description: DESCRIPTION,
          keywords: KEYWORDS,
          promotionalText: PROMO_TEXT,
          supportUrl: SUPPORT_URL,
          marketingUrl: MARKETING_URL,
        },
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } },
      },
    });
    loc = created.data;
    console.log(`  created (id=${loc.id})`);
  } else {
    console.log(`  found (id=${loc.id}), patching...`);
    await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: {
          description: DESCRIPTION,
          keywords: KEYWORDS,
          promotionalText: PROMO_TEXT,
          supportUrl: SUPPORT_URL,
          marketingUrl: MARKETING_URL,
        },
      },
    });
    console.log('  patched');
  }

  console.log('\nSetting primary category (Social Networking)...');
  const appInfos = await api('GET', `/v1/apps/${app.id}/appInfos`);
  const pendingAppInfo =
    (appInfos.data || []).find((x) => x.attributes.appStoreState !== 'READY_FOR_SALE') ||
    appInfos.data?.[0];
  if (!pendingAppInfo) {
    console.warn('  no appInfo found, skipping category');
  } else {
    await api('PATCH', `/v1/appInfos/${pendingAppInfo.id}`, {
      data: {
        type: 'appInfos',
        id: pendingAppInfo.id,
        relationships: {
          primaryCategory: { data: { type: 'appCategories', id: PRIMARY_CATEGORY } },
        },
      },
    });
    console.log(`  set on appInfo ${pendingAppInfo.id}`);
  }

  console.log('\nDone. Listing summary:');
  console.log(`  Version:        ${VERSION_STRING}`);
  console.log(`  Copyright:      ${COPYRIGHT}`);
  console.log(`  Category:       Social Networking`);
  console.log(`  Description:    ${DESCRIPTION.length} chars`);
  console.log(`  Keywords:       ${KEYWORDS} (${KEYWORDS.length} chars)`);
  console.log(`  Support URL:    ${SUPPORT_URL}`);
  console.log(`  Marketing URL:  ${MARKETING_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
