'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Friendship, Profile } from '@/types'

export default function FriendsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [friends, setFriends] = useState<(Friendship & { friend: Profile })[]>([])
  const [requests, setRequests] = useState<(Friendship & { requester: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Load accepted friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })

    if (friendships) {
      setFriends(friendships.map(f => ({
        ...f,
        friend: (f.requester_id === user.id ? f.addressee : f.requester) as Profile,
      })) as (Friendship & { friend: Profile })[])
    }

    // Load pending requests (where I am the addressee)
    const { data: pending } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (pending) {
      setRequests(pending as (Friendship & { requester: Profile })[])
    }

    setLoading(false)
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
    loadData()
  }

  async function declineRequest(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setRequests(requests.filter(r => r.id !== friendshipId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 ">
      <h1 className="text-[24px] font-bold tracking-tight mb-4">Friends</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-input rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors press ${
            tab === 'friends' ? 'bg-bg-card shadow-sm text-text' : 'text-text-muted'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors press ${
            tab === 'requests' ? 'bg-bg-card shadow-sm text-text' : 'text-text-muted'
          }`}
        >
          Requests {requests.length > 0 && `(${requests.length})`}
        </button>
      </div>

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-text-muted text-[14px]">No friends yet. Use the directory to find people.</p>
            </div>
          ) : (
            friends.map(f => (
              <Link key={f.id} href={`/profile/${f.friend.id}`} className="press block">
                <div className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:bg-bg-card-hover transition-colors">
                  <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                    {f.friend.avatar_url ? (
                      <img src={f.friend.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                        {f.friend.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold truncate">{f.friend.full_name}</p>
                    <p className="text-[12px] text-text-muted truncate">
                      {f.friend.major}{f.friend.class_year ? ` '${f.friend.class_year.toString().slice(-2)}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-text-muted text-[14px]">No pending requests.</p>
            </div>
          ) : (
            requests.map(r => (
              <div key={r.id} className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                <Link href={`/profile/${r.requester.id}`} className="press flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden">
                    {r.requester.avatar_url ? (
                      <img src={r.requester.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                        {r.requester.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${r.requester.id}`} className="text-[14px] font-semibold hover:underline truncate block">
                    {r.requester.full_name}
                  </Link>
                  <p className="text-[12px] text-text-muted">{r.requester.major}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptRequest(r.id)}
                    className="bg-accent text-white rounded-xl px-3 py-1.5 text-[12px] font-medium press"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineRequest(r.id)}
                    className="bg-bg-input border border-border rounded-xl px-3 py-1.5 text-[12px] font-medium press"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
