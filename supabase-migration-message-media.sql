-- Adds media_url column to messages so users can attach photos to DMs.
-- Non-destructive: adds a nullable column, no data is touched.

alter table messages add column if not exists media_url text;
