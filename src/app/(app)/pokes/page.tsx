'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Hand } from 'lucide-react'
import Link from 'next/link'
import type { Poke, Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'

export default function PokesPage() {
  const supabase = createClient()
  const [pokes, setPokes] = useState<(Poke & { poker: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadPokes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPokes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase
      .from('pokes')
      .select(`*, poker:profiles!pokes_poker_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('poked_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setPokes(data as (Poke & { poker: Profile })[])

    // Mark all as seen
    await supabase
      .from('pokes')
      .update({ seen: true })
      .eq('poked_id', user.id)
      .eq('seen', false)

    setLoading(false)
  }

  async function pokeBack(pokerId: string, pokeId: string) {
    // Delete their poke to me
    await supabase.from('pokes').delete().eq('id', pokeId)

    // Delete any existing poke from me, then re-insert
    await supabase.from('pokes').delete().eq('poker_id', userId).eq('poked_id', pokerId)
    await supabase.from('pokes').insert({
      poker_id: userId,
      poked_id: pokerId,
    })

    // Always create a new notification so repeated pokes show up
    await supabase.from('notifications').insert({
      user_id: pokerId,
      actor_id: userId,
      type: 'poke',
    })

    setPokes(pokes.filter(p => p.id !== pokeId))
  }

  async function dismiss(pokeId: string) {
    await supabase.from('pokes').delete().eq('id', pokeId)
    setPokes(pokes.filter(p => p.id !== pokeId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 ">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">
          <Hand size={24} className="inline mr-2" />
          Pokes
        </h1>
        <div className="accent-bar" />
      </div>

      {pokes.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-text-muted text-[14px]">No pokes right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pokes.map(poke => (
            <div key={poke.id} className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
              <Link href={`/profile/${poke.poker_id}`} className="press flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden">
                  {poke.poker?.avatar_url ? (
                    <img src={poke.poker.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[14px] font-bold text-text-muted">
                      {poke.poker?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${poke.poker_id}`} className="text-[14px] font-semibold hover:underline">
                  {poke.poker?.full_name}
                </Link>
                <span className="text-[14px] text-text-muted"> poked you</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => pokeBack(poke.poker_id, poke.id)}
                  className="bg-accent text-white rounded-xl px-3 py-1.5 text-[12px] font-medium press flex items-center gap-1"
                >
                  <Hand size={12} /> Poke Back
                </button>
                <button
                  onClick={() => dismiss(poke.id)}
                  className="bg-bg-input border border-border rounded-xl px-3 py-1.5 text-[12px] font-medium press"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
