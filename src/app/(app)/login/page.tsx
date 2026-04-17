'use client'

import { useState, useEffect } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import Link from 'next/link'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) setError(errorParam)
  }, [])

  const googleLogin = useGoogleLogin({
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

        <ul className="text-[13px] text-text-muted mt-5 text-left space-y-2 list-disc pl-5">
          <li>Write short updates and posts for your friends to read and like</li>
          <li>Join and make groups</li>
        </ul>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-[13px] mt-6 text-left">
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

        <p className="text-[18px] font-semibold text-text mt-5">
          Sign in with any Google account.
        </p>

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

        <p className="text-[12px] text-text-muted mt-4">
          <Link href="/about" className="text-accent press">Learn more</Link>
        </p>
      </div>
    </div>
  )
}
