import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const target = 'evha1magma@gmail.com';
const domain = target.split('@')[1].toLowerCase();

const { data: domains } = await s.from('auth_email_allowed_domains').select('*');
console.log('allowed domains:', domains);

const { data: allowlist } = await s.from('auth_email_allowlist').select('*').ilike('email', target);
console.log('\nallowlist match for', target, ':', allowlist);

const { data: gmailMatch } = await s.from('auth_email_allowed_domains').select('*').eq('domain', domain);
console.log('\ndomain match for', domain, ':', gmailMatch);
