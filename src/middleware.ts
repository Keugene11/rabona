import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const AUTH_REQUIRED_EXACT = new Set(['/profile'])
const AUTH_REQUIRED_PREFIXES = ['/settings', '/friends', '/messages', '/notifications', '/pokes']

function requiresAuth(pathname: string) {
  if (AUTH_REQUIRED_EXACT.has(pathname)) return true
  if (AUTH_REQUIRED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  if (/^\/post\/[^/]+\/edit/.test(pathname)) return true
  if (/^\/comment\/[^/]+\/edit/.test(pathname)) return true
  return false
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const isSignedIn = !!req.auth?.user?.id

  // /login and /signup don't exist as pages anymore — bounce to /feed and
  // (for signed-out users) pre-open the SignInModal via ?signin=1.
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/feed'
    const errorParam = req.nextUrl.searchParams.get('error')
    const fromParam = req.nextUrl.searchParams.get('from')
    url.search = ''
    if (!isSignedIn) url.searchParams.set('signin', '1')
    if (errorParam) url.searchParams.set('error', errorParam)
    if (fromParam) url.searchParams.set('from', fromParam)
    return NextResponse.redirect(url)
  }

  if (!isSignedIn && requiresAuth(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/feed'
    url.search = ''
    url.searchParams.set('signin', '1')
    url.searchParams.set('returnTo', pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
