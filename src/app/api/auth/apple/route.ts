import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { acceptInviteIfPresent } from '@/lib/invite'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 })
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
      provider: 'apple',
      token: idToken,
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

    return NextResponse.json({ ok: true, redirectTo: '/feed' })
  } catch (err) {
    console.error('Apple auth error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Authentication failed' },
      { status: 500 }
    )
  }
}
