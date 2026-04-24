import type { SupabaseClient } from '@supabase/supabase-js'
import type { cookies as NextCookies } from 'next/headers'

export const INVITER_COOKIE = 'rabona_inviter'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CookieStore = Awaited<ReturnType<typeof NextCookies>>

// If the invite cookie is set and valid, create an accepted friendship
// between the inviter and the freshly-authenticated user. Safe to call on
// every login — duplicate-key failures and self-invites are swallowed.
export async function acceptInviteIfPresent(
  supabase: SupabaseClient,
  cookieStore: CookieStore,
  userId: string
) {
  const inviterId = cookieStore.get(INVITER_COOKIE)?.value
  if (!inviterId || !UUID_RE.test(inviterId) || inviterId === userId) {
    cookieStore.delete(INVITER_COOKIE)
    return
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: userId,
      addressee_id: inviterId,
      status: 'accepted',
    })

  // Duplicate (23505) means they're already connected — that's fine.
  if (error && error.code !== '23505') {
    console.error('auto-friend insert failed', error)
  }

  cookieStore.delete(INVITER_COOKIE)
}
