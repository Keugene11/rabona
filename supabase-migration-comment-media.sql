-- Adds media_url column to comments so users can attach photos/videos to comments and replies.
-- Non-destructive: adds a nullable column, no data is touched.

alter table comments add column if not exists media_url text;
