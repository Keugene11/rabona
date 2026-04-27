'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, MapPin, BookOpen, GraduationCap, Heart, MessageCircle, Clock, Home, School, Cake, Phone, Globe, Mail, Eye, Ban, Flag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile, WallPost } from '@/types'
import { EMAIL_HIDDEN_FROM_OTHERS } from '@/lib/constants'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import FriendButton from '@/components/FriendButton'
import PokeButton from '@/components/PokeButton'
import WallPostForm from '@/components/WallPostForm'
import WallPostItem from '@/components/WallPost'

export default function ProfileViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallPosts, setWallPosts] = useState<WallPost[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isFriend, setIsFriend] = useState(false)
  const [friends, setFriends] = useState<Profile[]>([])
  const [profileViews, setProfileViews] = useState<Profile[]>([])
  const [showViewers, setShowViewers] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [activeTab, setActiveTab] = useState<'wall' | 'info'>('wall')
  const [reportSent, setReportSent] = useState(false)
  const [notInNetwork, setNotInNetwork] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const { data: profileData } = await supabase
      .from('profiles')
      .select(PROFILE_PUBLIC_COLUMNS)
      .eq('id', id)
      .single<Profile>()

    if (profileData) {
      // Hide flagged profiles from other users
      if (profileData.hidden_from_directory && user && user.id !== id) {
        setLoading(false)
        return
      }
      // Check if same university
      if (user) {
        const { data: myProfile } = await supabase.from('profiles').select('university').eq('id', user.id).single()
        if (myProfile && profileData.university && myProfile.university !== profileData.university) {
          setNotInNetwork(true)
          setLoading(false)
          return
        }
      }
      // Fetch email/phone via RPC (respects private_fields)
      const { data: contact } = await supabase.rpc('get_profile_contact', { p_profile_id: id })
      const contactRow = Array.isArray(contact) ? contact[0] : contact
      setProfile({ ...profileData, email: contactRow?.email ?? '', phone: contactRow?.phone ?? '' })
    }

    // Check if current user is friends with this profile (accepted friendship in either direction)
    if (user) {
      const { data: friendCheck } = await supabase
        .from('friendships')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
        .maybeSingle()

      setIsFriend(!!friendCheck)
    }

    // Load wall posts
    const { data: posts } = await supabase
      .from('wall_posts')
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('wall_owner_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (posts) setWallPosts(posts as WallPost[])

    // Load friends (accepted friendships in either direction)
    const { data: friendData } = await supabase
      .from('friendships')
      .select(`requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_PUBLIC_COLUMNS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`)

    if (friendData) {
      // RLS returns only mutuals when viewing someone else's profile, plus the row
      // representing the viewer's own friendship with the profile owner — strip the viewer.
      const viewerId = user?.id
      const others = friendData.map(f =>
        (f.requester_id === id ? f.addressee : f.requester) as unknown as Profile
      ).filter(p => p && !p.hidden_from_directory && p.id !== viewerId)
      const unique = Array.from(new Map(others.map(p => [p.id, p])).values())
      setFriends(unique)
    }

    // Check if blocked
    if (user && user.id !== id) {
      const { data: block } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', id)
        .maybeSingle()
      setIsBlocked(!!block)
    }

    // Track profile view (if viewing someone else)
    if (user && user.id !== id) {
      await supabase.from('profile_views').upsert(
        { profile_id: id, viewer_id: user.id, created_at: new Date().toISOString() },
        { onConflict: 'profile_id,viewer_id' }
      )
    }

    // Load profile viewers (for own profile)
    if (user && user.id === id) {
      const { data: views } = await supabase
        .from('profile_views')
        .select(`*, viewer:profiles!profile_views_viewer_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
        .eq('profile_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (views) setProfileViews(views.map((v: { viewer: Profile }) => v.viewer).filter(p => !p.hidden_from_directory))
    }

    setLoading(false)
  }

  async function toggleBlock() {
    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', id)
      setIsBlocked(false)
    } else {
      await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: id })
      // Also remove follows in both directions
      await supabase.from('friendships').delete().eq('requester_id', currentUserId).eq('addressee_id', id)
      await supabase.from('friendships').delete().eq('requester_id', id).eq('addressee_id', currentUserId)
      setIsBlocked(true)
      setIsFriend(false)
    }
  }

  async function submitReport() {
    if (!reportReason) return
    await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_id: id,
      reason: reportReason,
      details: reportDetails.trim(),
    })
    setReportSent(true)
    setTimeout(() => { setShowReport(false); setReportSent(false); setReportReason(''); setReportDetails('') }, 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  if (notInNetwork) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-6 text-center">
        <p className="text-text-muted">This user is not in your school&apos;s network.</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-6 text-center">
        <p className="text-text-muted">User not found.</p>
      </div>
    )
  }

  const privateFields = profile.private_fields ? profile.private_fields.split(',').filter(Boolean) : []
  const isOwn = currentUserId === id
  const show = (field: string, value: string | null | undefined) => {
    if (isOwn) return true
    if (!value || value === 'None') return false
    if (field === 'email' && EMAIL_HIDDEN_FROM_OTHERS.includes(value)) return false
    if (privateFields.includes(field)) return false
    if (privateFields.includes(`${field}:followers`)) return isFriend
    return true
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-28">

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="bg-bg-card border border-border rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <p className="text-[14px] text-center py-4">Report submitted. Thank you.</p>
            ) : (
              <>
                <h3 className="text-[16px] font-bold mb-3">Report {profile.full_name}</h3>
                <p className="text-[12px] text-text-muted mb-3">Select a reason for reporting this user.</p>
                <div className="space-y-1.5 mb-3">
                  {['Harassment', 'Spam', 'Fake account', 'Inappropriate content', 'Other'].map(r => (
                    <button
                      key={r}
                      onClick={() => setReportReason(r)}
                      className={`press w-full text-left px-3 py-2 rounded-xl text-[13px] border ${reportReason === r ? 'border-accent text-accent' : 'border-border text-text-muted'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Additional details (optional)..."
                  className="w-full bg-bg-input rounded-lg px-3 py-2 text-[13px] outline-none resize-none h-16 border border-border mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowReport(false)} className="press flex-1 py-2 rounded-xl text-[13px] border border-border text-text-muted">
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!reportReason}
                    className="press flex-1 py-2 rounded-xl text-[13px] font-medium bg-text text-bg disabled:opacity-40"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile profile header (visible on wall tab) */}
      {!isOwn && (
        <div className="flex items-center gap-3 mb-4 md:hidden">
          <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold tracking-tight truncate">{profile.full_name}</h1>
            {profile.username && <p className="text-[12px] text-text-muted truncate">@{profile.username}</p>}
            {(profile.age || profile.class_year) && (
              <p className="text-[12px] text-text-muted truncate">
                {[profile.age ? `${profile.age}` : null, profile.class_year ? `'${profile.class_year.toString().slice(-2)}` : null].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="flex gap-0 mb-4 md:hidden border-b border-border">
        <button
          onClick={() => setActiveTab('wall')}
          className={`press flex-1 py-2.5 text-[14px] font-semibold text-center border-b-2 transition-colors ${activeTab === 'wall' ? 'border-text text-text' : 'border-transparent text-text-muted'}`}
        >
          Wall
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`press flex-1 py-2.5 text-[14px] font-semibold text-center border-b-2 transition-colors ${activeTab === 'info' ? 'border-text text-text' : 'border-transparent text-text-muted'}`}
        >
          Info
        </button>
      </div>

      {/* Desktop: two-column layout / Mobile: tabbed content */}
      <div className="flex flex-col md:flex-row md:gap-6 md:items-start">

        {/* LEFT COLUMN — Profile info */}
        <div className={`md:w-[340px] md:flex-shrink-0 md:sticky md:top-4 ${activeTab === 'info' ? 'block' : 'hidden'} md:block`}>

          {/* Name & subtitle */}
          <div className="mb-3">
            <h1 className="text-[22px] font-bold tracking-tight">{profile.full_name}</h1>
            {profile.username && <p className="text-[13px] text-text-muted mt-0.5">@{profile.username}</p>}
            <div className="text-[13px] text-text-muted space-y-0.5 mt-0.5">
              {(profile.age || profile.class_year) && (
                <p>{[profile.age ? `${profile.age}` : null, profile.class_year ? `'${profile.class_year.toString().slice(-2)}` : null].filter(Boolean).join(' · ')}</p>
              )}
              {profile.last_seen && (
                <p className="flex items-center gap-1">
                  <Clock size={12} /> {getLastSeen(profile.last_seen)}
                </p>
              )}
            </div>
          </div>

          {/* Avatar */}
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-4 mb-4">
            <div className="w-full aspect-square rounded-xl bg-bg-input border border-border overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted text-[64px] font-bold">
                  {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {currentUserId && currentUserId !== id && !isBlocked && (
            <div className="flex gap-2 mb-4">
              <FriendButton targetUserId={id} currentUserId={currentUserId} />
              <PokeButton targetUserId={id} currentUserId={currentUserId} />
              <button
                onClick={async () => {
                  const res = await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUserId: id }),
                  })
                  const conv = await res.json()
                  if (conv.id) router.push(`/messages/${conv.id}`)
                }}
                className="bg-bg-card border border-border rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2 hover:bg-bg-card-hover"
              >
                <MessageCircle size={14} /> Message
              </button>
            </div>
          )}

          {/* Block / Report */}
          {currentUserId && currentUserId !== id && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={toggleBlock}
                className={`press flex items-center gap-1.5 rounded-xl py-1.5 px-3 text-[12px] font-medium border ${isBlocked ? 'border-text/40 text-text' : 'border-border text-text-muted hover:text-text'}`}
              >
                <Ban size={13} />
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
              <button
                onClick={() => setShowReport(true)}
                className="press flex items-center gap-1.5 rounded-xl py-1.5 px-3 text-[12px] font-medium border border-border text-text-muted hover:text-text"
              >
                <Flag size={13} />
                Report
              </button>
            </div>
          )}

          {/* Profile views (own profile only) */}
          {isOwn && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-4">
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
          )}

          {/* Blocked state */}
          {isBlocked && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3 text-center">
              <p className="text-[13px] text-text-muted">You have blocked this user.</p>
            </div>
          )}

          {/* About */}
          {profile.about_me && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3">
              <p className="text-[14px]">{profile.about_me}</p>
            </div>
          )}

          {/* Friends — full list on own profile, mutuals only when viewing someone else */}
          {friends.length > 0 && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold">
                  {currentUserId === id ? 'Friends' : 'Mutual friends'} ({friends.length})
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {friends.map(f => (
                  <Link key={f.id} href={`/profile/${f.id}`} className="press flex flex-col items-center gap-1.5">
                    <div className="w-16 h-16 rounded-full bg-bg-input border-2 border-border overflow-hidden">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[18px] font-bold text-text-muted">
                          {f.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-center truncate w-full">{f.full_name?.split(' ')[0]}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Academics */}
          {(show('university', profile.university) || show('major', profile.major) || profile.class_year) && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3">
              <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5">Academics</p>
              <div className="space-y-0.5">
                {show('university', profile.university) && <div className="flex items-center gap-2 text-[13px] py-0.5"><School size={13} className="text-text-muted flex-shrink-0" /><span>{profile.university}</span></div>}
                {show('major', profile.major) && <div className="flex items-center gap-2 text-[13px] py-0.5"><GraduationCap size={13} className="text-text-muted flex-shrink-0" /><span>{profile.major}</span></div>}
                {profile.class_year && <div className="flex items-center gap-2 text-[13px] py-0.5"><GraduationCap size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">Class of</span> <span>{profile.class_year}</span></div>}
              </div>
            </div>
          )}

          {/* Personal */}
          {(show('hometown', profile.hometown) || show('high_school', profile.high_school) || (show('age', profile.age?.toString()) && profile.age) || show('birthday', profile.birthday) || (show('relationship_status', profile.relationship_status) && profile.relationship_status !== 'Prefer not to say') || (show('interested_in', profile.interested_in) && profile.interested_in !== 'Prefer not to say') || show('looking_for', profile.looking_for) || show('political_views', profile.political_views)) && (
          <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3 space-y-0.5">
            {show('hometown', profile.hometown) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Home size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">From:</span> <span>{profile.hometown}</span></div>}
            {show('high_school', profile.high_school) && <div className="flex items-center gap-2 text-[13px] py-0.5"><School size={13} className="text-text-muted flex-shrink-0" /><span>{profile.high_school}</span></div>}
            {show('age', profile.age?.toString()) && profile.age && <div className="flex items-center gap-2 text-[13px] py-0.5"><Cake size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">Age:</span> <span>{profile.age}</span></div>}
            {show('birthday', profile.birthday) && !isNaN(new Date(profile.birthday + 'T00:00:00').getTime()) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Cake size={13} className="text-text-muted flex-shrink-0" /><span>{new Date(profile.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span></div>}
            {show('relationship_status', profile.relationship_status) && profile.relationship_status !== 'Prefer not to say' && <div className="flex items-center gap-2 text-[13px] py-0.5"><Heart size={13} className="text-text-muted flex-shrink-0" /><span>{profile.relationship_status}</span></div>}
            {show('interested_in', profile.interested_in) && profile.interested_in !== 'Prefer not to say' && <div className="flex items-center gap-2 text-[13px] py-0.5"><Heart size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">Interested in:</span> <span>{profile.interested_in}</span></div>}
            {show('looking_for', profile.looking_for) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Heart size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">Looking for:</span> <span>{profile.looking_for}</span></div>}
            {show('political_views', profile.political_views) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Globe size={13} className="text-text-muted flex-shrink-0" /><span className="text-text-muted">Political Views:</span> <span>{profile.political_views}</span></div>}
          </div>
          )}

          {/* Contact */}
          {(show('email', profile.email) || show('phone', profile.phone) || show('websites', profile.websites)) && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3 space-y-0.5">
              {show('email', profile.email) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Mail size={13} className="text-text-muted flex-shrink-0" /><span className="text-accent break-all">{profile.email}</span></div>}
              {show('phone', profile.phone) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Phone size={13} className="text-text-muted flex-shrink-0" /><span>{profile.phone}</span></div>}
              {show('websites', profile.websites) && <div className="flex items-center gap-2 text-[13px] py-0.5"><Globe size={13} className="text-text-muted flex-shrink-0" /><span className="text-accent break-all">{profile.websites}</span></div>}
            </div>
          )}

          {/* Favorites */}
          {(profile.favorite_music || profile.favorite_movies || profile.interests || profile.favorite_quotes) && (
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3 mb-3 space-y-2">
              {profile.interests && <div><p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Interests</p><p className="text-[13px]">{profile.interests}</p></div>}
              {profile.favorite_music && <div><p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Favorite Music</p><p className="text-[13px]">{profile.favorite_music}</p></div>}
              {profile.favorite_movies && <div><p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Favorite Movies</p><p className="text-[13px]">{profile.favorite_movies}</p></div>}
              {profile.favorite_quotes && <div><p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Quotes</p><p className="text-[13px] italic">&ldquo;{profile.favorite_quotes}&rdquo;</p></div>}
            </div>
          )}

          <p className="text-[11px] text-text-muted px-1">Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* RIGHT COLUMN — The Wall */}
        <div className={`flex-1 min-w-0 ${activeTab === 'wall' ? 'block' : 'hidden'} md:block`}>
        {!isOwn && !isFriend ? (
          <div className="bg-bg-card border border-border rounded-2xl p-6 text-center mt-3">
            <p className="text-text-muted text-[14px]">Become friends with {profile.full_name?.split(' ')[0]} to see their wall.</p>
          </div>
        ) : (
          <>
            {currentUserId && !isBlocked && (
              <WallPostForm
                wallOwnerId={id}
                onPost={(post) => setWallPosts([post, ...wallPosts])}
              />
            )}
            {wallPosts.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-2xl p-6 text-center mt-3">
                <p className="text-text-muted text-[14px]">No wall posts yet.</p>
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                {wallPosts.map(post => (
                  <WallPostItem
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    wallOwnerId={id}
                    isFriend={true}
                    onDelete={(postId) => setWallPosts(wallPosts.filter(p => p.id !== postId))}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </div>

    </div>
  )
}

function getLastSeen(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'Online now'
  if (seconds < 120) return 'Last seen 1 minute ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Last seen ${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Last seen ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Last seen yesterday'
  if (days < 7) return `Last seen ${days} days ago`
  return `Last seen ${new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
