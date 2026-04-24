import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await supabase.from('profiles').select('email, created_at').gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(10);
console.log('Last 10 signups in last 30 min:');
for (const p of data || []) console.log(`  ${p.created_at.slice(11, 19)}  ${p.email}`);
