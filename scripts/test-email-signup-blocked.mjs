// Smoke test: try email/password signup via Supabase REST /auth/v1/signup.
// Expect a non-2xx rejection with the new trigger error.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`;
const fake = `smoke_block_${Date.now()}@stonybrook.edu`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  body: JSON.stringify({ email: fake, password: 'supersecret_test_pw!' }),
});
console.log(`email: ${fake}`);
console.log(`status: ${res.status}`);
console.log(await res.text());
