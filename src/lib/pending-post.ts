// Where we stash a draft when a signed-out user clicks Post. After the user
// signs in, /feed picks this up and submits it on their behalf.
export const PENDING_POST_KEY = 'rabona:pending-post'

export interface PendingPost {
  content: string
  ts: number
}

const MAX_AGE_MS = 30 * 60 * 1000

export function readPendingPost(): PendingPost | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_POST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPost
    if (!parsed?.content || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > MAX_AGE_MS) {
      localStorage.removeItem(PENDING_POST_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingPost() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(PENDING_POST_KEY) } catch {}
}

export function writePendingPost(content: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PENDING_POST_KEY, JSON.stringify({ content, ts: Date.now() }))
  } catch {}
}
