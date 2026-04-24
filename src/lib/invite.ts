import type { SupabaseClient } from '@supabase/supabase-js'
import type { cookies as NextCookies } from 'next/headers'

export const INVITER_COOKIE = 'rabona_inviter'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CookieStore = Awaited<ReturnType<typeof NextCookies>>

// Create an accepted friendship between the inviter and the freshly-signed-up user.
// Only fires on *first* sign-in (onboarding_complete still false), so a pre-planted
// cookie can't hijack an existing account's next login. The cookie is always cleared.
export async function acceptInviteIfPresent(
  supabase: SupabaseClient,
  cookieStore: CookieStore,
  userId: string,
  isNewSignup: boolean
) {
  const inviterId = cookieStore.get(INVITER_COOKIE)?.value
  cookieStore.delete(INVITER_COOKIE)

  if (!isNewSignup) return
  if (!inviterId || !UUID_RE.test(inviterId) || inviterId === userId) return

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
}
