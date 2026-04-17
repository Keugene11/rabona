'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, UserCheck, UserX } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types'
import { HIDDEN_EMAILS } from '@/lib/constants'

export default function FriendsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [friends, setFriends] = useState<Profile[]>([])
  const [requests, setRequests] = useState<{ id: string; profile: Profile }[]>([])
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

    // Load accepted friends (either direction)
    const { data: friendData } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })

    if (friendData) {
      setFriends(friendData.map(f =>
        (f.requester_id === user.id ? f.addressee : f.requester) as unknown as Profile
      ).filter(p => !HIDDEN_EMAILS.includes(p.email || '')))
    }

    // Load pending friend requests (sent to me)
    const { data: requestData } = await supabase
      .from('friendships')
      .select('id, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (requestData) {
      setRequests(requestData.map(r => ({
        id: r.id,
        profile: r.requester as unknown as Profile,
      })).filter(r => !HIDDEN_EMAILS.includes(r.profile.email || '')))
    }

    setLoading(false)
  }

  async function acceptRequest(friendshipId: string, requesterId: string) {
    await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
    await supabase.from('notifications').insert({
      user_id: requesterId,
      actor_id: userId,
      type: 'friend_accept',
    })
    const accepted = requests.find(r => r.id === friendshipId)
    if (accepted) {
      setFriends(prev => [accepted.profile, ...prev])
    }
    setRequests(prev => prev.filter(r => r.id !== friendshipId))
  }

  async function declineRequest(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setRequests(prev => prev.filter(r => r.id !== friendshipId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  function UserRow({ user: u }: { user: Profile }) {
    return (
      <Link href={`/profile/${u.id}`} className="press block">
        <div className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:bg-bg-card-hover transition-colors">
          <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                {u.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold truncate">{u.full_name}</p>
            <p className="text-[12px] text-text-muted truncate">
              {u.major}{u.class_year ? ` '${u.class_year.toString().slice(-2)}` : ''}
            </p>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 ">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Friends</h1>
        <div className="accent-bar" />
      </div>

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
          Requests{requests.length > 0 ? ` (${requests.length})` : ''}
        </button>
      </div>

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-text-muted text-[14px]">No friends yet. Use the directory to find people.</p>
            </div>
          ) : (
            friends.map(u => <UserRow key={u.id} user={u} />)
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-text-muted text-[14px]">No pending friend requests.</p>
            </div>
          ) : (
            requests.map(r => (
              <div key={r.id} className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                <Link href={`/profile/${r.profile.id}`} className="press flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden">
                    {r.profile.avatar_url ? (
                      <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                        {r.profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${r.profile.id}`} className="press">
                    <p className="text-[14px] font-semibold truncate hover:underline">{r.profile.full_name}</p>
                  </Link>
                  <p className="text-[12px] text-text-muted truncate">
                    {r.profile.major}{r.profile.class_year ? ` '${r.profile.class_year.toString().slice(-2)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptRequest(r.id, r.profile.id)}
                    className="bg-accent text-white rounded-xl py-1.5 px-3 text-[12px] font-medium press flex items-center gap-1"
                  >
                    <UserCheck size={12} /> Accept
                  </button>
                  <button
                    onClick={() => declineRequest(r.id)}
                    className="bg-bg-input border border-border rounded-xl py-1.5 px-3 text-[12px] font-medium press flex items-center"
                  >
                    <UserX size={12} />
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
