'use client'

import { useState, useEffect } from 'react'
import { Link2, Check } from 'lucide-react'

export default function InviteLinkCard({ username, className = '' }: { username: string; className?: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  if (!username || !origin) return null

  const url = `${origin}/join/${username}`

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copy your invite link:', url)
        }
      }}
      className={`press bg-bg-card border border-border rounded-2xl px-4 py-3 w-full flex items-center gap-2.5 text-left ${className}`}
    >
      {copied ? <Check size={16} className="text-accent flex-shrink-0" /> : <Link2 size={16} className="text-text-muted flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Your invite link{copied ? ' · Copied!' : ''}</p>
        <p className="text-[13px] truncate">{origin.replace(/^https?:\/\//, '')}/join/{username}</p>
      </div>
    </button>
  )
}
