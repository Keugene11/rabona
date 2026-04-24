import { createClient } from '@supabase/supabase-js'
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

  // Anon key is enough — we only need to read a public profile row.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username')
    .eq('username', handle)
    .maybeSingle()

  if (!profile?.id) {
    return NextResponse.redirect(`${origin}/login?error=Invite link is invalid`)
  }

  const displayName = (profile.full_name || profile.username || '').split(' ')[0] || 'a friend'
  const redirect = NextResponse.redirect(`${origin}/login?from=${encodeURIComponent(displayName)}`)

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
