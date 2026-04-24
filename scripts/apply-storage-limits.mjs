// Hardens storage buckets against abuse by setting per-bucket file_size_limit
// and allowed_mime_types. This matches what the existing upload flows need:
//   avatars — images only, up to 5 MB (we compress in the client to ~500 KB)
//   posts   — images + short videos, up to 25 MB
//
// Does NOT delete any existing data. Rejects new uploads that exceed limits.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const limits = {
  avatars: { file_size_limit: 5 * 1024 * 1024, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  posts:   { file_size_limit: 25 * 1024 * 1024, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'] },
};

for (const [name, cfg] of Object.entries(limits)) {
  const { data, error } = await s.storage.updateBucket(name, { public: true, fileSizeLimit: cfg.file_size_limit, allowedMimeTypes: cfg.allowed_mime_types });
  if (error) console.log(`  ${name}: ERROR ${error.message}`);
  else console.log(`  ${name}: limit ${(cfg.file_size_limit / 1024 / 1024).toFixed(0)} MB, mimes [${cfg.allowed_mime_types.join(', ')}]`);
}
