'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function UsernameRedirectPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const handle = username.toLowerCase().replace(/^@/, '')
    supabase
      .from('profiles')
      .select('id')
      .eq('username', handle)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) router.replace(`/profile/${data.id}`)
        else router.replace('/friends')
      })
  }, [username, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-text-muted" size={24} />
    </div>
  )
}
