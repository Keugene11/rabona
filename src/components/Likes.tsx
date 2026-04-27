'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart } from 'lucide-react'
import { notifyFriends } from '@/lib/notifyFriends'

interface LikesProps {
  postType: string
  postId: string
  userId: string
  authorId: string
}

export default function Likes({ postType, postId, userId, authorId }: LikesProps) {
  const supabase = createClient()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    supabase.from('post_likes')
      .select('id', { count: 'exact' })
      .eq('post_type', postType)
      .eq('post_id', postId)
      .then(({ count: c }) => setCount(c || 0))
    supabase.from('post_likes')
      .select('id')
      .eq('post_type', postType)
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, userId])

  async function toggle() {
    if (!userId) return
    if (liked) {
      await supabase.from('post_likes').delete()
        .eq('post_type', postType)
        .eq('post_id', postId)
        .eq('user_id', userId)
      setLiked(false)
      setCount(c => c - 1)
      // Remove like notifications so they don't pile up
      await supabase.from('notifications').delete()
        .eq('actor_id', userId)
        .eq('post_id', postId)
        .in('type', ['like', 'friend_like'])
    } else {
      await supabase.from('post_likes').insert({
        post_type: postType, post_id: postId, user_id: userId,
      })
      setLiked(true)
      setCount(c => c + 1)
      // Notify post author (delete old first to avoid duplicates)
      if (authorId !== userId) {
        await supabase.from('notifications').delete()
          .eq('actor_id', userId)
          .eq('post_id', postId)
          .eq('type', 'like')
        await supabase.from('notifications').insert({
          user_id: authorId,
          actor_id: userId,
          type: 'like',
          post_type: postType,
          post_id: postId,
        })
      }
      // Notify friends (delete old first, exclude post author)
      await supabase.from('notifications').delete()
        .eq('actor_id', userId)
        .eq('post_id', postId)
        .eq('type', 'friend_like')
      notifyFriends(supabase, userId, 'friend_like', { post_type: postType, post_id: postId },
        authorId !== userId ? [authorId] : [])
    }
  }

  return (
    <button onClick={toggle} className="flex items-center gap-1 text-[11px] press">
      <Heart size={13} className={liked ? 'fill-text text-text' : 'text-text-muted'} />
      <span className={liked ? 'text-text' : 'text-text-muted'}>{count > 0 ? count : ''}</span>
    </button>
  )
}
