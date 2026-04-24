import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

// Order matters. Each migration is idempotent where possible (CREATE OR REPLACE /
// IF NOT EXISTS / CONFLICT DO NOTHING). open-signup runs last so the handle_new_user
// trigger ends up gate-free even though we run the v3 gate migration along the way.
const files = [
  'supabase-migration-profile-columns.sql',
  'supabase-security-hardening.sql',
  'supabase-migration-security-hardening.sql',
  'supabase-migration-owner-protection.sql',
  'supabase-migration-privacy-enforcement.sql',
  'supabase-migration-signup-gate.sql',
  'supabase-migration-signup-gate-v2.sql',
  'supabase-migration-signup-rate-limit.sql',
  'supabase-migration-signup-bot-pattern.sql',
  'supabase-migration-username.sql',
  'supabase-migration-username-cooldown.sql',
  'supabase-migration-message-media.sql',
  'supabase-migration-comment-media.sql',
  'supabase-fix-notifications.sql',
  'supabase-migration-signup-gate-v3.sql',
  'supabase-migration-open-signup.sql',
];

for (const file of files) {
  const sql = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  const ok = res.ok ? 'OK ' : 'FAIL';
  console.log(`${ok} ${file}  (${res.status})`);
  if (!res.ok) {
    console.log(`     ${body.slice(0, 400)}`);
  }
}
