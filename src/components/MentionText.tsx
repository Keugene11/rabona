'use client'

import Link from 'next/link'
import { USERNAME_REGEX } from '@/components/MentionAutocomplete'

interface MentionTextProps {
  text: string
  className?: string
}

export default function MentionText({ text, className }: MentionTextProps) {
  const parts: React.ReactNode[] = []
  const regex = new RegExp(USERNAME_REGEX.source, 'gi')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const handle = match[1].toLowerCase()
    parts.push(
      <Link
        key={`m-${match.index}`}
        href={`/u/${handle}`}
        onClick={(e) => e.stopPropagation()}
        className="text-accent font-medium hover:underline"
      >
        @{handle}
      </Link>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return <span className={className}>{parts}</span>
}
