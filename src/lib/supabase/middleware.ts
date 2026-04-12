import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isApprovedEmail } from '@/lib/universities'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Enforce Cornell email restriction (allow whitelisted emails)
    const ALLOWED_EMAILS = ['keugenelee11@gmail.com', 'keugenelee9@gmail.com']
    if (user && !isApprovedEmail(user.email || '') && !ALLOWED_EMAILS.includes(user.email || '')) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'You must use a Cornell email address (@cornell.edu)')
      return NextResponse.redirect(url)
    }

    // If not logged in and not on auth pages, redirect to login
    if (
      !user &&
      !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/signup') &&
      !request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/api') &&
      !request.nextUrl.pathname.startsWith('/about') &&
      !request.nextUrl.pathname.startsWith('/privacy') &&
      !request.nextUrl.pathname.startsWith('/terms')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // If logged in and on auth pages, redirect to directory
    if (
      user &&
      (request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup'))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/directory'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Middleware error:', err)
    // On error, let the request through rather than crashing
  }

  return supabaseResponse
}
