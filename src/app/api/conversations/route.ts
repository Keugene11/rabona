import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetUserId } = await request.json()

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  }

  // Honor the target user's messages_from setting.
  const { data: theirProfile } = await supabase
    .from('profiles')
    .select('messages_from')
    .eq('id', targetUserId)
    .maybeSingle()

  if (theirProfile?.messages_from === 'friends') {
    const { data: friendData } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
      .limit(1)
    if (!friendData || friendData.length === 0) {
      return NextResponse.json({ error: 'This user only accepts messages from friends' }, { status: 403 })
    }
  }

  // Ensure consistent ordering for unique constraint
  const [user1, user2] = [user.id, targetUserId].sort()

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(existing)
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user1_id: user1, user2_id: user2 })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
