'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LastSeenUpdater() {
  const supabase = createClient()

  useEffect(() => {
    let userId: string | null = null

    async function ping() {
      if (document.hidden) return
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        userId = user.id
      }
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)
    }

    ping()
    const interval = setInterval(ping, 30000)
    const onVisible = () => { if (!document.hidden) ping() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [supabase])

  return null
}
