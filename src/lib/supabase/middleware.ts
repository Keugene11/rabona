import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that genuinely need a signed-in user. Everything else is public:
// browsing the feed, viewing posts, viewing other profiles, etc.
const AUTH_REQUIRED_EXACT = new Set([
  '/profile',
])
const AUTH_REQUIRED_PREFIXES = [
  '/profile/edit',
  '/settings',
  '/friends',
  '/messages',
  '/notifications',
  '/pokes',
]

function requiresAuth(pathname: string) {
  if (AUTH_REQUIRED_EXACT.has(pathname)) return true
  if (AUTH_REQUIRED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  if (/^\/post\/[^/]+\/edit/.test(pathname)) return true
  if (/^\/comment\/[^/]+\/edit/.test(pathname)) return true
  return false
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

    // If not logged in and visiting an auth-required page, redirect to login
    // (preserving where they were trying to go so we can return them).
    if (!user && requiresAuth(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search)
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
    // Stale or malformed auth cookie — wipe it and only kick to login if
    // the route actually needs auth. Public pages should keep working.
    if (requiresAuth(request.nextUrl.pathname)) {
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
