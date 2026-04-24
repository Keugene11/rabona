import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { acceptInviteIfPresent } from '@/lib/invite'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export async function POST(request: Request) {
  try {
    const { code, credential, redirectTo: rawRedirect } = await request.json()
    const redirectTo = rawRedirect && typeof rawRedirect === 'string' && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/feed'

    let idToken: string
    let accessToken: string | undefined

    if (credential) {
      // Google Identity Services credential response (ID token directly)
      idToken = credential
    } else if (code) {
      // Auth-code flow fallback
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
      idToken = tokens.id_token
      accessToken = tokens.access_token
    } else {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
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
      token: idToken,
      access_token: accessToken,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: existing } = await supabase.from('profiles').select('onboarding_complete').eq('id', user.id).maybeSingle()
      const isNewSignup = !existing?.onboarding_complete
      await supabase.from('profiles').update({
        onboarding_complete: true,
      }).eq('id', user.id)
      await acceptInviteIfPresent(supabase, cookieStore, user.id, isNewSignup)
    }

    return NextResponse.json({ ok: true, redirectTo: redirectTo || '/feed' })
  } catch (err) {
    console.error('Google auth error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Authentication failed' },
      { status: 500 }
    )
  }
}
