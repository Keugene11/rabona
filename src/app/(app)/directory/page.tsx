'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Search } from 'lucide-react'
import ProfileCard from '@/components/ProfileCard'
import type { Profile } from '@/types'

export default function DirectoryPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: blocks } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)
      const blocked = new Set((blocks || []).map(b => b.blocked_id))

      const { data: friendData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

      const friendIds = (friendData || [])
        .map(f => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
        .filter(id => !blocked.has(id))

      if (friendIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, major, class_year, last_seen')
        .in('id', friendIds)
        .order('last_seen', { ascending: false, nullsFirst: false })

      if (profiles) setFriends(profiles as Profile[])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = query.trim().toLowerCase()
  const displayList = q
    ? friends.filter(p => p.full_name?.toLowerCase().includes(q))
    : friends

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Directory</h1>
        <div className="accent-bar" />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your friends..."
          className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-text-muted" size={24} />
        </div>
      ) : displayList.length > 0 ? (
        <div className="space-y-2">
          {displayList.map(profile => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-text-muted text-[14px]">
            {friends.length === 0
              ? 'No friends yet. Share your invite link from Home to get started.'
              : 'No friends match that name.'}
          </p>
        </div>
      )}
    </div>
  )
}
