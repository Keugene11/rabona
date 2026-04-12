import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Delete user data from all tables (order matters for FK constraints)
  const userId = user.id
  await supabase.from('reports').delete().or(`reporter_id.eq.${userId},reported_id.eq.${userId}`)
  await supabase.from('blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
  await supabase.from('notifications').delete().or(`user_id.eq.${userId},actor_id.eq.${userId}`)
  await supabase.from('comment_likes').delete().eq('user_id', userId)
  await supabase.from('post_likes').delete().eq('user_id', userId)
  await supabase.from('profile_views').delete().or(`profile_id.eq.${userId},viewer_id.eq.${userId}`)
  await supabase.from('comments').delete().eq('author_id', userId)
  await supabase.from('wall_posts').delete().or(`author_id.eq.${userId},wall_owner_id.eq.${userId}`)
  await supabase.from('message_likes').delete().eq('user_id', userId)
  await supabase.from('messages').delete().eq('sender_id', userId)
  await supabase.from('conversations').delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
  await supabase.from('pokes').delete().or(`poker_id.eq.${userId},poked_id.eq.${userId}`)
  await supabase.from('friendships').delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  await supabase.from('group_posts').delete().eq('author_id', userId)
  await supabase.from('group_members').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)

  // Delete auth user with service role
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await adminClient.auth.admin.deleteUser(userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
