'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

const NOTIF_TOGGLES = [
  { field: 'notif_friend_requests', label: 'Friend requests', description: 'When someone sends you a friend request' },
  { field: 'notif_pokes', label: 'Pokes', description: 'When someone pokes you' },
  { field: 'notif_wall_posts', label: 'Wall posts', description: 'When someone writes on your wall' },
  { field: 'notif_likes', label: 'Likes', description: 'When someone likes your post' },
  { field: 'notif_comments', label: 'Comments & replies', description: 'When someone comments on your post or replies to you' },
]

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends only' },
  { value: 'nobody', label: 'Nobody' },
]

const WALL_POST_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends only' },
]

export default function NotificationSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, boolean | string>>({
    notif_friend_requests: true,
    notif_pokes: true,
    notif_wall_posts: true,
    notif_likes: true,
    notif_comments: true,
    messages_from: 'everyone',
    wall_posts_from: 'everyone',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('notif_friend_requests, notif_pokes, notif_wall_posts, notif_likes, notif_comments, messages_from, wall_posts_from')
        .eq('id', user.id)
        .single()
      if (data) {
        setSettings({
          notif_friend_requests: data.notif_friend_requests ?? true,
          notif_pokes: data.notif_pokes ?? true,
          notif_wall_posts: data.notif_wall_posts ?? true,
          notif_likes: data.notif_likes ?? true,
          notif_comments: data.notif_comments ?? true,
          messages_from: data.messages_from || 'everyone',
          wall_posts_from: data.wall_posts_from || 'everyone',
        })
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateSetting(field: string, value: boolean | string) {
    setSettings(prev => ({ ...prev, [field]: value }))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28 ">
      <button onClick={() => router.back()} className="press flex items-center gap-1.5 text-[13px] text-text-muted mb-4">
        <ArrowLeft size={14} />
        Back
      </button>

      <h1 className="text-[22px] font-bold tracking-tight mb-5">Notifications & Messaging</h1>

      {/* Notification toggles */}
      <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-2 px-1">Notifications</p>
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mb-6">
        {NOTIF_TOGGLES.map(({ field, label, description }) => (
          <div key={field} className="flex items-center justify-between px-4 py-3.5">
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-[14px] font-medium">{label}</p>
              <p className="text-[12px] text-text-muted">{description}</p>
            </div>
            <button
              onClick={() => updateSetting(field, !settings[field])}
              className={`press relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[field] ? 'bg-accent' : 'bg-bg-input border border-border'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[field] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Wall post preferences */}
      <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-2 px-1">Who can post on your wall</p>
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mb-6">
        {WALL_POST_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => updateSetting('wall_posts_from', value)}
            className="press flex items-center justify-between px-4 py-3.5 w-full text-left"
          >
            <p className="text-[14px] font-medium">{label}</p>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.wall_posts_from === value ? 'border-accent' : 'border-border'}`}>
              {settings.wall_posts_from === value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </button>
        ))}
      </div>

      {/* Messaging preferences */}
      <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-2 px-1">Who can message you</p>
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {MESSAGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => updateSetting('messages_from', value)}
            className="press flex items-center justify-between px-4 py-3.5 w-full text-left"
          >
            <p className="text-[14px] font-medium">{label}</p>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.messages_from === value ? 'border-accent' : 'border-border'}`}>
              {settings.messages_from === value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
