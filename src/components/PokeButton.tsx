'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hand, Loader2, Check } from 'lucide-react'

interface PokeButtonProps {
  targetUserId: string
  currentUserId: string
}

export default function PokeButton({ targetUserId, currentUserId }: PokeButtonProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [theyPokedMe, setTheyPokedMe] = useState(false)
  const [justPoked, setJustPoked] = useState(false)

  useEffect(() => {
    checkPoke()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  async function checkPoke() {
    const { data: theirPoke } = await supabase
      .from('pokes')
      .select('id')
      .eq('poker_id', targetUserId)
      .eq('poked_id', currentUserId)
      .maybeSingle()

    if (theirPoke) setTheyPokedMe(true)
    setLoading(false)
  }

  async function handlePoke() {
    setLoading(true)

    // Clear their poke to me if they poked me first
    if (theyPokedMe) {
      await supabase.from('pokes').delete().eq('poker_id', targetUserId).eq('poked_id', currentUserId)
    }

    // Delete existing poke from me, then re-insert (refreshes created_at and seen)
    await supabase.from('pokes').delete().eq('poker_id', currentUserId).eq('poked_id', targetUserId)
    const { error: pokeErr } = await supabase.from('pokes').insert({
      poker_id: currentUserId,
      poked_id: targetUserId,
    })
    if (pokeErr) console.error('Poke insert failed:', pokeErr)

    // Always create a new notification so repeated pokes show up
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: currentUserId,
      type: 'poke',
    })
    if (notifErr) console.error('Poke notification insert failed:', notifErr)

    setTheyPokedMe(false)
    setLoading(false)
    setJustPoked(true)
    setTimeout(() => setJustPoked(false), 3000)
  }

  if (loading) {
    return (
      <button disabled className="bg-bg-card border border-border rounded-xl py-2 px-4 text-[13px] font-medium flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin" />
      </button>
    )
  }

  if (justPoked) {
    return (
      <button disabled className="bg-accent/10 border border-accent/20 rounded-xl py-2 px-4 text-[13px] font-medium flex items-center justify-center gap-2 text-accent">
        <Check size={14} /> Poked!
      </button>
    )
  }

  return (
    <button
      onClick={handlePoke}
      className="bg-bg-card border border-border rounded-xl py-2 px-4 text-[13px] font-medium press flex items-center justify-center gap-2 hover:bg-bg-card-hover"
    >
      <Hand size={14} /> {theyPokedMe ? 'Poke Back' : 'Poke'}
    </button>
  )
}
