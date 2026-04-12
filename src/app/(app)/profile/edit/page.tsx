'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, LogOut, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CLASS_YEARS, GENDERS, RELATIONSHIP_STATUSES, LOOKING_FOR, INTERESTED_IN, POLITICAL_VIEWS } from '@/lib/constants'
import { getUniversityData, type UniversityData } from '@/lib/university-data'
import type { Profile } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [courseOpen, setCourseOpen] = useState(false)
  const [musicInput, setMusicInput] = useState('')
  const [movieInput, setMovieInput] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uniData, setUniData] = useState<UniversityData | null>(null)

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setAvatarUrl(data.avatar_url || '')
      const ud = await getUniversityData(data.university || 'cornell')
      setUniData(ud)
    }

    setLoading(false)
  }

  const SAFE_FIELDS = new Set([
    'full_name', 'about_me', 'major', 'second_major', 'minor', 'residence_hall',
    'hometown', 'high_school', 'birthday', 'class_year', 'gender',
    'relationship_status', 'interested_in', 'looking_for', 'political_views',
    'email', 'phone', 'websites', 'interests', 'favorite_music', 'favorite_movies',
    'favorite_quotes', 'courses', 'clubs',
  ])

  const updateField = useCallback((field: string, value: string | number | null) => {
    if (!SAFE_FIELDS.has(field)) return
    setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('profiles').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', userId)
      setSaving(false)
    }, 800)
  }, [userId, supabase])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return }
    // Delete old avatar
    if (avatarUrl && avatarUrl.includes('/avatars/')) {
      const oldPath = avatarUrl.split('/avatars/')[1]
      if (oldPath) await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)])
    }
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file)
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Course helpers
  const courses = profile?.courses ? profile.courses.split(', ').filter(Boolean) : []
  const sortedDepts = uniData ? Object.entries(uniData.COURSES).sort((a, b) => a[0].localeCompare(b[0])) : []
  const allCoursesByDept = sortedDepts
    .map(([code, dept]) => ({
      code, name: dept.name,
      courses: dept.courses.map(n => `${code} ${n}`).filter(c => !courses.includes(c)).filter(c => {
        if (!courseFilter) return true
        const q = courseFilter.trim().toUpperCase()
        if (/^[A-Z]{2,4}$/.test(q)) return code === q
        if (/^[A-Z]{2,4}\s/.test(q)) return c.toUpperCase().startsWith(q)
        return dept.name.toLowerCase().includes(courseFilter.toLowerCase())
      })
    }))
    .filter(d => d.courses.length > 0)

  function addCourse(course: string) { updateField('courses', [...courses, course].join(', ')); setCourseFilter('') }
  function removeCourse(course: string) { updateField('courses', courses.filter(c => c !== course).join(', ')) }

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

  // Hall groups
  const resHalls = uniData?.RESIDENCE_HALLS || []
  const hallGroups: Record<string, typeof resHalls> = {}
  for (const h of resHalls) { const g = h.group || 'Other'; if (!hallGroups[g]) hallGroups[g] = []; hallGroups[g].push(h) }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-text-muted" size={24} /></div>
  if (!profile) return null

  const inputClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[14px] outline-none focus:border-text-muted transition-colors'
  const selectClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[14px] outline-none focus:border-text-muted transition-colors cursor-pointer'
  const labelClass = 'text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1 block'

  return (
    <div className="max-w-5xl mx-auto px-4 pt-12 pb-28 ">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer press">
            <div className="w-20 h-20 rounded-full bg-bg-input border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera size={24} className="text-text-muted" />}
            </div>
            <div className="absolute bottom-0 right-0 bg-accent text-white rounded-full p-1"><Camera size={10} /></div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Edit Profile</h1>
            {saving && <span className="text-[11px] text-text-muted">Saving...</span>}
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
              <label className={labelClass}>Major</label>
              <select value={profile.major || ''} onChange={(e) => updateField('major', e.target.value)} className={selectClass}>
                <option value="">Select major</option>
                {(uniData?.MAJORS || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Second Major</label>
              <select value={profile.second_major || ''} onChange={(e) => updateField('second_major', e.target.value)} className={selectClass}>
                <option value="">None</option>
                {(uniData?.MAJORS || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Minor</label>
              <select value={profile.minor || ''} onChange={(e) => updateField('minor', e.target.value)} className={selectClass}>
                <option value="">None</option>
                {(uniData?.MINORS || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {resHalls.length > 0 && (
              <div>
                <label className={labelClass}>Residence Hall</label>
                <select value={profile.residence_hall || ''} onChange={(e) => updateField('residence_hall', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {Object.entries(hallGroups).map(([group, halls]) => (
                    <optgroup key={group} label={group}>
                      {halls.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            {sortedDepts.length > 0 && (
              <div>
                <label className={labelClass}>Courses</label>
                {courses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {courses.map(c => (
                      <span key={c} className="inline-flex items-center gap-1 bg-bg-input text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {c}
                        <button type="button" onClick={() => removeCourse(c)} className="text-text-muted hover:text-text"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <input type="text" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setCourseOpen(true) }} onFocus={() => setCourseOpen(true)} className={inputClass} placeholder="Search courses (e.g. CSE)" />
                {courseOpen && (
                  <>
                    <div className="fixed inset-0 z-10" style={{ bottom: '56px' }} onClick={() => setCourseOpen(false)} />
                    <select value="" onChange={(e) => { if (e.target.value) { addCourse(e.target.value); setCourseOpen(false) } }} className={`${selectClass} mt-1 relative z-20`} size={5}>
                      {allCoursesByDept.map(dept => (
                        <optgroup key={dept.code} label={`${dept.code} — ${dept.name}`}>
                          {dept.courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Greek Life & Clubs */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-[13px] font-semibold">Organizations</p>
            {(uniData?.GREEK_LIFE || []).length > 0 && (
              <div>
                <label className={labelClass}>Greek Life</label>
                <select value={profile.fraternity_sorority || ''} onChange={(e) => updateField('fraternity_sorority', e.target.value)} className={selectClass}>
                  <option value="">None</option>
                  {(uniData?.GREEK_LIFE || []).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            {(uniData?.CLUBS || []).length > 0 && (
              <div>
                <label className={labelClass}>Club</label>
                <select value={profile.clubs || ''} onChange={(e) => updateField('clubs', e.target.value)} className={selectClass}>
                  <option value="">None</option>
                  {(uniData?.CLUBS || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
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
              {musicTags.length > 0 && <div className="flex flex-wrap gap-1 mb-1.5">{musicTags.map(t => <span key={t} className="inline-flex items-center gap-1 bg-bg-input text-[11px] font-medium px-2 py-0.5 rounded-full">{t}<button type="button" onClick={() => removeTag('favorite_music', t, musicTags)} className="text-text-muted hover:text-text"><X size={10} /></button></span>)}</div>}
              <input type="text" value={musicInput} onChange={(e) => setMusicInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('favorite_music', musicInput, musicTags, setMusicInput) } }} className={inputClass} placeholder="Type artist, press Enter" />
            </div>
            <div>
              <label className={labelClass}>Movies</label>
              {movieTags.length > 0 && <div className="flex flex-wrap gap-1 mb-1.5">{movieTags.map(t => <span key={t} className="inline-flex items-center gap-1 bg-bg-input text-[11px] font-medium px-2 py-0.5 rounded-full">{t}<button type="button" onClick={() => removeTag('favorite_movies', t, movieTags)} className="text-text-muted hover:text-text"><X size={10} /></button></span>)}</div>}
              <input type="text" value={movieInput} onChange={(e) => setMovieInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('favorite_movies', movieInput, movieTags, setMovieInput) } }} className={inputClass} placeholder="Type movie, press Enter" />
            </div>
            <div>
              <label className={labelClass}>Favorite Quotes</label>
              <textarea value={profile.favorite_quotes || ''} onChange={(e) => updateField('favorite_quotes', e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="&quot;Be the change...&quot;" />
            </div>
          </div>
        </div>
      </div>
  )
}
