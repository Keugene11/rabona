'use client'

import { useState, useEffect, useRef, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowLeft, Send, Heart, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import type { Message, Profile } from '@/types'

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = use(params)
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null)
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialScrollDone = useRef(false)

  function scrollToBottom(instant: boolean) {
    const el = scrollRef.current
    if (!el) return
    if (instant) {
      el.scrollTop = el.scrollHeight
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    initialScrollDone.current = false
    loadChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Scroll when messages change
  useEffect(() => {
    if (messages.length === 0) return
    if (!initialScrollDone.current) {
      // For initial load, keep retrying until scroll is at bottom
      const tryScroll = () => {
        const el = scrollRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
        // Verify it worked — if not, try again (images may still be loading)
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 10) {
          requestAnimationFrame(tryScroll)
        } else {
          initialScrollDone.current = true
        }
      }
      requestAnimationFrame(tryScroll)
    } else {
      scrollToBottom(false)
    }
  }, [messages])

  // Realtime subscription — separate effect with proper cleanup
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  async function loadChat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: conv } = await supabase
      .from('conversations')
      .select('*, user1:profiles!conversations_user1_id_fkey(*), user2:profiles!conversations_user2_id_fkey(*)')
      .eq('id', conversationId)
      .single()

    if (conv) {
      // Verify current user is a participant
      if (conv.user1_id !== user.id && conv.user2_id !== user.id) return
      const isUser1 = conv.user1_id === user.id
      setOtherUser((isUser1 ? conv.user2 : conv.user1) as Profile)
      setOtherReadAt(isUser1 ? conv.user2_read_at : conv.user1_read_at)

      // Mark conversation as read
      await supabase.from('conversations').update(
        isUser1 ? { user1_read_at: new Date().toISOString() } : { user2_read_at: new Date().toISOString() }
      ).eq('id', conversationId)
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgs) {
      setMessages(msgs as Message[])
      // Load likes for all messages
      const msgIds = msgs.map(m => m.id)
      if (msgIds.length > 0) {
        const { data: likes } = await supabase
          .from('message_likes')
          .select('message_id, user_id')
          .in('message_id', msgIds)
        if (likes) {
          const myLikes = new Set<string>()
          const counts: Record<string, number> = {}
          likes.forEach(l => {
            counts[l.message_id] = (counts[l.message_id] || 0) + 1
            if (l.user_id === user.id) myLikes.add(l.message_id)
          })
          setLikedMessages(myLikes)
          setLikeCounts(counts)
        }
      }
    }

    setLoading(false)
    // Focus input after load
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || sending) return

    setSending(true)
    const text = content.trim()
    setContent('')

    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
    }).select().single()

    if (!error && data) {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev
        return [...prev, data as Message]
      })
    }

    // last_message_* columns on conversations are populated by a DB trigger
    // on messages INSERT. The sender's read timestamp is also set by the trigger.

    // Create inbox notification with message content
    if (otherUser) {
      await supabase.from('notifications').insert({
        user_id: otherUser.id,
        actor_id: currentUserId,
        type: 'message',
        content: text,
      })
    }

    setSending(false)
    inputRef.current?.focus()
  }

  async function toggleLikeMessage(messageId: string) {
    if (likedMessages.has(messageId)) {
      await supabase.from('message_likes').delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
      setLikedMessages(prev => { const s = new Set(prev); s.delete(messageId); return s })
      setLikeCounts(prev => ({ ...prev, [messageId]: (prev[messageId] || 1) - 1 }))
    } else {
      await supabase.from('message_likes').insert({
        message_id: messageId,
        user_id: currentUserId,
      })
      setLikedMessages(prev => new Set([...prev, messageId]))
      setLikeCounts(prev => ({ ...prev, [messageId]: (prev[messageId] || 0) + 1 }))
    }
  }

  function getDeliveryStatus(msg: Message): 'sent' | 'delivered' {
    if (msg.sender_id !== currentUserId) return 'sent'
    if (otherReadAt && new Date(otherReadAt) >= new Date(msg.created_at)) return 'delivered'
    return 'sent'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-bg" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: '56px', zIndex: 20 }}>
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="bg-bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Link href="/messages" className="press">
            <ArrowLeft size={20} />
          </Link>
          {otherUser && (
            <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-2.5 press">
              <div className="w-8 h-8 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[12px] font-bold text-text-muted">
                    {otherUser.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <span className="text-[15px] font-semibold">{otherUser.full_name}</span>
            </Link>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.length === 0 && (
            <p className="text-center text-text-muted text-[13px] py-8">No messages yet. Say hi!</p>
          )}
          {messages.map(msg => {
            const isMine = msg.sender_id === currentUserId
            const status = isMine ? getDeliveryStatus(msg) : null
            const msgLikeCount = likeCounts[msg.id] || 0
            const iLiked = likedMessages.has(msg.id)

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${msgLikeCount > 0 ? 'mb-3' : ''}`}
              >
                <div
                  className={`relative max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] ${
                    isMine
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-bg-card border border-border rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
                    <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-text-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {status && (
                      status === 'delivered'
                        ? <CheckCheck size={12} className="text-white/60" />
                        : <Check size={12} className="text-white/60" />
                    )}
                    <button
                      onClick={() => toggleLikeMessage(msg.id)}
                      className="press"
                    >
                      <Heart size={10} className={iLiked ? 'fill-red-500 text-red-500' : isMine ? 'text-white/30 hover:text-white/60' : 'text-text-muted/30 hover:text-text-muted'} />
                    </button>
                  </div>
                  {/* Like count bubble */}
                  {msgLikeCount > 0 && (
                    <div className={`absolute -bottom-2.5 ${isMine ? 'left-1' : 'right-1'} bg-bg-card border border-border rounded-full px-1.5 py-0.5 flex items-center gap-0.5`}>
                      <Heart size={10} className="text-red-500 fill-red-500" />
                      {msgLikeCount > 1 && <span className="text-[9px] text-text-muted">{msgLikeCount}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-border px-4 py-3 flex gap-2 flex-shrink-0 bg-bg">
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-bg-input rounded-full px-4 py-2 text-[14px] outline-none border-none placeholder:text-text-muted/50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="bg-accent text-white rounded-full p-2.5 press disabled:opacity-50 flex-shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  )
}
