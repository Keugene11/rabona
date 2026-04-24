'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CLASS_YEARS, GENDERS, RELATIONSHIP_STATUSES, LOOKING_FOR, INTERESTED_IN, POLITICAL_VIEWS } from '@/lib/constants'
import AvatarCropper from '@/components/AvatarCropper'
import type { Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [musicInput, setMusicInput] = useState('')
  const [movieInput, setMovieInput] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_COLUMNS).eq('id', user.id).single<Profile>()
    if (data) {
      const { data: contact } = await supabase.rpc('get_profile_contact', { p_profile_id: user.id })
      const contactRow = Array.isArray(contact) ? contact[0] : contact
      setProfile({ ...data, email: contactRow?.email ?? user.email ?? '', phone: contactRow?.phone ?? '' })
      setAvatarUrl(data.avatar_url || '')
      const { data: meta } = await supabase.from('profiles').select('username_changed_at').eq('id', user.id).maybeSingle()
      setUsernameChangedAt(meta?.username_changed_at ?? null)
    }

    setLoading(false)
  }

  const SAFE_FIELDS = new Set([
    'full_name', 'about_me', 'major', 'university',
    'hometown', 'high_school', 'birthday', 'class_year', 'gender',
    'relationship_status', 'interested_in', 'looking_for', 'political_views',
    'email', 'phone', 'websites', 'interests', 'favorite_music', 'favorite_movies',
    'favorite_quotes',
  ])

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
    const previewUrl = URL.createObjectURL(blob)
    setAvatarUrl(previewUrl)
    setProfile(prev => prev ? { ...prev, avatar_url: previewUrl } : prev)
    // Delete old avatar
    if (avatarUrl && avatarUrl.includes('/avatars/')) {
      const oldPath = avatarUrl.split('/avatars/')[1]
      if (oldPath) await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)])
    }
    const path = `${userId}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, blob)
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
  }

  // Tag helpers
  const musicTags = profile?.favorite_music ? profile.favorite_music.split(', ').filter(Boolean) : []
  const movieTags = profile?.favorite_movies ? profile.favorite_movies.split(', ').filter(Boolean) : []
  function addTag(field: string, input: string, existing: string[], clearFn: (v: string) => void) {
    const val = input.trim()
    if (!val || existing.includes(val)) return
    updateField(field, [...existing, val].join(', '))
    clearFn('')
  }
  function removeTag(field: string, tag: string, existing: string[]) {
    updateField(field, existing.filter(t => t !== tag).join(', '))
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-text-muted" size={24} /></div>
  if (!profile) return null

  const inputClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[14px] outline-none focus:border-text-muted transition-colors'
  const selectClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[14px] outline-none focus:border-text-muted transition-colors cursor-pointer'
  const labelClass = 'text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1 block'

  return (
    <><div className="max-w-5xl mx-auto px-4 pt-6 pb-28 ">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer press">
            <div className="w-20 h-20 rounded-full bg-bg-input border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera size={24} className="text-text-muted" />}
            </div>
            <div className="absolute bottom-0 right-0 bg-accent text-white rounded-full p-1"><Camera size={10} /></div>
            <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
          </label>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Edit Profile</h1>
          </div>
        </div>
        <Link href="/profile" className="press bg-accent text-white rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5">
          <ArrowLeft size={13} /> Done
        </Link>
      </div>

      <div className="max-w-lg space-y-3">

          {/* Basic Info */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Basic Info</p>
            <div>
              <label className={labelClass}>Full Name</label>
              <input type="text" value={profile.full_name || ''} onChange={(e) => updateField('full_name', e.target.value)} className={inputClass} placeholder="Your full name" />
            </div>
            <UsernameField
              userId={userId}
              initial={profile.username || ''}
              lastChangedAt={usernameChangedAt}
              onChange={(v) => { setProfile(prev => prev ? { ...prev, username: v } : prev); setUsernameChangedAt(new Date().toISOString()) }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Class Year</label>
                <select value={profile.class_year?.toString() || ''} onChange={(e) => updateField('class_year', e.target.value ? parseInt(e.target.value) : null)} className={selectClass}>
                  <option value="">Year</option>
                  {CLASS_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select value={profile.gender || ''} onChange={(e) => updateField('gender', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Birthday</label>
              <input type="date" value={profile.birthday || ''} onChange={(e) => updateField('birthday', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hometown</label>
              <input type="text" value={profile.hometown || ''} onChange={(e) => updateField('hometown', e.target.value)} className={inputClass} placeholder="Where are you from?" />
            </div>
            <div>
              <label className={labelClass}>High School</label>
              <input type="text" value={profile.high_school || ''} onChange={(e) => updateField('high_school', e.target.value)} className={inputClass} placeholder="Your high school" />
            </div>
          </div>

          {/* Contact */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Contact</p>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={profile.email || ''} onChange={(e) => updateField('email', e.target.value)} className={inputClass} placeholder="Your email address" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={profile.phone || ''} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} placeholder="Phone number" />
            </div>
            <div>
              <label className={labelClass}>Websites</label>
              <input type="text" value={profile.websites || ''} onChange={(e) => updateField('websites', e.target.value)} className={inputClass} placeholder="Your website, portfolio, etc." />
            </div>
          </div>

          {/* Academics */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Academics</p>
            <div>
              <label className={labelClass}>University</label>
              <input type="text" value={profile.university || ''} onChange={(e) => updateField('university', e.target.value)} className={inputClass} placeholder="Where do you go?" />
            </div>
            <div>
              <label className={labelClass}>Major</label>
              <input type="text" value={profile.major || ''} onChange={(e) => updateField('major', e.target.value)} className={inputClass} placeholder="What do you study?" />
            </div>
          </div>

          {/* Personal */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Personal</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Relationship</label>
                <select value={profile.relationship_status || ''} onChange={(e) => updateField('relationship_status', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {RELATIONSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Interested In</label>
                <select value={profile.interested_in || ''} onChange={(e) => updateField('interested_in', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {INTERESTED_IN.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Looking For</label>
                <select value={profile.looking_for || ''} onChange={(e) => updateField('looking_for', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {LOOKING_FOR.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Political Views</label>
                <select value={profile.political_views || ''} onChange={(e) => updateField('political_views', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {POLITICAL_VIEWS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>About Me</label>
              <textarea value={profile.about_me || ''} onChange={(e) => updateField('about_me', e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="Tell people about yourself..." />
            </div>
            <div>
              <label className={labelClass}>Interests</label>
              <textarea value={profile.interests || ''} onChange={(e) => updateField('interests', e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="Music, sports, coding..." />
            </div>
          </div>

          {/* Favorites */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Favorites</p>
            <div>
              <label className={labelClass}>Music</label>
              {musicTags.length > 0 && <p className="text-[13px] mb-1.5">{musicTags.join(', ')}</p>}
              <input type="text" value={musicInput} onChange={(e) => setMusicInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('favorite_music', musicInput, musicTags, setMusicInput) } }} className={inputClass} placeholder="Type artist, press Enter" />
            </div>
            <div>
              <label className={labelClass}>Movies</label>
              {movieTags.length > 0 && <p className="text-[13px] mb-1.5">{movieTags.join(', ')}</p>}
              <input type="text" value={movieInput} onChange={(e) => setMovieInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('favorite_movies', movieInput, movieTags, setMovieInput) } }} className={inputClass} placeholder="Type movie, press Enter" />
            </div>
            <div>
              <label className={labelClass}>Favorite Quotes</label>
              <textarea value={profile.favorite_quotes || ''} onChange={(e) => updateField('favorite_quotes', e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="&quot;Be the change...&quot;" />
            </div>
          </div>
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onSave={handleAvatarSave}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  )
}

function UsernameField({ userId, initial, lastChangedAt, onChange }: {
  userId: string
  initial: string
  lastChangedAt: string | null
  onChange: (v: string) => void
}) {
  const supabase = createClient()
  const [draft, setDraft] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { setDraft(initial) }, [initial])

  const normalized = draft.trim().toLowerCase()
  const formatOk = /^[a-z0-9_]{3,20}$/.test(normalized)
  const isCurrent = normalized === initial.toLowerCase()

  const cooldownUntil = lastChangedAt
    ? new Date(new Date(lastChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null
  const onCooldown = cooldownUntil !== null && cooldownUntil.getTime() > Date.now()
  const cooldownDaysLeft = onCooldown && cooldownUntil
    ? Math.ceil((cooldownUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0

  useEffect(() => {
    if (isCurrent) { setStatus('idle'); setMessage(null); return }
    if (!formatOk) {
      setStatus('invalid')
      setMessage('3-20 chars, lowercase letters, digits, or _')
      return
    }
    setStatus('checking')
    setMessage(null)
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .maybeSingle()
      if (cancelled) return
      if (data && data.id !== userId) {
        setStatus('taken')
        setMessage('Already taken')
      } else {
        setStatus('available')
        setMessage('Available')
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [normalized, formatOk, isCurrent, supabase, userId])

  async function save() {
    if (!formatOk || status === 'taken' || isCurrent || onCooldown) return
    setStatus('saving')
    const { error } = await supabase.from('profiles').update({
      username: normalized, updated_at: new Date().toISOString(),
    }).eq('id', userId)
    if (error) {
      setStatus('error')
      if (error.message.includes('username_cooldown')) setMessage('You recently changed your username — try again later')
      else if (error.message.includes('unique')) setMessage('Already taken')
      else setMessage('Save failed')
      return
    }
    onChange(normalized)
    setStatus('saved')
    setMessage('Saved')
  }

  const inputClass = 'w-full bg-bg-card border border-border rounded-xl pl-8 pr-3 py-2 text-[14px] outline-none focus:border-text-muted transition-colors'
  const labelClass = 'text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1 block'
  const color = status === 'taken' || status === 'invalid' || status === 'error'
    ? 'text-red-500'
    : status === 'available' || status === 'saved'
    ? 'text-green-600'
    : 'text-text-muted'

  return (
    <div>
      <label className={labelClass}>Username</label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[14px]">@</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
            placeholder="yourname"
            maxLength={20}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!formatOk || status === 'taken' || status === 'saving' || isCurrent || onCooldown}
          className="press bg-text text-bg font-semibold text-[13px] px-4 py-2 rounded-xl disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {onCooldown ? (
        <p className="text-[11px] mt-1 text-text-muted">
          You can change your username again in {cooldownDaysLeft} day{cooldownDaysLeft === 1 ? '' : 's'}.
        </p>
      ) : message ? (
        <p className={`text-[11px] mt-1 ${color}`}>{message}</p>
      ) : null}
    </div>
  )
}
