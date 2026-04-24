import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function tryCreate(email, label) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'TestPassword-' + Math.random().toString(36).slice(2, 10),
    email_confirm: true,
  });
  if (error) {
    console.log(`[${label}] ${email} → BLOCKED: ${error.message}`);
    return null;
  }
  console.log(`[${label}] ${email} → CREATED (id=${data.user.id}) — cleaning up`);
  await supabase.auth.admin.deleteUser(data.user.id);
  return data.user.id;
}

console.log('--- should be BLOCKED ---');
await tryCreate('random-bot-' + Date.now() + '@example.com', 'NOT_ALLOWED');
await tryCreate('bot' + Date.now() + '@gmail.com',          'NOT_ALLOWED');

console.log('\n--- should be ALLOWED ---');
await tryCreate('test-sbu-' + Date.now() + '@stonybrook.edu', 'APPROVED_DOMAIN');
await tryCreate('keugenelee11@gmail.com',                      'ALLOWLIST (already exists — may dupe-error, that\'s fine)');
