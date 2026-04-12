'use client'

import Link from 'next/link'

// Renders text with @mentions as clickable links
// Format: @[Name](userId)
export default function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@\[([^\]]+)\]\(([^)]+)\))/)
  const elements: React.ReactNode[] = []

  let i = 0
  while (i < parts.length) {
    // parts pattern: text, fullMatch, name, userId, text, ...
    if (i + 3 < parts.length && parts[i + 1] && parts[i + 2] && parts[i + 3]) {
      // Check if this is a mention match
      const fullMatch = parts[i + 1]
      if (fullMatch && fullMatch.startsWith('@[')) {
        elements.push(<span key={i}>{parts[i]}</span>)
        elements.push(
          <Link
            key={i + 1}
            href={`/profile/${parts[i + 3]}`}
            className="text-accent font-semibold hover:underline"
          >
            @{parts[i + 2]}
          </Link>
        )
        i += 4
        continue
      }
    }
    if (parts[i]) elements.push(<span key={i}>{parts[i]}</span>)
    i++
  }

  return <>{elements}</>
}
