#!/usr/bin/env node
// Final-touches script:
//   1. Sets app-level privacy policy URL (en-US appInfoLocalization)
//   2. Sets age rating declaration to "12+" (sensible default for a social
//      network with mild user-generated content)
//   3. If a build for v1.0 is finished processing, attaches it to v1.0
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
const PRIVACY_POLICY_URL = 'https://rabona.live/privacy';

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
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}\n${text}`);
  return json;
}

async function main() {
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error('App not found');
  console.log(`App: ${app.id}  ${app.attributes.name}`);

  const versions = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=50`);
  const v = (versions.data || []).find((x) => x.attributes.versionString === VERSION_STRING);
  if (!v) throw new Error(`Version ${VERSION_STRING} not found`);
  console.log(`Version: ${v.id}  state=${v.attributes.appStoreState}`);

  console.log('\n[1/3] Setting privacy policy URL on appInfoLocalization...');
  const appInfos = await api('GET', `/v1/apps/${app.id}/appInfos`);
  const appInfo =
    (appInfos.data || []).find((x) => x.attributes.appStoreState !== 'READY_FOR_SALE') ||
    appInfos.data?.[0];
  if (!appInfo) throw new Error('No appInfo found');
  console.log(`  appInfo: ${appInfo.id}`);
  const infoLocs = await api('GET', `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`);
  const infoLoc = (infoLocs.data || []).find((l) => l.attributes.locale === 'en-US');
  if (!infoLoc) {
    console.warn('  en-US appInfoLocalization not found; creating one...');
    const created = await api('POST', '/v1/appInfoLocalizations', {
      data: {
        type: 'appInfoLocalizations',
        attributes: { locale: 'en-US', privacyPolicyUrl: PRIVACY_POLICY_URL },
        relationships: { appInfo: { data: { type: 'appInfos', id: appInfo.id } } },
      },
    });
    console.log(`  created (id=${created.data.id})`);
  } else {
    await api('PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, {
      data: {
        type: 'appInfoLocalizations',
        id: infoLoc.id,
        attributes: { privacyPolicyUrl: PRIVACY_POLICY_URL },
      },
    });
    console.log(`  patched ${infoLoc.id} with privacyPolicyUrl=${PRIVACY_POLICY_URL}`);
  }

  console.log('\n[2/3] Setting age rating declaration (target: 12+)...');
  // Apple categorizes age rating responses by frequency:
  // NONE, INFREQUENT_OR_MILD, FREQUENT_OR_INTENSE.
  // For a social network with light UGC, "infrequent/mild mature themes"
  // typically lands at 12+.
  const ageRel = await api('GET', `/v1/appInfos/${appInfo.id}/ageRatingDeclaration`);
  const ageId = ageRel?.data?.id;
  if (!ageId) {
    console.warn('  no ageRatingDeclaration found; skipping');
  } else {
    await api('PATCH', `/v1/ageRatingDeclarations/${ageId}`, {
      data: {
        type: 'ageRatingDeclarations',
        id: ageId,
        attributes: {
          alcoholTobaccoOrDrugUseOrReferences: 'NONE',
          contests: 'NONE',
          gamblingSimulated: 'NONE',
          horrorOrFearThemes: 'NONE',
          matureOrSuggestiveThemes: 'INFREQUENT_OR_MILD',
          medicalOrTreatmentInformation: 'NONE',
          profanityOrCrudeHumor: 'INFREQUENT_OR_MILD',
          sexualContentGraphicAndNudity: 'NONE',
          sexualContentOrNudity: 'NONE',
          violenceCartoonOrFantasy: 'NONE',
          violenceRealistic: 'NONE',
          violenceRealisticProlongedGraphicOrSadistic: 'NONE',
          // Newer (2025+) required attributes — these are booleans, not enums
          parentalControls: false,
          healthOrWellnessTopics: false,
          lootBox: false,
          userGeneratedContent: true,
          gunsOrOtherWeapons: 'NONE',
          gambling: false,
          advertising: false,
          ageAssurance: false,
          messagingAndChat: true,
          unrestrictedWebAccess: false,
          kidsAgeBand: null,
        },
      },
    });
    console.log(`  patched ageRatingDeclaration ${ageId}`);
  }

  console.log('\n[3/3] Looking for processed builds for v1.0...');
  const builds = await api(
    'GET',
    `/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${VERSION_STRING}&limit=20&sort=-uploadedDate`,
  );
  const list = builds.data || [];
  console.log(`  ${list.length} build(s) found:`);
  for (const b of list) {
    console.log(`    - ${b.id}  v${b.attributes.version}  state=${b.attributes.processingState}  uploaded=${b.attributes.uploadedDate}`);
  }
  const processed = list.find((b) => b.attributes.processingState === 'VALID');
  if (!processed) {
    console.log('  No processed build yet. Apple still processing — re-run this script in 10–20 min.');
  } else {
    console.log(`\n  Attaching build ${processed.id} to v${VERSION_STRING}...`);
    await api('PATCH', `/v1/appStoreVersions/${v.id}/relationships/build`, {
      data: { type: 'builds', id: processed.id },
    });
    console.log('  attached');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
