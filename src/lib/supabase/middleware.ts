import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth', '/api', '/about', '/privacy', '/terms', '/join']

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

// Wipe all sb-* auth cookies on the response so a corrupted session can't
// keep crashing every subsequent request.
function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-')) {
      response.cookies.set(c.name, '', { maxAge: 0, path: '/' })
    }
  }
}

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

    // If not logged in and not on auth/public pages, redirect to login
    if (!user && !isPublic(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // If logged in and on auth pages, redirect to feed
    if (
      user &&
      (request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup'))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/feed'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Middleware auth error, clearing cookies:', err)
    // Stale or malformed auth cookie — wipe it and send the user to /login
    // (or let public routes through with a clean slate).
    if (!isPublic(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      clearAuthCookies(request, redirectResponse)
      return redirectResponse
    }
    clearAuthCookies(request, supabaseResponse)
  }

  return supabaseResponse
}
