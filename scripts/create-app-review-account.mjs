#!/usr/bin/env node
// Creates a throwaway demo account on rabona.live for Apple's App Review team,
// using the Supabase admin API. Email is auto-confirmed (no verification mail
// click), password is randomly generated. Profile fields are filled with
// reviewer-friendly defaults.
//
// Re-runnable: if the user already exists, the script resets the password
// instead of erroring.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const envPath = path.join(projectRoot, '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('Missing Supabase env vars in .env.local');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REVIEWER_EMAIL = 'keugenelee11+appreview@gmail.com';
const FULL_NAME = 'App Reviewer';
const USERNAME = 'appreviewer';
// Strong random password — base64url, 18 bytes → 24 chars, no Apple-disallowed
// characters, no risk of shell-quoting issues.
const PASSWORD = crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, '');

async function ensureUser() {
  console.log(`Looking up existing user with email ${REVIEWER_EMAIL}...`);
  // Admin listUsers is paginated; we filter client-side. The default page size
  // is fine since we expect very few users with this email.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === REVIEWER_EMAIL.toLowerCase());

  if (existing) {
    console.log(`  found (id=${existing.id}). Resetting password...`);
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return existing.id;
  }

  console.log('  not found. Creating new user (email_confirm=true)...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: REVIEWER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });
  if (error) throw error;
  console.log(`  created (id=${data.user.id})`);
  return data.user.id;
}

async function ensureProfile(userId) {
  console.log('\nUpserting profile fields...');
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: REVIEWER_EMAIL,
        full_name: FULL_NAME,
        username: USERNAME,
        about_me:
          'Demo account for App Store review. This profile is for testing only — please feel free to navigate, post, send messages, etc.',
      },
      { onConflict: 'id' },
    )
    .select();
  if (error) {
    // Username collision is the most likely failure here. Fall back to a
    // numeric suffix so we don't break the script.
    console.warn(`  upsert with username "${USERNAME}" failed (${error.message}); retrying without username`);
    const { error: e2 } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, email: REVIEWER_EMAIL, full_name: FULL_NAME, about_me: 'Demo account for App Store review.' },
        { onConflict: 'id' },
      );
    if (e2) throw e2;
  } else {
    console.log('  done');
  }
}

const userId = await ensureUser();
await ensureProfile(userId);

const out = `\n=========================================\nApple App Review demo account\n=========================================\n  email:    ${REVIEWER_EMAIL}\n  password: ${PASSWORD}\n  user id:  ${userId}\n  full name:${FULL_NAME}\n=========================================\n`;
console.log(out);

// Also save to .signing/ so it's recoverable later (gitignored).
const signingDir = path.join(projectRoot, '.signing');
fs.mkdirSync(signingDir, { recursive: true });
fs.writeFileSync(path.join(signingDir, 'app-review-account.txt'), out);
console.log(`Saved to .signing/app-review-account.txt`);
