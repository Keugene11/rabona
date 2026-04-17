'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import DirectoryFilters from '@/components/DirectoryFilters'
import ProfileCard from '@/components/ProfileCard'
import { getUniversityData, type UniversityData } from '@/lib/university-data'
import { getUniversityBySlug } from '@/lib/universities'
import type { Profile } from '@/types'
import { HIDDEN_EMAILS } from '@/lib/constants'

interface Filters {
  name: string
  residence_hall: string
  gender: string
  major: string
  class_year: string
  hometown: string
  high_school: string
  relationship_status: string
  interested_in: string
}

const emptyFilters: Filters = {
  name: '',
  residence_hall: '',
  gender: '',
  major: '',
  class_year: '',
  hometown: '',
  high_school: '',
  relationship_status: '',
  interested_in: '',
}

export default function DirectoryPage() {
  const supabase = createClient()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [uniData, setUniData] = useState<UniversityData | null>(null)
  const [uniName, setUniName] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: blocks } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)
      const blocked = blocks ? blocks.map(b => b.blocked_id) : []

      // Get friends (accepted friendships in either direction)
      const { data: friendData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      const friendSet = new Set((friendData || []).map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      ))
      setFriendIds(friendSet)

      // Get current user's university to filter directory
      const { data: myProfile } = await supabase.from('profiles').select('university').eq('id', user.id).single()
      const myUniversity = myProfile?.university || 'stonybrook'
      const ud = await getUniversityData(myUniversity)
      setUniData(ud)
      setUniName(getUniversityBySlug(myUniversity)?.name || '')

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, major, class_year, gender, residence_hall, hometown, high_school, relationship_status, interested_in, last_seen')
        .eq('university', myUniversity)
        .not('email', 'in', `(${HIDDEN_EMAILS.join(',')})`)
        .order('last_seen', { ascending: false, nullsFirst: false })

      if (profiles) {
        const filtered = (profiles as Profile[]).filter(p => !blocked.includes(p.id))
        // Friends first, then sorted by last_seen (already sorted from DB)
        const friends = filtered.filter(p => friendSet.has(p.id))
        const others = filtered.filter(p => !friendSet.has(p.id))
        setAllUsers([...friends, ...others])
      }
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayList = allUsers.filter(p => {
    if (filters.name && !p.full_name.toLowerCase().includes(filters.name.toLowerCase())) return false
    if (filters.residence_hall && p.residence_hall !== filters.residence_hall) return false
    if (filters.major && p.major !== filters.major) return false
    if (filters.gender && p.gender !== filters.gender) return false
    if (filters.class_year && p.class_year?.toString() !== filters.class_year) return false
    if (filters.hometown && !p.hometown?.toLowerCase().includes(filters.hometown.toLowerCase())) return false
    if (filters.high_school && !p.high_school?.toLowerCase().includes(filters.high_school.toLowerCase())) return false
    if (filters.relationship_status && p.relationship_status !== filters.relationship_status) return false
    if (filters.interested_in && p.interested_in !== filters.interested_in) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-28 ">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Directory</h1>
        {uniName && <p className="text-[13px] text-text-muted">{uniName}</p>}
        <div className="accent-bar" />
      </div>

      <DirectoryFilters
        filters={filters}
        onChange={setFilters}
        majors={uniData?.MAJORS}
        residenceHalls={uniData?.RESIDENCE_HALLS}
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-text-muted" size={24} />
          </div>
        ) : displayList.length > 0 ? (
          <div className="space-y-4">
            {(() => {
              const friendList = displayList.filter(p => friendIds.has(p.id))
              const otherList = displayList.filter(p => !friendIds.has(p.id))
              return (
                <>
                  {friendList.length > 0 && (
                    <div>
                      <p className="text-[12px] text-text-muted font-semibold uppercase tracking-wide mb-2">Friends · {friendList.length}</p>
                      <div className="space-y-2">
                        {friendList.map(profile => (
                          <ProfileCard key={profile.id} profile={profile} />
                        ))}
                      </div>
                    </div>
                  )}
                  {otherList.length > 0 && (
                    <div>
                      <p className="text-[12px] text-text-muted font-semibold uppercase tracking-wide mb-2">Everyone · {otherList.length}</p>
                      <div className="space-y-2">
                        {otherList.map(profile => (
                          <ProfileCard key={profile.id} profile={profile} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-text-muted text-[14px]">No students found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
