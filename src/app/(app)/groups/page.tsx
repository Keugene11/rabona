'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, Users, Search } from 'lucide-react'
import Link from 'next/link'
import type { Group } from '@/types'

export default function GroupsPage() {
  const supabase = createClient()
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadGroups() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Get groups I'm in
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    const myGroupIds = (memberships || []).map(m => m.group_id)

    // Get current user's university
    const { data: myProfile } = await supabase.from('profiles').select('university').eq('id', user.id).single()
    const myUniversity = myProfile?.university || 'cornell'

    // Get all groups for this university
    const { data: groups } = await supabase
      .from('groups')
      .select('*, creator:profiles!groups_created_by_fkey(*)')
      .eq('university', myUniversity)
      .order('created_at', { ascending: false })

    if (groups) {
      // Get member counts
      const { data: counts } = await supabase
        .from('group_members')
        .select('group_id')

      const countMap: Record<string, number> = {}
      for (const c of counts || []) {
        countMap[c.group_id] = (countMap[c.group_id] || 0) + 1
      }

      const withCounts = groups.map(g => ({ ...g, member_count: countMap[g.id] || 0 })) as Group[]
      setMyGroups(withCounts.filter(g => myGroupIds.includes(g.id)))
      setAllGroups(withCounts.filter(g => !myGroupIds.includes(g.id)))
    }

    setLoading(false)
  }

  const filteredAll = search
    ? allGroups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase()))
    : allGroups

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-28 ">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">Groups</h1>
        <Link href="/groups/create" className="press bg-accent text-white rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5">
          <Plus size={14} /> Create
        </Link>
      </div>

      {/* My Groups */}
      {myGroups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-semibold text-text-muted mb-2">Your Groups</h2>
          <div className="space-y-2">
            {myGroups.map(g => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </div>
      )}

      {/* Browse All */}
      <div>
        <h2 className="text-[14px] font-semibold text-text-muted mb-2">Browse Groups</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
          />
        </div>
        {filteredAll.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-text-muted text-[14px]">
              {search ? 'No groups found.' : 'No other groups to browse.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAll.map(g => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link href={`/groups/${group.id}`} className="press block">
      <div className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:bg-bg-card-hover transition-colors">
        <div className="w-12 h-12 rounded-xl bg-bg-input border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
          {group.image_url ? (
            <img src={group.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users size={20} className="text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate">{group.name}</p>
          <p className="text-[12px] text-text-muted truncate">{group.member_count || 0} member{group.member_count !== 1 ? 's' : ''} · {group.group_type}</p>
        </div>
      </div>
    </Link>
  )
}
