// Column list for PostgREST SELECTs on the `profiles` table.
// Excludes email, which is revoked at the column level and must be fetched
// via the `get_profile_contact` RPC.
export const PROFILE_PUBLIC_COLUMNS =
  'id, full_name, username, avatar_url, about_me, ' +
  'onboarding_complete, hidden_from_directory, ' +
  'notif_friend_requests, notif_pokes, notif_wall_posts, notif_likes, ' +
  'notif_comments, messages_from, wall_posts_from, created_at, ' +
  'updated_at, last_seen'
