import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
const GOOGLE_CLIENT_ID = '372750643272-3ab0ptudlj2s8vofsbumj7n5jiaa060e.apps.googleusercontent.com'

export async function POST(request: Request) {
  try {
    const { code, redirectTo: rawRedirect } = await request.json()
    const redirectTo = rawRedirect && typeof rawRedirect === 'string' && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/directory'

    // Exchange auth code for tokens with Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.id_token) {
      console.error('Google token exchange failed:', tokens)
      return NextResponse.json(
        { error: tokens.error_description || tokens.error || 'Failed to get ID token from Google' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.id_token,
      access_token: tokens.access_token,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    // Mark onboarding as complete
    if (user) {
      await supabase.from('profiles').update({
        onboarding_complete: true,
      }).eq('id', user.id)
    }

    return NextResponse.json({ ok: true, redirectTo: redirectTo || '/directory' })
  } catch (err) {
    console.error('Google auth error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Authentication failed' },
      { status: 500 }
    )
  }
}
