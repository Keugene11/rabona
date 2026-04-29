'use client'

import { useState, useEffect } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { Capacitor } from '@capacitor/core'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invitedBy, setInvitedBy] = useState('')
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) setError(errorParam)
    const fromParam = params.get('from')
    if (fromParam) setInvitedBy(fromParam)
  }, [])

  useEffect(() => {
    if (!isNative) return
    ;(async () => {
      try {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
        await GoogleAuth.initialize({
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        })
      } catch (err) {
        console.error('GoogleAuth init failed', err)
      }
    })()
  }, [isNative])

  const webGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: 'openid email profile',
    onSuccess: async (codeResponse) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Could not authenticate')
          setLoading(false)
          return
        }
        window.location.href = data.redirectTo || '/feed'
      } catch {
        setError('Could not authenticate')
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in failed')
      setLoading(false)
    },
  })

  async function handleNativeGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
      const result = await GoogleAuth.signIn()
      const idToken = result?.authentication?.idToken
      if (!idToken) {
        setError('Google sign-in failed')
        setLoading(false)
        return
      }
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: idToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not authenticate')
        setLoading(false)
        return
      }
      window.location.href = data.redirectTo || '/feed'
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      if (/cancel/i.test(msg)) {
        setLoading(false)
        return
      }
      console.error('Native Google sign-in error:', err)
      setError(`Google sign-in failed: ${msg || 'unknown error'}`)
      setLoading(false)
    }
  }

  function googleLogin() {
    if (isNative) {
      handleNativeGoogleLogin()
    } else {
      webGoogleLogin()
    }
  }

  async function handleAppleLogin() {
    setLoading(true)
    setError('')
    try {
      const { AppleSignIn, SignInScope } = await import('@capawesome/capacitor-apple-sign-in')
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
      })
      const res = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: result.idToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not authenticate')
        setLoading(false)
        return
      }
      window.location.href = data.redirectTo || '/feed'
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : ''
      if (code === 'SIGN_IN_CANCELED') {
        setLoading(false)
        return
      }
      setError('Apple sign-in is not available on this device')
      setLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not sign in')
        setLoading(false)
        return
      }
      window.location.href = data.redirectTo || '/feed'
    } catch {
      setError('Could not sign in')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm animate-slide-up text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight">
          <span className="text-accent">[</span> Rabona <span className="text-accent">]</span>
        </h1>

        {invitedBy ? (
          <p className="text-[14px] text-text mt-4">
            <span className="font-semibold">{invitedBy}</span> invited you to Rabona. Sign up below and you&apos;ll be friends.
          </p>
        ) : (
          <ul className="text-[13px] text-text-muted mt-5 text-left space-y-2 list-disc pl-5">
            <li>Write short updates and posts for your friends to read and like</li>
            <li>Meet people, make friends, DM them</li>
            <li>Posts are visible to your friends only</li>
          </ul>
        )}

        {error && (
          <div className="bg-bg-input border border-border text-text rounded-xl px-4 py-2.5 text-[13px] mt-6 text-left">
            {error}
          </div>
        )}

        <button
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full bg-bg-card border border-border py-3 rounded-2xl font-semibold press flex items-center justify-center gap-3 text-[14px] hover:bg-bg-card-hover transition-colors disabled:opacity-50 mt-6"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <button
          onClick={handleAppleLogin}
          disabled={loading}
          className="w-full bg-bg-card border border-border py-3 rounded-2xl font-semibold press flex items-center justify-center gap-3 text-[14px] hover:bg-bg-card-hover transition-colors disabled:opacity-50 mt-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Apple'}
        </button>

        {/* Email/password login toggle */}
        <button
          onClick={() => setShowEmailLogin(!showEmailLogin)}
          className="text-[12px] text-text-muted mt-4 press hover:underline"
        >
          {showEmailLogin ? 'Hide' : 'Sign in with email & password'}
        </button>

        {showEmailLogin && (
          <form onSubmit={handleEmailLogin} className="mt-3 space-y-2 text-left">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-text-muted"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-text-muted"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white py-3 rounded-2xl font-semibold press text-[14px] disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
