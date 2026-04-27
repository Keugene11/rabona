'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, UserCheck, UserX, Search, UserPlus } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import InviteLinkCard from '@/components/InviteLinkCard'

export default function FriendsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [self, setSelf] = useState<Profile | null>(null)
  const [friends, setFriends] = useState<Profile[]>([])
  const [requests, setRequests] = useState<{ id: string; profile: Profile }[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [query, setQuery] = useState('')
  const [addHandle, setAddHandle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; message: string }>({ kind: 'idle', message: '' })

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Load self for the top card + invite link.
    const { data: me } = await supabase
      .from('profiles')
      .select(PROFILE_PUBLIC_COLUMNS)
      .eq('id', user.id)
      .maybeSingle<Profile>()
    if (me) setSelf(me)

    // Load accepted friends (either direction)
    const { data: friendData } = await supabase
      .from('friendships')
      .select(`requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_PUBLIC_COLUMNS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })

    if (friendData) {
      setFriends(friendData.map(f =>
        (f.requester_id === user.id ? f.addressee : f.requester) as unknown as Profile
      ).filter(p => !p.hidden_from_directory))
    }

    // Load pending friend requests (sent to me)
    const { data: requestData } = await supabase
      .from('friendships')
      .select(`id, requester:profiles!friendships_requester_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (requestData) {
      setRequests(requestData.map(r => ({
        id: r.id,
        profile: r.requester as unknown as Profile,
      })).filter(r => !r.profile.hidden_from_directory))
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

  async function addFriend(e: React.FormEvent) {
    e.preventDefault()
    const handle = addHandle.trim().replace(/^@/, '').toLowerCase()
    if (!handle) return
    setAdding(true)
    setAddStatus({ kind: 'idle', message: '' })

    try {
      const { data: target } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('username', handle)
        .maybeSingle()

      if (!target) {
        setAddStatus({ kind: 'err', message: `No user @${handle}` })
        return
      }
      if (target.id === userId) {
        setAddStatus({ kind: 'err', message: "That's you" })
        return
      }

      const { data: existing } = await supabase
        .from('friendships')
        .select('status, requester_id')
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${userId})`)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'accepted') {
          setAddStatus({ kind: 'err', message: `Already friends with @${handle}` })
        } else if (existing.requester_id === userId) {
          setAddStatus({ kind: 'err', message: `Request to @${handle} already sent` })
        } else {
          setAddStatus({ kind: 'err', message: `@${handle} already sent you a request — see Requests` })
        }
        return
      }

      const { error } = await supabase.from('friendships').insert({
        requester_id: userId,
        addressee_id: target.id,
        status: 'pending',
      })
      if (error) {
        setAddStatus({ kind: 'err', message: 'Could not send request' })
        return
      }

      await supabase.from('notifications').insert({
        user_id: target.id,
        actor_id: userId,
        type: 'friend_request',
      })

      setAddStatus({ kind: 'ok', message: `Request sent to @${handle}` })
      setAddHandle('')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  function UserRow({ user: u, trailing }: { user: Profile; trailing?: React.ReactNode }) {
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
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold truncate">{u.full_name}</p>
            <p className="text-[12px] text-text-muted truncate">
              {u.major}{u.class_year ? ` '${u.class_year.toString().slice(-2)}` : ''}
            </p>
          </div>
          {trailing}
        </div>
      </Link>
    )
  }

  const q = query.trim().toLowerCase()
  const filteredFriends = q
    ? friends.filter(f => f.full_name?.toLowerCase().includes(q))
    : friends
  const showSelf = self && (!q || self.full_name?.toLowerCase().includes(q))

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Friends</h1>
        <div className="accent-bar" />
      </div>

      {self?.username && <InviteLinkCard username={self.username} className="mb-3" />}

      {/* Add friend by @handle */}
      <form onSubmit={addFriend} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[14px]">@</span>
            <input
              type="text"
              value={addHandle}
              onChange={(e) => { setAddHandle(e.target.value); setAddStatus({ kind: 'idle', message: '' }) }}
              placeholder="username"
              autoComplete="off"
              autoCapitalize="none"
              className="w-full bg-bg-card border border-border rounded-xl pl-8 pr-3 py-2.5 text-[14px] outline-none focus:border-text-muted transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !addHandle.trim()}
            className="press bg-accent text-white font-semibold text-[13px] px-4 rounded-xl flex items-center gap-1.5 disabled:opacity-40"
          >
            <UserPlus size={14} /> Add
          </button>
        </div>
        {addStatus.message && (
          <p className={`text-[12px] mt-2 ${addStatus.kind === 'ok' ? 'text-text' : 'text-text-muted'}`}>
            {addStatus.message}
          </p>
        )}
      </form>

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
        <>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
            />
          </div>

          <div className="space-y-2">
            {showSelf && self && (
              <UserRow
                user={self}
                trailing={<span className="text-[11px] text-text-muted font-medium px-2 py-0.5 rounded-full bg-bg-input">You</span>}
              />
            )}
            {filteredFriends.map(u => <UserRow key={u.id} user={u} />)}
            {!showSelf && filteredFriends.length === 0 && (
              <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
                <p className="text-text-muted text-[14px]">
                  {friends.length === 0
                    ? 'No friends yet. Share your invite link above to get started.'
                    : 'No friends match that name.'}
                </p>
              </div>
            )}
          </div>
        </>
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
