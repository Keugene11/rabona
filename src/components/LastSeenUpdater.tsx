'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LastSeenUpdater() {
  const supabase = createClient()

  useEffect(() => {
    async function update() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id)
      }
    }
    update()
  }, [supabase])

  return null
}
