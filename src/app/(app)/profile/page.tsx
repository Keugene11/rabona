'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Camera, MapPin, GraduationCap, BookOpen, Heart, Phone, Globe, School, Cake, Home, Mail, X, Settings, Eye, Share2, Users, ArrowLeft, Link2, Check } from 'lucide-react'
import { CLASS_YEARS, GENDERS, RELATIONSHIP_STATUSES, LOOKING_FOR, INTERESTED_IN, POLITICAL_VIEWS } from '@/lib/constants'
import { getUniversityData, type UniversityData } from '@/lib/university-data'
import WallPostForm from '@/components/WallPostForm'
import WallPostItem from '@/components/WallPost'
import AvatarCropper from '@/components/AvatarCropper'
import type { Profile, WallPost, Group } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallPosts, setWallPosts] = useState<WallPost[]>([])
  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [courseFilter, setCourseFilter] = useState('')
  const [courseOpen, setCourseOpen] = useState(false)
  const [clubFilter, setClubFilter] = useState('')
  const [clubOpen, setClubOpen] = useState(false)
  const [musicInput, setMusicInput] = useState('')
  const [movieInput, setMovieInput] = useState('')
  const [friends, setFriends] = useState<Profile[]>([])
  const [profileViews, setProfileViews] = useState<Profile[]>([])
  const [showViewers, setShowViewers] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'wall' | 'info'>('wall')
  const [inviteCopied, setInviteCopied] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uniData, setUniData] = useState<UniversityData | null>(null)

  useEffect(() => { loadProfile() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select(PROFILE_PUBLIC_COLUMNS).eq('id', user.id).single<Profile>()
    if (data) {
      const { data: contact } = await supabase.rpc('get_profile_contact', { p_profile_id: user.id })
      const contactRow = Array.isArray(contact) ? contact[0] : contact
      setProfile({ ...data, email: contactRow?.email ?? user.email ?? '', phone: contactRow?.phone ?? '' })
      const ud = await getUniversityData(data.university || 'stonybrook')
      setUniData(ud)
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

    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    if (memberships && memberships.length > 0) {
      const { data: groups } = await supabase.from('groups').select('*').in('id', memberships.map(m => m.group_id))
      if (groups) setUserGroups(groups as Group[])
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

  const SAFE_FIELDS = new Set([
    'full_name', 'about_me', 'major', 'second_major', 'minor', 'residence_hall',
    'hometown', 'high_school', 'birthday', 'class_year', 'gender',
    'relationship_status', 'interested_in', 'looking_for', 'political_views',
    'email', 'phone', 'websites', 'interests', 'favorite_music', 'favorite_movies',
    'favorite_quotes', 'courses', 'clubs', 'fraternity_sorority',
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

  const courses = profile.courses ? profile.courses.split(', ').filter(Boolean) : []
  const clubs = profile.clubs ? profile.clubs.split(', ').filter(Boolean) : []
  const musicTags = profile.favorite_music ? profile.favorite_music.split(', ').filter(Boolean) : []
  const movieTags = profile.favorite_movies ? profile.favorite_movies.split(', ').filter(Boolean) : []
  const empty = 'text-text-muted/40 italic cursor-pointer'
  const inputClass = 'bg-bg-input rounded-lg px-2 py-1 text-[13px] outline-none w-full border border-border focus:border-text-muted'
  const selectClass = 'bg-bg-input rounded-lg px-2 py-1 text-[13px] outline-none border border-border focus:border-text-muted cursor-pointer'

  // Hall groups for select
  const resHalls = uniData?.RESIDENCE_HALLS || []
  const hallGroups: Record<string, typeof resHalls> = {}
  for (const h of resHalls) { const g = h.group || 'Other'; if (!hallGroups[g]) hallGroups[g] = []; hallGroups[g].push(h) }

  // Course helpers
  const sortedDepts = uniData ? Object.entries(uniData.COURSES).sort((a, b) => a[0].localeCompare(b[0])) : []
  const filteredDepts = sortedDepts.map(([code, dept]) => ({
    code, name: dept.name,
    courses: dept.courses.map(n => `${code} ${n}`).filter(c => !courses.includes(c)).filter(c => {
      if (!courseFilter) return true
      const q = courseFilter.trim().toUpperCase()
      if (/^[A-Z]{2,4}$/.test(q)) return code === q
      if (/^[A-Z]{2,4}\s/.test(q)) return c.toUpperCase().startsWith(q)
      return dept.name.toLowerCase().includes(courseFilter.toLowerCase())
    })
  })).filter(d => d.courses.length > 0)

  // Club helpers
  const allClubs = (uniData?.CLUBS || []).filter(c => !clubs.includes(c))
  const filteredClubs = allClubs.filter(c => !clubFilter || c.toLowerCase().includes(clubFilter.toLowerCase()))

  // Editable row: click to open edit sheet
  function EditableRow({ icon: Icon, label, field, value, type = 'text', options }: {
    icon: typeof MapPin; label: string; field: string; value?: string | null; type?: string
    options?: { value: string; label: string; group?: string }[]
  }) {
    return (
      <div className="flex items-center gap-2 text-[13px] py-[3px]">
        <Icon size={13} className="text-text-muted flex-shrink-0" />
        <span className="text-text-muted min-w-[80px] flex-shrink-0">{label}</span>
        <div className="flex-1 min-w-0">
          <span className={value ? (value === 'None' ? 'cursor-pointer hover:underline text-text-muted' : 'cursor-pointer hover:underline') : empty} onClick={() => setEditing(field)}>
            {field === 'birthday' && value && value !== 'None' && !isNaN(new Date(value + 'T00:00:00').getTime()) ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : (field === 'birthday' ? (value && value !== 'None' ? value : 'Click to set') : value || 'Click to set')}
          </span>
        </div>
      </div>
    )
  }

  // Edit sheet modal
  function EditSheet() {
    if (!editing) return null

    // Find the config for the current editing field
    const fieldConfigs: Record<string, { label: string; type: string; options?: { value: string; label: string; group?: string }[] }> = {
      full_name: { label: 'Name', type: 'text' },
      about_me: { label: 'About', type: 'textarea' },
      major: { label: 'Major', type: 'select', options: (uniData?.MAJORS || []).map(m => ({ value: m, label: m })) },
      second_major: { label: 'Second Major', type: 'select', options: (uniData?.MAJORS || []).map(m => ({ value: m, label: m })) },
      minor: { label: 'Minor', type: 'select', options: (uniData?.MINORS || []).map(m => ({ value: m, label: m })) },
      residence_hall: { label: 'Dorm', type: 'select', options: resHalls },
      hometown: { label: 'Hometown', type: 'text' },
      high_school: { label: 'High School', type: 'text' },
      birthday: { label: 'Birthday', type: 'birthday' },
      class_year: { label: 'Class Year', type: 'select', options: CLASS_YEARS.map(y => ({ value: y.toString(), label: y.toString() })) },
      gender: { label: 'Gender', type: 'select', options: GENDERS.map(g => ({ value: g, label: g })) },
      relationship_status: { label: 'Relationship Status', type: 'select', options: RELATIONSHIP_STATUSES.map(s => ({ value: s, label: s })) },
      interested_in: { label: 'Interested In', type: 'select', options: INTERESTED_IN.map(s => ({ value: s, label: s })) },
      looking_for: { label: 'Looking For', type: 'select', options: LOOKING_FOR.map(s => ({ value: s, label: s })) },
      political_views: { label: 'Political Views', type: 'select', options: POLITICAL_VIEWS.map(p => ({ value: p, label: p })) },
      fraternity_sorority: { label: 'Fraternity / Sorority', type: 'select', options: (uniData?.GREEK_LIFE || []).map(g => ({ value: g, label: g })) },
      courses: { label: 'Courses', type: 'multiselect', options: sortedDepts.flatMap(([code, dept]) => dept.courses.map(n => ({ value: `${code} ${n}`, label: `${code} ${n}`, group: `${code} — ${dept.name}` }))) },
      clubs: { label: 'Clubs', type: 'multiselect', options: (uniData?.CLUBS || []).map(c => ({ value: c, label: c })) },
      email: { label: 'Email', type: 'text' },
      phone: { label: 'Phone', type: 'tel' },
      websites: { label: 'Website', type: 'text' },
      interests: { label: 'Interests', type: 'textarea' },
      favorite_quotes: { label: 'Favorite Quotes', type: 'textarea' },
    }

    const config = fieldConfigs[editing]
    if (!config) return null

    const currentValue = (profile as unknown as Record<string, unknown>)?.[editing] as string || ''

    return <EditSheetInner key={editing} label={config.label} field={editing} type={config.type} options={config.options} currentValue={currentValue} />
  }

  function EditSheetInner({ label, field, type, options, currentValue }: {
    label: string; field: string; type: string; options?: { value: string; label: string; group?: string }[]; currentValue: string
  }) {
    const [localValue, setLocalValue] = useState(currentValue === 'None' ? '' : currentValue)
    const [search, setSearch] = useState('')

    const filteredOptions = options?.filter(o => {
      if (!search) return true
      return o.label.toLowerCase().includes(search.toLowerCase())
    })

    function save(val?: string) {
      const v = val !== undefined ? val : localValue
      updateField(field, v)
      setEditing(null)
    }

    const selected = type === 'multiselect' ? (currentValue ? currentValue.split(', ').filter(Boolean) : []) : []
    const [multiSelected, setMultiSelected] = useState<string[]>(selected)

    const filteredMultiOptions = options?.filter(o => {
      if (multiSelected.includes(o.value)) return false
      if (!search) return true
      return o.label.toLowerCase().includes(search.toLowerCase())
    })

    function addItem(val: string) {
      const next = [...multiSelected, val]
      setMultiSelected(next)
      updateField(field, next.join(', '))
    }
    function removeItem(val: string) {
      const next = multiSelected.filter(v => v !== val)
      setMultiSelected(next)
      updateField(field, next.join(', '))
    }

    return (
      <div className="fixed inset-0 bg-bg z-[60] flex flex-col animate-slide-up overflow-hidden touch-none" style={{ overscrollBehavior: 'none', height: '100dvh' }}>
        {/* Header */}
        <div className="max-w-xl mx-auto w-full flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <button onClick={() => setEditing(null)} className="press text-[14px] text-text-muted">
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-[17px] font-bold">{label}</h3>
          {type === 'multiselect' ? (
            <button onClick={() => setEditing(null)} className="press text-[14px] font-semibold text-accent">Done</button>
          ) : type !== 'select' ? (
            <button onClick={() => save()} className="press text-[14px] font-semibold text-accent">Save</button>
          ) : (
            <div className="w-[32px]" />
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 max-w-xl mx-auto w-full px-4 py-6 ${type === 'select' || type === 'multiselect' ? 'overflow-y-auto touch-auto -webkit-overflow-scrolling-touch' : 'overflow-hidden'}`}>
          {type === 'multiselect' && options ? (
            <div>
              {multiSelected.length > 0 && (
                <div className="mb-4 space-y-1">
                  {multiSelected.map(item => (
                    <div key={item} className="flex items-center justify-between px-4 py-3 bg-bg-input rounded-xl">
                      <span className="text-[15px]">{item}</span>
                      <button type="button" onClick={() => removeItem(item)} className="press text-text-muted hover:text-text"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full bg-bg-input rounded-xl px-4 py-3 text-[15px] outline-none border border-border focus:border-text-muted mb-4"
                autoFocus
              />
              <div className="space-y-0.5">
                {(() => {
                  const grouped: Record<string, typeof options> = {}
                  const ungrouped: typeof options = []
                  filteredMultiOptions?.forEach(o => {
                    if (o.group) { if (!grouped[o.group]) grouped[o.group] = []; grouped[o.group].push(o) }
                    else ungrouped.push(o)
                  })
                  return (
                    <>
                      {ungrouped.map(o => (
                        <button key={o.value} type="button" onClick={() => addItem(o.value)} className="press w-full text-left px-4 py-3.5 rounded-xl text-[15px] hover:bg-bg-input">{o.label}</button>
                      ))}
                      {Object.entries(grouped).map(([g, opts]) => (
                        <div key={g}>
                          <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-text-muted font-semibold">{g}</div>
                          {opts.map(o => (
                            <button key={o.value} type="button" onClick={() => addItem(o.value)} className="press w-full text-left px-4 py-3.5 rounded-xl text-[15px] hover:bg-bg-input">{o.label}</button>
                          ))}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          ) : type === 'select' && options ? (
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full bg-bg-input rounded-xl px-4 py-3 text-[15px] outline-none border border-border focus:border-text-muted mb-4"
                autoFocus
              />
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => save('None')}
                  className="press w-full text-left px-4 py-3.5 rounded-xl text-[15px] text-text-muted hover:bg-bg-input"
                >
                  None
                </button>
                {(() => {
                  const grouped: Record<string, typeof options> = {}
                  const ungrouped: typeof options = []
                  filteredOptions?.forEach(o => {
                    if (o.group) { if (!grouped[o.group]) grouped[o.group] = []; grouped[o.group].push(o) }
                    else ungrouped.push(o)
                  })
                  return (
                    <>
                      {ungrouped.map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => save(o.value)}
                          className={`press w-full text-left px-4 py-3.5 rounded-xl text-[15px] hover:bg-bg-input ${currentValue === o.value ? 'text-accent font-semibold' : ''}`}
                        >
                          {o.label}
                        </button>
                      ))}
                      {Object.entries(grouped).map(([g, opts]) => (
                        <div key={g}>
                          <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-text-muted font-semibold">{g}</div>
                          {opts.map(o => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => save(o.value)}
                              className={`press w-full text-left px-4 py-3.5 rounded-xl text-[15px] hover:bg-bg-input ${currentValue === o.value ? 'text-accent font-semibold' : ''}`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          ) : type === 'birthday' ? (
            <BirthdayEditor value={localValue} onSave={(v) => { updateField(field, v); setEditing(null) }} />
          ) : type === 'textarea' ? (
            <textarea
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="w-full bg-bg-input rounded-xl px-4 py-3 text-[16px] outline-none border border-border focus:border-text-muted resize-none h-40"
              placeholder={`Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          ) : (
            <input
              type={type}
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

  function Tags({ items, field }: { items: string[]; field: string }) {
    return (
      <p className="text-[13px]">{items.join(', ')}</p>
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
            <p className="text-[13px] text-text-muted truncate">
              {profile.major || 'No major'}{profile.class_year ? ` '${profile.class_year.toString().slice(-2)}` : ''}
              {profile.residence_hall ? ` · ${profile.residence_hall}` : ''}
            </p>
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

          {/* Name & subtitle — desktop only; mobile uses the compact header above */}
          <div className="hidden md:block">
            <h1 className="text-[22px] font-bold tracking-tight cursor-pointer hover:underline" onClick={() => setEditing('full_name')}>{profile.full_name || 'Click to set name'}</h1>
            {profile.username && <p className="text-[13px] text-text-muted mt-0.5">@{profile.username}</p>}
            <p className="text-[13px] text-text-muted mt-0.5">
              {profile.major || 'No major'}{profile.class_year ? ` '${profile.class_year.toString().slice(-2)}` : ''}
              {profile.residence_hall ? ` · ${profile.residence_hall}` : ''}
            </p>
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
          {profile.username && (
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/join/${profile.username}`
                try {
                  await navigator.clipboard.writeText(url)
                  setInviteCopied(true)
                  setTimeout(() => setInviteCopied(false), 1500)
                } catch {
                  window.prompt('Copy your invite link:', url)
                }
              }}
              className="press bg-bg-card border border-border rounded-2xl px-4 py-3 w-full flex items-center gap-2.5 text-left"
            >
              {inviteCopied ? <Check size={16} className="text-accent" /> : <Link2 size={16} className="text-text-muted" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Invite link</p>
                <p className="text-[13px] truncate">{inviteCopied ? 'Copied!' : `Share to auto-friend new signups`}</p>
              </div>
            </button>
          )}

          {/* About */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 press" onClick={() => setEditing('about_me')}>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1">About</p>
            <p className={`text-[13px] cursor-pointer ${profile.about_me ? 'hover:underline' : empty}`}>{profile.about_me || 'Click to add...'}</p>
          </div>

          {/* Academics & Background */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-2.5">
            <EditableRow icon={GraduationCap} label="Major" field="major" value={profile.major} options={(uniData?.MAJORS || []).map(m => ({ value: m, label: m }))} />
            <EditableRow icon={GraduationCap} label="2nd Major" field="second_major" value={profile.second_major} options={(uniData?.MAJORS || []).map(m => ({ value: m, label: m }))} />
            <EditableRow icon={BookOpen} label="Minor" field="minor" value={profile.minor} options={(uniData?.MINORS || []).map(m => ({ value: m, label: m }))} />
            <EditableRow icon={GraduationCap} label="Class Year" field="class_year" value={profile.class_year?.toString()} options={CLASS_YEARS.map(y => ({ value: y.toString(), label: y.toString() }))} />
            {resHalls.length > 0 && <EditableRow icon={MapPin} label="Dorm" field="residence_hall" value={profile.residence_hall} options={resHalls} />}
            <EditableRow icon={Users} label="Greek Life" field="fraternity_sorority" value={profile.fraternity_sorority} options={(uniData?.GREEK_LIFE || []).map(g => ({ value: g, label: g }))} />
          </div>

          {/* Courses */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 press" onClick={() => setEditing('courses')}>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Courses</p>
            <p className={`text-[13px] cursor-pointer ${courses.length > 0 ? 'hover:underline' : empty}`}>{courses.length > 0 ? courses.join(', ') : 'Click to add...'}</p>
          </div>

          {/* Clubs */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 press" onClick={() => setEditing('clubs')}>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Clubs</p>
            <p className={`text-[13px] cursor-pointer ${clubs.length > 0 ? 'hover:underline' : empty}`}>{clubs.length > 0 ? clubs.join(', ') : 'Click to add...'}</p>
          </div>

          {/* Personal */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-2.5">
            <EditableRow icon={Home} label="From" field="hometown" value={profile.hometown} />
            <EditableRow icon={School} label="High School" field="high_school" value={profile.high_school} />
            <EditableRow icon={Cake} label="Birthday" field="birthday" value={profile.birthday} type="birthday" />
            <EditableRow icon={GraduationCap} label="Gender" field="gender" value={profile.gender} options={GENDERS.map(g => ({ value: g, label: g }))} />
            <EditableRow icon={Heart} label="Status" field="relationship_status" value={profile.relationship_status} options={RELATIONSHIP_STATUSES.map(s => ({ value: s, label: s }))} />
            <EditableRow icon={Heart} label="Interested In" field="interested_in" value={profile.interested_in} options={INTERESTED_IN.map(s => ({ value: s, label: s }))} />
            <EditableRow icon={Heart} label="Looking For" field="looking_for" value={profile.looking_for} options={LOOKING_FOR.map(s => ({ value: s, label: s }))} />
            <EditableRow icon={Globe} label="Political Views" field="political_views" value={profile.political_views} options={POLITICAL_VIEWS.map(p => ({ value: p, label: p }))} />
          </div>

          {/* Contact */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-2.5 py-2.5">
              <Mail size={14} className="text-text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium">Email</p>
                <p className="text-[14px] text-accent break-all">{profile.email}</p>
              </div>
            </div>
            <EditableRow icon={Phone} label="Phone" field="phone" value={profile.phone} type="tel" />
            <EditableRow icon={Globe} label="Website" field="websites" value={profile.websites} />
          </div>

          {/* Interests */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 press" onClick={() => setEditing('interests')}>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Interests</p>
            <p className={`text-[13px] cursor-pointer ${profile.interests ? 'hover:underline' : empty}`}>{profile.interests || 'Click to add...'}</p>
          </div>

          {/* Favorites */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 space-y-2">
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1">Favorite Music</p>
              {musicTags.length > 0 && <Tags items={musicTags} field="favorite_music" />}
              <input type="text" value={musicInput} onChange={(e) => setMusicInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && musicInput.trim()) { e.preventDefault(); updateField('favorite_music', [...musicTags, musicInput.trim()].join(', ')); setMusicInput('') } }} className={`${inputClass} mt-1`} placeholder="Type artist, press Enter" />
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1">Favorite Movies</p>
              {movieTags.length > 0 && <Tags items={movieTags} field="favorite_movies" />}
              <input type="text" value={movieInput} onChange={(e) => setMovieInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && movieInput.trim()) { e.preventDefault(); updateField('favorite_movies', [...movieTags, movieInput.trim()].join(', ')); setMovieInput('') } }} className={`${inputClass} mt-1`} placeholder="Type movie, press Enter" />
            </div>
            <div className="press" onClick={() => setEditing('favorite_quotes')}>
              <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Favorite Quotes</p>
              <p className={`text-[13px] cursor-pointer ${profile.favorite_quotes ? 'italic hover:underline' : empty}`}>{profile.favorite_quotes ? `\u201c${profile.favorite_quotes}\u201d` : 'Click to add...'}</p>
            </div>
          </div>

          {/* Friends */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Link href="/friends" className="press text-[13px] font-semibold hover:underline">Friends ({friends.length})</Link>
              {friends.length > 0 && (
                <Link
                  href={`/profile/${userId}/network`}
                  className="press flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-accent/10 rounded-full px-3 py-1"
                >
                  <Share2 size={12} /> Visualize
                </Link>
              )}
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
              <Link href="/directory" className="text-[13px] text-accent press">Find people</Link>
            )}
          </div>

          {/* Groups */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5">Groups</p>
            {userGroups.length > 0 ? (
              <div className="space-y-1">{userGroups.map(g => <Link key={g.id} href={`/groups/${g.id}`} className="press block text-[13px] text-accent hover:underline">{g.name}</Link>)}</div>
            ) : (
              <Link href="/groups" className="text-[13px] text-accent press">Browse groups</Link>
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

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function BirthdayEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const parts = value ? value.split('-') : ['', '', '']
  const [month, setMonth] = useState(parts[1] ? parseInt(parts[1]) : 0)
  const [day, setDay] = useState(parts[2] ? parseInt(parts[2]) : 0)
  const daysInMonth = month ? new Date(2000, month, 0).getDate() : 31

  return (
    <div className="flex gap-2 items-center">
      <select
        value={month}
        onChange={(e) => { const m = parseInt(e.target.value); setMonth(m); if (day > new Date(2000, m, 0).getDate()) setDay(1) }}
        className="bg-bg-input rounded-lg px-2 py-1 text-[13px] outline-none border border-border"
      >
        <option value={0}>Month</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={day}
        onChange={(e) => setDay(parseInt(e.target.value))}
        className="bg-bg-input rounded-lg px-2 py-1 text-[13px] outline-none border border-border"
      >
        <option value={0}>Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <button
        onClick={() => {
          if (!month || !day) { onSave(''); return }
          onSave(`2000-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`)
        }}
        className="text-accent text-[12px] font-medium press"
      >
        Save
      </button>
    </div>
  )
}
