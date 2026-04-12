'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Option {
  value: string
  label: string
  group?: string
}

interface StyledSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
  searchable?: boolean
}

export default function StyledSelect({ value, onChange, options, placeholder, searchable = false }: StyledSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label

  useEffect(() => {
    if (open && searchable && inputRef.current) inputRef.current.focus()
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const groups: Record<string, Option[]> = {}
  for (const opt of filtered) {
    const g = opt.group || ''
    if (!groups[g]) groups[g] = []
    groups[g].push(opt)
  }

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-bg-input text-[13px] font-medium px-3 py-2 rounded-xl">
          {selectedLabel || value}
          <button type="button" onClick={() => onChange('')} className="text-text-muted hover:text-text">
            <X size={14} />
          </button>
        </span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[14px] text-left flex items-center justify-between outline-none focus:border-text-muted transition-colors"
      >
        <span className="text-text-muted/50">{placeholder}</span>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-bg-input rounded-lg px-3 py-1.5 text-[13px] outline-none placeholder:text-text-muted/50"
              />
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto">
            {Object.entries(groups).map(([group, opts]) => (
              <div key={group}>
                {group && (
                  <p className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wide font-semibold bg-bg-input/50">{group}</p>
                )}
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-bg-card-hover transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-[13px] text-text-muted text-center">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
