'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  placeholder?: string
  maxLength?: number
  className?: string
  autoFocus?: boolean
  multiline?: boolean
}

interface UserSuggestion {
  id: string
  full_name: string
  avatar_url: string | null
}

export default function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  maxLength = 2000,
  className = '',
  autoFocus = false,
  multiline = false,
}: MentionInputProps) {
  const supabase = createClient()
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .ilike('full_name', `%${query}%`)
      .limit(6)

    if (data) setSuggestions(data)
  }, [supabase])

  function handleChange(newValue: string) {
    onChange(newValue)

    // Detect @ mentions
    const el = inputRef.current
    if (!el) return
    const cursorPos = el.selectionStart || 0
    const textBeforeCursor = newValue.slice(0, cursorPos)

    // Find the last @ that isn't inside a mention link
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex >= 0) {
      // Make sure this @ isn't part of an existing mention @[Name](id)
      const beforeAt = textBeforeCursor.slice(0, atIndex)
      const afterAt = textBeforeCursor.slice(atIndex + 1)

      // Don't trigger if preceded by a letter/digit (email-like) or inside a mention
      if (atIndex > 0 && /\w/.test(textBeforeCursor[atIndex - 1])) {
        setShowSuggestions(false)
        return
      }

      // Don't trigger if this is inside a completed mention
      if (beforeAt.includes('@[') && !beforeAt.endsWith(')')) {
        setShowSuggestions(false)
        return
      }

      const query = afterAt.split(/[\s@]/)[0] || ''
      if (query.length >= 0 && !afterAt.includes(']')) {
        setMentionQuery(query)
        setMentionStart(atIndex)
        setShowSuggestions(true)
        setSelectedIndex(0)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => searchUsers(query), 150)
        return
      }
    }

    setShowSuggestions(false)
  }

  function insertMention(user: UserSuggestion) {
    const el = inputRef.current
    if (!el) return

    const before = value.slice(0, mentionStart)
    const cursorPos = el.selectionStart || value.length
    const after = value.slice(cursorPos)

    // Remove the @query and replace with mention
    const afterClean = after.replace(/^\S*/, '')
    const mention = `@[${user.full_name}](${user.id})`
    const newValue = before + mention + ' ' + afterClean

    onChange(newValue)
    setShowSuggestions(false)
    setSuggestions([])

    // Refocus and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const pos = before.length + mention.length + 1
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        return
      }
    }
    onKeyDown?.(e)
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-resize for multiline
  useEffect(() => {
    if (multiline && inputRef.current) {
      const ta = inputRef.current as HTMLTextAreaElement
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [value, multiline])

  // Display text: replace @[Name](id) with just @Name for display
  const displayValue = value

  const sharedProps = {
    value: displayValue,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => handleChange(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder,
    maxLength,
    className,
    autoFocus,
  }

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          {...sharedProps}
          className={`${className} resize-none overflow-hidden`}
        />
      ) : (
        <input
          type="text"
          ref={inputRef as React.RefObject<HTMLInputElement>}
          {...sharedProps}
        />
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 bottom-full mb-1 bg-bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto"
        >
          {suggestions.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-left press ${idx === selectedIndex ? 'bg-bg-input' : 'hover:bg-bg-input/50'}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="w-6 h-6 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-text-muted">
                    {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <span className="text-[13px] font-medium truncate">{user.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper: extract mentioned user IDs from text
export function extractMentionIds(text: string): string[] {
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[1])
  }
  return ids
}
