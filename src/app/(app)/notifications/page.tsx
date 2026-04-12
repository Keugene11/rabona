'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Hand, UserPlus, UserCheck, Heart, MessageSquare, MessageCircle, Users, Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface Notification {
  id: string
  user_id: string
  actor_id: string
  type: string
  post_type: string | null
  post_id: string | null
  comment_id: string | null
  content: string | null
  seen: boolean
  created_at: string
  actor?: Profile
  comment?: { content: string } | null
  post_content?: string
  wall_owner_id?: string
  conversation_id?: string
  group_id?: string
}

export default function NotificationsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [handledRequests, setHandledRequests] = useState<Set<string>>(new Set())
  const [pokedBack, setPokedBack] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Load ALL notifications — this is the single source of truth for the inbox
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*), comment:comments(content)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (notifData) {
      const notifs = notifData as Notification[]
      // Fetch wall_owner_id for wall_post notifications so we can link to the right profile
      const wallPostIds = [...new Set(notifs.filter(n => n.post_type === 'wall_post' && n.post_id).map(n => n.post_id!))]
      if (wallPostIds.length > 0) {
        const { data: wallPosts } = await supabase
          .from('wall_posts')
          .select('id, wall_owner_id')
          .in('id', wallPostIds)
        const ownerMap: Record<string, string> = {}
        wallPosts?.forEach(wp => { ownerMap[wp.id] = wp.wall_owner_id })
        notifs.forEach(n => {
          if (n.post_type === 'wall_post' && n.post_id) {
            n.wall_owner_id = ownerMap[n.post_id]
          }
        })
      }

      // Fetch group_id for group_post notifications so we can link to the group
      const groupPostIds = [...new Set(notifs.filter(n => n.post_type === 'group_post' && n.post_id).map(n => n.post_id!))]
      if (groupPostIds.length > 0) {
        const { data: groupPosts } = await supabase
          .from('group_posts')
          .select('id, group_id')
          .in('id', groupPostIds)
        const groupMap: Record<string, string> = {}
        groupPosts?.forEach(gp => { groupMap[gp.id] = gp.group_id })
        notifs.forEach(n => {
          if (n.post_type === 'group_post' && n.post_id) {
            n.group_id = groupMap[n.post_id]
          }
        })
      }

      // Fetch post content for like notifications so we can show what was liked
      const likeNotifs = notifs.filter(n => (n.type === 'like' || n.type === 'friend_like') && n.post_id)
      const likeWallIds = [...new Set(likeNotifs.filter(n => n.post_type === 'wall_post').map(n => n.post_id!))]
      const likeGroupIds = [...new Set(likeNotifs.filter(n => n.post_type === 'group_post').map(n => n.post_id!))]
      const postContentMap: Record<string, string> = {}
      if (likeWallIds.length > 0) {
        const { data: wallPosts } = await supabase
          .from('wall_posts')
          .select('id, content')
          .in('id', likeWallIds)
        wallPosts?.forEach(wp => { if (wp.content) postContentMap[wp.id] = wp.content })
      }
      if (likeGroupIds.length > 0) {
        const { data: groupPosts } = await supabase
          .from('group_posts')
          .select('id, content')
          .in('id', likeGroupIds)
        groupPosts?.forEach(gp => { if (gp.content) postContentMap[gp.id] = gp.content })
      }
      likeNotifs.forEach(n => {
        if (n.post_id && postContentMap[n.post_id]) {
          n.post_content = postContentMap[n.post_id]
        }
      })

      // Look up conversation IDs for message notifications
      const msgActorIds = [...new Set(notifs.filter(n => n.type === 'message').map(n => n.actor_id))]
      if (msgActorIds.length > 0) {
        const { data: convos } = await supabase
          .from('conversations')
          .select('id, user1_id, user2_id')
          .or(msgActorIds.map(aid =>
            `and(user1_id.eq.${[user.id, aid].sort()[0]},user2_id.eq.${[user.id, aid].sort()[1]})`
          ).join(','))
        if (convos) {
          const convoMap: Record<string, string> = {}
          convos.forEach(c => {
            const other = c.user1_id === user.id ? c.user2_id : c.user1_id
            convoMap[other] = c.id
          })
          notifs.forEach(n => {
            if (n.type === 'message') n.conversation_id = convoMap[n.actor_id]
          })
        }
      }

      // Check which friend_request notifications still have a pending friendship
      const friendReqNotifs = notifs.filter(n => n.type === 'friend_request')
      if (friendReqNotifs.length > 0) {
        const actorIds = [...new Set(friendReqNotifs.map(n => n.actor_id))]
        const { data: friendships } = await supabase
          .from('friendships')
          .select('requester_id, status')
          .eq('addressee_id', user.id)
          .in('requester_id', actorIds)
        const alreadyHandled = new Set<string>()
        friendships?.forEach(f => {
          if (f.status !== 'pending') alreadyHandled.add(f.requester_id)
        })
        // Also mark as handled if friendship no longer exists (declined)
        const existingRequesters = new Set(friendships?.map(f => f.requester_id) || [])
        actorIds.forEach(id => {
          if (!existingRequesters.has(id)) alreadyHandled.add(id)
        })
        setHandledRequests(alreadyHandled)
      }

      setNotifications(notifs)
    }

    // Mark notifications as seen in the DB (but keep local state so they render at full opacity this visit)
    supabase
      .from('notifications')
      .update({ seen: true })
      .eq('user_id', user.id)
      .eq('seen', false)
      .then()

    setLoading(false)
  }

  async function acceptRequest(actorId: string) {
    // Find the pending friendship and accept it
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', actorId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    if (!friendship) return
    await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendship.id)
    // Notify the requester
    await supabase.from('notifications').insert({
      user_id: actorId,
      actor_id: userId,
      type: 'friend_accept',
    })
    setHandledRequests(prev => new Set([...prev, actorId]))
  }

  async function declineRequest(actorId: string) {
    await supabase.from('friendships')
      .delete()
      .eq('requester_id', actorId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
    setHandledRequests(prev => new Set([...prev, actorId]))
  }

  async function pokeBack(notifId: string, actorId: string) {
    setPokedBack(prev => new Set([...prev, notifId]))
    // Clear any existing pokes between the two users, then create new one
    await supabase.from('pokes').delete().eq('poker_id', userId).eq('poked_id', actorId)
    await supabase.from('pokes').delete().eq('poker_id', actorId).eq('poked_id', userId)
    await supabase.from('pokes').insert({ poker_id: userId, poked_id: actorId })
    // Create a notification for the other person
    await supabase.from('notifications').insert({
      user_id: actorId,
      actor_id: userId,
      type: 'poke',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  function getNotifIcon(type: string) {
    if (type === 'like') return <Heart size={12} className="text-red-500 fill-red-500 flex-shrink-0" />
    if (type === 'comment') return <MessageSquare size={12} className="text-accent flex-shrink-0" />
    if (type === 'reply') return <MessageSquare size={12} className="text-accent flex-shrink-0" />
    if (type === 'friend_request') return <UserPlus size={12} className="text-accent flex-shrink-0" />
    if (type === 'friend_accept') return <UserCheck size={12} className="text-green-500 flex-shrink-0" />
    if (type === 'message') return <MessageCircle size={12} className="text-accent flex-shrink-0" />
    if (type === 'poke') return <Hand size={12} className="text-accent flex-shrink-0" />
    if (type === 'group_join') return <Users size={12} className="text-accent flex-shrink-0" />
    if (type === 'friend_post') return <MessageSquare size={12} className="text-accent flex-shrink-0" />
    if (type === 'friend_comment') return <MessageSquare size={12} className="text-accent flex-shrink-0" />
    if (type === 'friend_like') return <Heart size={12} className="text-red-500 fill-red-500 flex-shrink-0" />
    return null
  }

  function getNotifText(type: string) {
    if (type === 'like') return 'liked your post'
    if (type === 'comment') return 'commented on your post'
    if (type === 'reply') return 'replied to your comment'
    if (type === 'friend_request') return 'sent you a friend request'
    if (type === 'friend_accept') return 'accepted your friend request'
    if (type === 'message') return 'sent you a message'
    if (type === 'poke') return 'poked you'
    if (type === 'group_join') return 'joined your group'
    if (type === 'friend_post') return 'made a post'
    if (type === 'friend_comment') return 'commented on a post'
    if (type === 'friend_like') return 'liked a post'
    return ''
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-28 ">
      <h1 className="text-[24px] font-bold tracking-tight mb-4">Inbox</h1>

      {notifications.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-text-muted text-[14px]">Nothing new right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const postLink = n.post_type === 'wall_post' && n.wall_owner_id
              ? `/profile/${n.wall_owner_id}`
              : n.post_type === 'group_post' && n.group_id
              ? `/groups/${n.group_id}`
              : null
            const showFriendActions = n.type === 'friend_request' && !handledRequests.has(n.actor_id)

            const isMessage = n.type === 'message' && n.conversation_id
            const isClickable = isMessage || postLink

            return (
              <div
                key={n.id}
                className={`bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3 ${isClickable ? 'cursor-pointer hover:bg-bg-card-hover transition-colors' : ''}`}
                onClick={isClickable ? () => router.push(isMessage ? `/messages/${n.conversation_id}` : postLink!) : undefined}
              >
                <Link href={`/profile/${n.actor_id}`} className="press flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden">
                    {n.actor?.avatar_url ? (
                      <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                        {n.actor?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {getNotifIcon(n.type)}
                    <span className="text-[13px]">
                      <Link href={`/profile/${n.actor_id}`} className="font-semibold hover:underline">{n.actor?.full_name}</Link>
                      {!(n.type === 'message' && n.content) && (
                        <span className="text-text-muted"> {getNotifText(n.type)}</span>
                      )}
                    </span>
                  </div>
                  {n.comment?.content && (n.type === 'comment' || n.type === 'reply') && (
                    <p className="text-[12px] text-text-muted mt-1 pl-[18px] line-clamp-2">
                      &ldquo;{n.comment.content}&rdquo;
                    </p>
                  )}
                  {n.post_content && (n.type === 'like' || n.type === 'friend_like') && (
                    <p className="text-[12px] text-text-muted mt-1 pl-[18px] line-clamp-2">
                      &ldquo;{n.post_content}&rdquo;
                    </p>
                  )}
                  {n.content && (n.type === 'friend_post' || n.type === 'friend_comment') && (
                    <p className="text-[12px] text-text-muted mt-1 pl-[18px] line-clamp-2">
                      &ldquo;{n.content}&rdquo;
                    </p>
                  )}
                  {n.type === 'message' && n.content && (
                    <p className="text-[13px] mt-1 pl-[18px] line-clamp-2">
                      {n.content}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 pl-[18px]">
                    <span className="text-[11px] text-text-muted">{getTimeAgo(new Date(n.created_at))}</span>
                  </div>
                </div>
                {/* Action buttons for friend requests */}
                {showFriendActions && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => acceptRequest(n.actor_id)}
                      className="bg-accent text-white rounded-xl px-3 py-1.5 text-[12px] font-medium press"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineRequest(n.actor_id)}
                      className="bg-bg-input border border-border rounded-xl px-3 py-1.5 text-[12px] font-medium press"
                    >
                      Decline
                    </button>
                  </div>
                )}
                {/* Poke back button */}
                {n.type === 'poke' && (
                  pokedBack.has(n.id) ? (
                    <span className="bg-accent/10 border border-accent/20 text-accent rounded-xl px-3 py-1.5 text-[12px] font-medium flex items-center gap-1 flex-shrink-0">
                      <Check size={12} /> Poked!
                    </span>
                  ) : (
                    <button
                      onClick={() => pokeBack(n.id, n.actor_id)}
                      className="bg-accent text-white rounded-xl px-3 py-1.5 text-[12px] font-medium press flex items-center gap-1 flex-shrink-0"
                    >
                      <Hand size={12} /> Poke Back
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
