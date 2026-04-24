'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import WallPostForm from '@/components/WallPostForm'

interface ComposeModalProps {
  open: boolean
  onClose: () => void
}

interface Me {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

export default function ComposeModal({ open, onClose }: ComposeModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!open) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (data) setMe(data as Me)
    }
    load()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open, supabase])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/30 flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xl bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center px-4 pt-3">
          <button
            onClick={onClose}
            className="press text-[14px] font-semibold text-text hover:text-text-muted px-2 py-1"
          >
            Cancel
          </button>
        </div>

        {me && (
          <div className="flex items-center gap-3 px-5 pt-4">
            <div className="w-11 h-11 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
              {me.avatar_url ? (
                <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                  {me.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold truncate">{me.full_name}</p>
              {me.username && <p className="text-[12px] text-text-muted truncate">@{me.username}</p>}
            </div>
          </div>
        )}

        <div className="px-5 pb-5 pt-3">
          {me ? (
            <WallPostForm
              wallOwnerId={me.id}
              variant="modal"
              onPost={() => {
                onClose()
                if (pathname === '/feed' || pathname.startsWith('/profile')) router.refresh()
                else router.push('/feed')
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
