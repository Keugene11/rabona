// Tracks the first time the current user saw each post on the feed, so we can
// drop posts they've been carrying around for >24h below an "already seen"
// divider. Stored in localStorage, scoped per user id.

const KEY_PREFIX = 'rabona:seen-posts:'
const TTL_MS = 24 * 60 * 60 * 1000
const PRUNE_MS = 30 * 24 * 60 * 60 * 1000

export type SeenMap = Record<string, number>

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

function read(userId: string): SeenMap {
  if (typeof window === 'undefined' || !userId) return {}
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as SeenMap) : {}
  } catch {
    return {}
  }
}

function write(userId: string, map: SeenMap) {
  if (typeof window === 'undefined' || !userId) return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map))
  } catch {
    // Quota / privacy mode — silently drop; the feature degrades to "everything new".
  }
}

export function readSeen(userId: string): SeenMap {
  return read(userId)
}

export function wasSeenLongAgo(seen: SeenMap, postId: string, now: number): boolean {
  const t = seen[postId]
  return typeof t === 'number' && now - t > TTL_MS
}

// Idempotent: only stamps post ids that aren't already recorded. Also prunes
// entries older than 30 days so the map can't grow unboundedly.
export function markSeen(userId: string, postIds: string[]) {
  if (!userId || postIds.length === 0) return
  const map = read(userId)
  const now = Date.now()
  let changed = false
  for (const id of postIds) {
    if (typeof map[id] !== 'number') {
      map[id] = now
      changed = true
    }
  }
  for (const id of Object.keys(map)) {
    if (now - map[id] > PRUNE_MS) {
      delete map[id]
      changed = true
    }
  }
  if (changed) write(userId, map)
}
