'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MentionSuggestion {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

interface ActiveQuery {
  start: number
  end: number
  text: string
}

interface UseMentionAutocompleteArgs {
  value: string
  setValue: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  onSelect?: (s: MentionSuggestion) => void
}

export const USERNAME_REGEX = /@([a-z0-9_]{3,20})/gi

export function useMentionAutocomplete({ value, setValue, inputRef, onSelect }: UseMentionAutocompleteArgs) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([])
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const detectMention = useCallback(() => {
    const el = inputRef.current
    if (!el) { setActiveQuery(null); return }
    const cursor = el.selectionStart ?? 0
    const before = value.slice(0, cursor)
    const match = before.match(/(?:^|\s)@([A-Za-z0-9_]{0,20})$/)
    if (match) {
      const query = match[1]
      const start = cursor - query.length - 1
      setActiveQuery({ start, end: cursor, text: query.toLowerCase() })
      setHighlightIndex(0)
    } else {
      setActiveQuery(null)
    }
  }, [inputRef, value])

  useEffect(() => { detectMention() }, [detectMention])

  useEffect(() => {
    if (!activeQuery) { setSuggestions([]); return }
    const supabase = createClient()
    let cancelled = false

    async function search(q: string) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('hidden_from_directory', false)
        .neq('id', user.id)
        .order('username', { ascending: true })
        .limit(6)
      if (q.length > 0) {
        query = query.or(`username.ilike.${q}%,full_name.ilike.${q}%`)
      }
      const { data } = await query
      if (!cancelled && data) setSuggestions(data as MentionSuggestion[])
    }

    const t = setTimeout(() => search(activeQuery.text), 120)
    return () => { cancelled = true; clearTimeout(t) }
  }, [activeQuery])

  const select = useCallback((s: MentionSuggestion) => {
    if (!activeQuery) return
    const before = value.slice(0, activeQuery.start)
    const after = value.slice(activeQuery.end)
    const insert = `@${s.username} `
    const next = before + insert + after
    setValue(next)
    setActiveQuery(null)
    setSuggestions([])
    onSelect?.(s)
    const newCursor = before.length + insert.length
    setTimeout(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(newCursor, newCursor)
      }
    }, 0)
  }, [activeQuery, value, setValue, inputRef, onSelect])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeQuery || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      select(suggestions[highlightIndex])
    } else if (e.key === 'Escape') {
      setActiveQuery(null)
    }
  }, [activeQuery, suggestions, highlightIndex, select])

  return { suggestions, activeQuery, highlightIndex, setHighlightIndex, select, onKeyDown }
}

interface MentionDropdownProps {
  suggestions: MentionSuggestion[]
  highlightIndex: number
  onSelect: (s: MentionSuggestion) => void
  onHover?: (i: number) => void
  className?: string
}

export function MentionDropdown({ suggestions, highlightIndex, onSelect, onHover, className }: MentionDropdownProps) {
  if (suggestions.length === 0) return null
  return (
    <div
      className={`absolute left-0 right-0 z-30 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto ${className || ''}`}
    >
      {suggestions.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onMouseEnter={() => onHover?.(i)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
          className={`flex items-center gap-2 w-full px-3 py-2 text-left ${i === highlightIndex ? 'bg-bg-input' : ''}`}
        >
          <div className="w-7 h-7 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
            {s.avatar_url ? (
              <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                {s.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate">@{s.username}</p>
            <p className="text-[11px] text-text-muted truncate">{s.full_name}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

export function extractMentionHandles(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(USERNAME_REGEX)) {
    out.add(m[1].toLowerCase())
  }
  return [...out]
}

export async function notifyMentions(
  supabase: ReturnType<typeof createClient>,
  actorId: string,
  text: string,
  target: { post_type?: 'wall_post' | 'group_post'; post_id?: string; comment_id?: string }
): Promise<string[]> {
  const handles = extractMentionHandles(text)
  if (handles.length === 0) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', handles)
  const users = (data || []).filter(p => p.id !== actorId)
  if (users.length === 0) return []
  for (const u of users) {
    await supabase.from('notifications').insert({
      user_id: u.id,
      actor_id: actorId,
      type: 'mention',
      post_type: target.post_type ?? null,
      post_id: target.post_id ?? null,
      comment_id: target.comment_id ?? null,
    })
  }
  return users.map(u => u.id)
}
