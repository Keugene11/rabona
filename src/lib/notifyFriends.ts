import { SupabaseClient } from '@supabase/supabase-js'

export async function notifyFriends(
  supabase: SupabaseClient,
  actorId: string,
  type: string,
  extra?: { post_type?: string; post_id?: string; comment_id?: string; content?: string },
  exclude?: string[]
) {
  // Get all accepted friends
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${actorId},addressee_id.eq.${actorId}`)
    .eq('status', 'accepted')

  if (!friendships || friendships.length === 0) return

  const excludeSet = new Set(exclude || [])
  const friendIds = friendships
    .map(f => f.requester_id === actorId ? f.addressee_id : f.requester_id)
    .filter(id => !excludeSet.has(id))

  if (friendIds.length === 0) return

  // Batch insert notifications for all friends
  const notifications = friendIds.map(friendId => ({
    user_id: friendId,
    actor_id: actorId,
    type,
    post_type: extra?.post_type || null,
    post_id: extra?.post_id || null,
    comment_id: extra?.comment_id || null,
    content: extra?.content || null,
  }))

  await supabase.from('notifications').insert(notifications)
}
