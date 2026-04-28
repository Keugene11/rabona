'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye } from 'lucide-react'

export default function Impressions({ postType, postId, userId }: { postType: string; postId: string; userId: string }) {
  const supabase = createClient()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (userId) {
      supabase.from('post_impressions').upsert({
        post_type: postType, post_id: postId, user_id: userId,
      }, { onConflict: 'post_type,post_id,user_id' }).then(() => {})
    }
    supabase.from('post_impressions')
      .select('*', { count: 'exact', head: true })
      .eq('post_type', postType)
      .eq('post_id', postId)
      .then(({ count: c }) => setCount(c || 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, userId])

  return (
    <span className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] text-text-muted">
      <Eye size={18} strokeWidth={1.75} />
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
