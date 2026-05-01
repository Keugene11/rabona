'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Loader2, Camera, Settings, Eye, ArrowLeft } from 'lucide-react'
import WallPostForm from '@/components/WallPostForm'
import WallPostItem from '@/components/WallPost'
import AvatarCropper from '@/components/AvatarCropper'
import InviteLinkCard from '@/components/InviteLinkCard'
import type { Profile, WallPost } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallPosts, setWallPosts] = useState<WallPost[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [friends, setFriends] = useState<Profile[]>([])
  const [profileViews, setProfileViews] = useState<Profile[]>([])
  const [showViewers, setShowViewers] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'wall' | 'info'>('wall')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadProfile() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_COLUMNS).eq('id', user.id).single<Profile>()
    if (data) {
      const { data: contact } = await supabase.rpc('get_profile_contact', { p_profile_id: user.id })
      const contactRow = Array.isArray(contact) ? contact[0] : contact
      setProfile({ ...data, email: contactRow?.email ?? user.email ?? '' })
    }
    const { data: posts } = await supabase.from('wall_posts').select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`).eq('wall_owner_id', user.id).order('created_at', { ascending: false }).limit(50)
    if (posts) setWallPosts(posts as WallPost[])
    // Load friends (accepted friendships in either direction)
    const { data: friendData } = await supabase
      .from('friendships')
      .select(`requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_PUBLIC_COLUMNS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    if (friendData) {
      const others = friendData.map(f =>
        (f.requester_id === user.id ? f.addressee : f.requester) as unknown as Profile
      ).filter(p => !!p)
      const unique = Array.from(new Map(others.map(p => [p.id, p])).values())
      setFriends(unique)
    }

    // Load profile viewers
    const { data: views } = await supabase
      .from('profile_views')
      .select(`*, viewer:profiles!profile_views_viewer_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (views) setProfileViews(views.map((v: { viewer: Profile }) => v.viewer))

    setLoading(false)
  }

  const SAFE_FIELDS = new Set(['full_name', 'about_me'])

  const updateField = useCallback((field: string, value: string | number | null) => {
    if (!SAFE_FIELDS.has(field)) return
    setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('profiles').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', userId)
    }, 800)
  }, [userId, supabase])

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return }
    setCropFile(file)
    e.target.value = ''
  }

  async function handleAvatarSave(blob: Blob) {
    setCropFile(null)
    if (!userId) return
    // Show instant preview
    const previewUrl = URL.createObjectURL(blob)
    setProfile(prev => prev ? { ...prev, avatar_url: previewUrl } : prev)
    // Delete old avatar
    if (profile?.avatar_url && profile.avatar_url.includes('/avatars/')) {
      const oldPath = profile.avatar_url.split('/avatars/')[1]
      if (oldPath) await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)])
    }
    const path = `${userId}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, blob)
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-text-muted" size={24} /></div>
  if (!profile) return null

  const empty = 'text-text-muted/40 italic cursor-pointer'

  // Edit sheet modal — supports the two remaining fields: full_name (text) and about_me (textarea)
  function EditSheet() {
    if (!editing) return null
    const config: Record<string, { label: string; type: 'text' | 'textarea' }> = {
      full_name: { label: 'Name', type: 'text' },
      about_me: { label: 'About', type: 'textarea' },
    }
    const c = config[editing]
    if (!c) return null
    const currentValue = (profile as unknown as Record<string, unknown>)?.[editing] as string || ''
    return <EditSheetInner key={editing} label={c.label} field={editing} type={c.type} currentValue={currentValue} />
  }

  function EditSheetInner({ label, field, type, currentValue }: {
    label: string; field: string; type: 'text' | 'textarea'; currentValue: string
  }) {
    const [localValue, setLocalValue] = useState(currentValue)

    function save() {
      updateField(field, localValue)
      setEditing(null)
    }

    return (
      <div className="fixed inset-0 bg-bg z-[60] flex flex-col animate-slide-up overflow-hidden touch-none" style={{ overscrollBehavior: 'none', height: '100dvh' }}>
        <div className="max-w-xl mx-auto w-full flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <button onClick={() => setEditing(null)} className="press text-[14px] text-text-muted">
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-[17px] font-bold">{label}</h3>
          <button onClick={save} className="press text-[14px] font-semibold text-accent">Save</button>
        </div>
        <div className="flex-1 min-h-0 max-w-xl mx-auto w-full px-4 py-6 overflow-hidden">
          {type === 'textarea' ? (
            <textarea
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="w-full bg-bg-input rounded-xl px-4 py-3 text-[16px] outline-none border border-border focus:border-text-muted resize-none h-40"
              placeholder={`Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
              className="w-full bg-bg-input rounded-xl px-4 py-3 text-[16px] outline-none border border-border focus:border-text-muted"
              placeholder={`Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-28">
      {/* Mobile profile header — always visible */}
      <div className="md:hidden mb-4">
        <div className="flex items-center gap-3.5 mb-3">
          <label className="relative cursor-pointer press flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-bg-input border-2 border-border overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[24px] font-bold text-text-muted">
                  {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 bg-accent text-white rounded-full p-1">
              <Camera size={10} />
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold tracking-tight truncate">{profile.full_name || 'Set your name'}</h1>
            {profile.username && <p className="text-[13px] text-text-muted truncate">@{profile.username}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href="/settings" className="press p-2 text-text-muted hover:text-text"><Settings size={18} /></Link>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-0 mb-4 md:hidden border-b border-border">
        <button
          onClick={() => setActiveTab('wall')}
          className={`press flex-1 py-2.5 text-[14px] font-semibold text-center border-b-2 transition-colors ${activeTab === 'wall' ? 'border-accent text-accent' : 'border-transparent text-text-muted'}`}
        >
          Wall
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`press flex-1 py-2.5 text-[14px] font-semibold text-center border-b-2 transition-colors ${activeTab === 'info' ? 'border-accent text-accent' : 'border-transparent text-text-muted'}`}
        >
          Info
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:gap-5 md:items-start">
        {/* LEFT — details */}
        <div className={`md:w-[380px] md:flex-shrink-0 md:sticky md:top-4 space-y-3 ${activeTab === 'info' ? 'block' : 'hidden'} md:block`}>

          {/* Name — desktop only; mobile uses the compact header above */}
          <div className="hidden md:block">
            <h1 className="text-[22px] font-bold tracking-tight">
              <button type="button" onClick={() => setEditing('full_name')} className="press cursor-pointer hover:underline text-left">
                {profile.full_name || 'Click to set name'}
              </button>
            </h1>
            {profile.username && <p className="text-[13px] text-text-muted mt-0.5">@{profile.username}</p>}
            <div className="flex items-center gap-3 mt-2">
              <Link href="/settings" className="press p-2 text-text-muted hover:text-text"><Settings size={18} /></Link>
            </div>
          </div>

          {/* Avatar */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-4">
            <label className="relative cursor-pointer press block w-full">
              <div className="w-full aspect-square rounded-xl bg-bg-input border border-border overflow-hidden">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-text-muted text-[64px] font-bold">{profile.full_name?.charAt(0)?.toUpperCase() || '?'}</div>}
              </div>
              <div className="absolute bottom-3 right-3 bg-accent text-white rounded-xl p-2"><Camera size={16} /></div>
              <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
            </label>
          </div>

          {/* Profile Views */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3">
            <button
              onClick={() => profileViews.length > 0 && setShowViewers(!showViewers)}
              className="press flex items-center gap-2 w-full"
            >
              <Eye size={14} className="text-text-muted" />
              <span className="text-[13px] font-medium">{profileViews.length} profile view{profileViews.length !== 1 ? 's' : ''}</span>
            </button>
              {showViewers && (
                <div className="mt-3 space-y-2">
                  {profileViews.map(v => (
                    <Link key={v.id} href={`/profile/${v.id}`} className="press flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                        {v.avatar_url ? (
                          <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-text-muted">
                            {v.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <span className="text-[13px] font-medium hover:underline">{v.full_name}</span>
                    </Link>
                  ))}
                </div>
              )}
          </div>

          {/* Invite Link */}
          {profile.username && <InviteLinkCard username={profile.username} />}

          {/* About */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 press" onClick={() => setEditing('about_me')}>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1">About</p>
            <p className={`text-[13px] cursor-pointer ${profile.about_me ? 'hover:underline' : empty}`}>{profile.about_me || 'Click to add...'}</p>
          </div>

          {/* Friends */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Link href="/friends" className="press text-[13px] font-semibold hover:underline">Friends ({friends.length})</Link>
            </div>
            {friends.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {friends.map(f => (
                  <Link key={f.id} href={`/profile/${f.id}`} className="press flex flex-col items-center gap-1.5">
                    <div className="w-16 h-16 rounded-full bg-bg-input border-2 border-border overflow-hidden">
                      {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[18px] font-bold text-text-muted">{f.full_name?.charAt(0)?.toUpperCase() || '?'}</div>}
                    </div>
                    <span className="text-[12px] font-medium text-center truncate w-full">{f.full_name?.split(' ')[0]}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link href="/friends" className="text-[13px] text-accent press">Find people</Link>
            )}
          </div>

          <p className="text-[11px] text-text-muted px-1">Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* RIGHT — Wall */}
        <div className={`flex-1 min-w-0 mt-5 md:mt-0 ${activeTab === 'wall' ? 'block' : 'hidden'} md:block`}>
          <WallPostForm wallOwnerId={userId} onPost={(post) => setWallPosts([post, ...wallPosts])} />
          {wallPosts.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center mt-3">
              <p className="text-text-muted text-[14px]">No wall posts yet.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {wallPosts.map(post => (
                <WallPostItem key={post.id} post={post} currentUserId={userId} wallOwnerId={userId} isFriend={true} onDelete={(postId) => setWallPosts(wallPosts.filter(p => p.id !== postId))} />
              ))}
            </div>
          )}
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onSave={handleAvatarSave}
          onCancel={() => setCropFile(null)}
        />
      )}

      <EditSheet />
    </div>
  )
}
