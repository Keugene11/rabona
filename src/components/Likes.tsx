'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [pop, setPop] = useState(false)
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!userId) return
    if (!liked) {
      setPop(true)
      if (popTimer.current) clearTimeout(popTimer.current)
      popTimer.current = setTimeout(() => setPop(false), 320)
    }
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
    <button
      onClick={toggle}
      aria-label="Like"
      aria-pressed={liked}
      className={`press flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] transition-colors hover:bg-rose-500/10 hover:text-rose-500 ${liked ? 'text-rose-500' : 'text-text-muted'}`}
    >
      <Heart
        size={18}
        strokeWidth={1.75}
        className={`transition-transform duration-300 ease-out ${liked ? 'fill-rose-500 text-rose-500' : ''} ${pop ? 'scale-125' : 'scale-100'}`}
      />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  )
}
