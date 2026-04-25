'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Trash2, Loader2, Mail, Info, Bell, Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { dark, toggle } = useTheme()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Hard nav so the React tree is torn down before any auth-dependent
    // child re-renders against a now-empty session.
    window.location.href = '/login'
  }

  async function handleDelete() {
    if (!email || confirmText.trim().toLowerCase() !== email.toLowerCase()) return
    setDeleting(true)
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_email: confirmText.trim() }),
    })
    if (res.ok) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } else {
      const data = await res.json().catch(() => null)
      setDeleting(false)
      alert(data?.error || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28 ">
      <button onClick={() => router.back()} className="press flex items-center gap-1.5 text-[13px] text-text-muted mb-4">
        <ArrowLeft size={14} />
        Back
      </button>

      <h1 className="text-[22px] font-bold tracking-tight mb-5">Settings</h1>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mb-6">
        <button onClick={toggle} className="press flex items-center gap-3 px-4 py-3.5 w-full text-left">
          {dark ? <Sun size={16} className="text-text-muted" /> : <Moon size={16} className="text-text-muted" />}
          <div className="flex-1">
            <p className="text-[14px] font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</p>
            <p className="text-[12px] text-text-muted">Switch to {dark ? 'light' : 'dark'} theme</p>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors ${dark ? 'bg-accent' : 'bg-bg-input'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${dark ? 'left-5' : 'left-1'}`} />
          </div>
        </button>
        <Link href="/settings/privacy" className="press flex items-center gap-3 px-4 py-3.5">
          <Lock size={16} className="text-text-muted" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">Privacy</p>
            <p className="text-[12px] text-text-muted">Control which fields others can see</p>
          </div>
        </Link>
        <Link href="/settings/notifications" className="press flex items-center gap-3 px-4 py-3.5">
          <Bell size={16} className="text-text-muted" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">Notifications & Messaging</p>
            <p className="text-[12px] text-text-muted">Choose what you get notified for and who can message you</p>
          </div>
        </Link>
        <Link href="/about" className="press flex items-center gap-3 px-4 py-3.5">
          <Info size={16} className="text-text-muted" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">About Rabona</p>
            <p className="text-[12px] text-text-muted">Learn how Rabona works</p>
          </div>
        </Link>
        <a href="mailto:keugenelee11@gmail.com" className="press flex items-center gap-3 px-4 py-3.5">
          <Mail size={16} className="text-text-muted" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">Support</p>
            <p className="text-[12px] text-text-muted">Email keugenelee11@gmail.com</p>
          </div>
        </a>
        <button onClick={handleSignOut} className="press flex items-center gap-3 px-4 py-3.5 w-full text-left">
          <LogOut size={16} className="text-text-muted" />
          <div className="flex-1">
            <p className="text-[14px] font-medium">Sign out</p>
            <p className="text-[12px] text-text-muted">Log out of your account</p>
          </div>
        </button>
      </div>

      <div className="bg-bg-card border border-red-500/20 rounded-2xl px-4 py-4">
        <p className="text-[14px] font-medium text-red-500 mb-1">Delete Account</p>
        <p className="text-[12px] text-text-muted mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="press flex items-center gap-2 text-[13px] font-medium text-red-500 border border-red-500/20 rounded-xl px-4 py-2"
          >
            <Trash2 size={14} />
            Delete my account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-text-muted">Type your email <span className="font-bold text-text">{email || '…'}</span> to confirm.</p>
            <input
              type="email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="your email"
              className="bg-bg-input rounded-lg px-3 py-2 text-[13px] outline-none w-full border border-border focus:border-red-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmDelete(false); setConfirmText('') }}
                className="press text-[13px] text-text-muted px-4 py-2 rounded-xl border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!email || confirmText.trim().toLowerCase() !== email.toLowerCase() || deleting}
                className="press flex items-center gap-2 text-[13px] font-medium text-white bg-red-500 rounded-xl px-4 py-2 disabled:opacity-40"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
