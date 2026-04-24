'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

interface ConversationItem {
  id: string
  other_user: Profile
  last_message_at: string
  last_message_content: string | null
  last_message_sender_id: string | null
  unread: boolean
}

export default function MessagesPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('conversations')
      .select(`*, user1:profiles!conversations_user1_id_fkey(${PROFILE_PUBLIC_COLUMNS}), user2:profiles!conversations_user2_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (data) {
      setConversations(data.map(c => {
        const isUser1 = c.user1_id === user.id
        const myReadAt = isUser1 ? c.user1_read_at : c.user2_read_at
        const hasUnread = c.last_message_sender_id && c.last_message_sender_id !== user.id &&
          (!myReadAt || new Date(c.last_message_at) > new Date(myReadAt))
        return {
          id: c.id,
          other_user: (isUser1 ? c.user2 : c.user1) as Profile,
          last_message_at: c.last_message_at,
          last_message_content: c.last_message_content,
          last_message_sender_id: c.last_message_sender_id,
          unread: !!hasUnread,
        }
      }))
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 ">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Messages</h1>
        <div className="accent-bar" />
      </div>

      {conversations.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <MessageCircle size={32} className="mx-auto text-text-muted mb-2" />
          <p className="text-text-muted text-[14px]">No conversations yet.</p>
          <p className="text-text-muted text-[12px] mt-1">Visit a profile to send a message.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <Link key={c.id} href={`/messages/${c.id}`} className="press block">
              <div className={`bg-bg-card border rounded-2xl p-3 flex items-center gap-3 hover:bg-bg-card-hover transition-colors ${c.unread ? 'border-accent' : 'border-border'}`}>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden">
                    {c.other_user.avatar_url ? (
                      <img src={c.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                        {c.other_user.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  {isOnline(c.other_user.last_seen) ? (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-bg-card" />
                  ) : c.unread ? (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full border-2 border-bg-card" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[14px] truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.other_user.full_name}</p>
                    <span className={`text-[11px] flex-shrink-0 ${c.unread ? 'text-accent font-semibold' : 'text-text-muted'}`}>
                      {getTimeAgo(new Date(c.last_message_at))}
                    </span>
                  </div>
                  {c.last_message_content && (
                    <p className={`text-[12px] truncate mt-0.5 ${c.unread ? 'text-text font-medium' : 'text-text-muted'}`}>
                      {c.last_message_sender_id === c.other_user.id ? '' : 'You: '}{c.last_message_content}
                    </p>
                  )}
                  <p className={`text-[11px] mt-0.5 ${isOnline(c.other_user.last_seen) ? 'text-green-500' : 'text-text-muted'}`}>
                    {getLastSeen(c.other_user.last_seen)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen).getTime()) < 60000
}

function getLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return ''
  const seconds = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000)
  if (seconds < 60) return 'Online now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Active ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Active ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Active yesterday'
  if (days < 7) return `Active ${days}d ago`
  return `Active ${new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
