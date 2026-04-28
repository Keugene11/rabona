import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSession } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const INVITER_COOKIE = 'rabona_inviter'
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const origin = new URL(request.url).origin
  const handle = username.toLowerCase().replace(/^@/, '')

  // Service role bypasses RLS so the lookup works for signed-out visitors —
  // public profile fields only, no session, so this exposes nothing extra.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, username')
    .eq('username', handle)
    .maybeSingle()

  if (!profile?.id) {
    return NextResponse.redirect(`${origin}/login?error=Invite link is invalid`)
  }

  const displayName = (profile.full_name || profile.username || '').split(' ')[0] || 'a friend'

  // If the visitor is already signed in, take them straight to the inviter's
  // real profile — the preview page is only useful for signed-out users.
  const session = await createServerSession()
  const { data: { user } } = await session.auth.getUser()

  const target = user
    ? `${origin}/profile/${profile.id}`
    : `${origin}/i/${profile.id}?from=${encodeURIComponent(displayName)}`

  const redirect = NextResponse.redirect(target)

  // Stash inviter id so the auth callback can create the friendship after signup.
  const cookieStore = await cookies()
  cookieStore.set(INVITER_COOKIE, profile.id, {
    maxAge: COOKIE_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  return redirect
}
