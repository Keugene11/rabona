import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Nullify post_id or comment_id on notifications before deleting a post/comment.
// Uses service role because the notification belongs to another user.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()
  const { post_id, post_type, comment_id } = body

  if (!post_id && !comment_id) {
    return NextResponse.json({ error: 'Missing post_id or comment_id' }, { status: 400 })
  }

  // Verify the user owns the post/comment they're cleaning up
  if (post_id && post_type === 'wall_post') {
    const { data: post } = await supabase.from('wall_posts').select('author_id, wall_owner_id').eq('id', post_id).single()
    if (!post || (post.author_id !== user.id && post.wall_owner_id !== user.id)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
  } else if (post_id && post_type === 'group_post') {
    const { data: post } = await supabase.from('group_posts').select('author_id').eq('id', post_id).single()
    if (!post || post.author_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
  } else if (comment_id) {
    const { data: comment } = await supabase.from('comments').select('author_id').eq('id', comment_id).single()
    if (!comment || comment.author_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
  }

  // Use service role to nullify references on notifications belonging to other users
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (post_id) {
    await adminClient.from('notifications').update({ post_id: null }).eq('post_id', post_id).eq('post_type', post_type)
  }
  if (comment_id) {
    await adminClient.from('notifications').update({ comment_id: null }).eq('comment_id', comment_id)
  }

  return NextResponse.json({ success: true })
}
