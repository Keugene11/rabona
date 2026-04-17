'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, UserCheck, Loader2, Clock, UserX } from 'lucide-react'

interface FriendButtonProps {
  targetUserId: string
  currentUserId: string
  onStatusChange?: (status: 'none' | 'pending_sent' | 'pending_received' | 'accepted') => void
}

export default function FriendButton({ targetUserId, currentUserId, onStatusChange }: FriendButtonProps) {
  const supabase = createClient()
  const [status, setStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted' | null>(null)
  const [friendshipId, setFriendshipId] = useState('')

  useEffect(() => {
    checkRelationship()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  async function checkRelationship() {
    // Check if I sent a request to them
    const { data: sent } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', currentUserId)
      .eq('addressee_id', targetUserId)
      .maybeSingle()

    if (sent) {
      setFriendshipId(sent.id)
      const s = sent.status === 'accepted' ? 'accepted' : 'pending_sent'
      setStatus(s)
      onStatusChange?.(s)
      return
    }

    // Check if they sent a request to me
    const { data: received } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', targetUserId)
      .eq('addressee_id', currentUserId)
      .maybeSingle()

    if (received) {
      setFriendshipId(received.id)
      const s = received.status === 'accepted' ? 'accepted' : 'pending_received'
      setStatus(s)
      onStatusChange?.(s)
      return
    }

    setStatus('none')
    onStatusChange?.('none')
  }

  async function sendRequest() {
    setStatus(null)
    const { data } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: 'pending',
    }).select('id').single()
    if (data) setFriendshipId(data.id)
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: currentUserId,
      type: 'friend_request',
    })
    setStatus('pending_sent')
    onStatusChange?.('pending_sent')
  }

  async function cancelRequest() {
    setStatus(null)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setFriendshipId('')
    setStatus('none')
    onStatusChange?.('none')
  }

  async function acceptRequest() {
    setStatus(null)
    await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: currentUserId,
      type: 'friend_accept',
    })
    setStatus('accepted')
    onStatusChange?.('accepted')
  }

  async function unfriend() {
    setStatus(null)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setFriendshipId('')
    setStatus('none')
    onStatusChange?.('none')
  }

  if (status === null) {
    return (
      <button disabled className="bg-bg-card border border-border rounded-xl py-2 px-4 text-[13px] font-medium flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin" />
      </button>
    )
  }

  if (status === 'accepted') {
    return (
      <button
        onClick={unfriend}
        className="bg-bg-input border border-border rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2"
      >
        <UserCheck size={14} /> Friends
      </button>
    )
  }

  if (status === 'pending_sent') {
    return (
      <button
        onClick={cancelRequest}
        className="bg-bg-input border border-border rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2 text-text-muted"
      >
        <Clock size={14} /> Requested
      </button>
    )
  }

  if (status === 'pending_received') {
    return (
      <div className="flex gap-2">
        <button
          onClick={acceptRequest}
          className="bg-accent text-white rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2"
        >
          <UserCheck size={14} /> Accept
        </button>
        <button
          onClick={cancelRequest}
          className="bg-bg-input border border-border rounded-xl py-2 px-3 text-[13px] font-medium press flex items-center justify-center"
        >
          <UserX size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={sendRequest}
      className="bg-accent text-white rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2"
    >
      <UserPlus size={14} /> Add Friend
    </button>
  )
}
