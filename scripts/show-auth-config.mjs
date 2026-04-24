import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
const data = await res.json();
console.log(`status: ${res.status}\n`);

const rateLimitKeys = Object.keys(data).filter(k => k.toLowerCase().includes('rate') || k.toLowerCase().includes('limit'));
console.log('--- rate-limit-ish keys ---');
for (const k of rateLimitKeys) console.log(`${k}: ${JSON.stringify(data[k])}`);

console.log('\n--- captcha keys ---');
for (const k of Object.keys(data).filter(k => k.toLowerCase().includes('captcha'))) console.log(`${k}: ${JSON.stringify(data[k])}`);

console.log('\n--- signup-related keys ---');
for (const k of Object.keys(data).filter(k => /signup|signin|sign_up|sign_in|confirm|verification/.test(k.toLowerCase()))) console.log(`${k}: ${JSON.stringify(data[k])}`);
