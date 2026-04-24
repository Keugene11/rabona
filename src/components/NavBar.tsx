'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon as HomeOutline,
  MagnifyingGlassIcon as SearchOutline,
  ChatBubbleOvalLeftIcon as ChatOutline,
  InboxIcon as InboxOutline,
  UserIcon as UserOutline,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  MagnifyingGlassIcon as SearchSolid,
  ChatBubbleOvalLeftIcon as ChatSolid,
  InboxIcon as InboxSolid,
  UserIcon as UserSolid,
} from '@heroicons/react/24/solid'
import { createClient } from '@/lib/supabase/client'
import ComposeModal from '@/components/ComposeModal'

type NavItem = {
  href: string
  outline: typeof HomeOutline
  solid: typeof HomeSolid
  label: string
  hasBadge?: boolean
}

const navItems: NavItem[] = [
  { href: '/feed', outline: HomeOutline, solid: HomeSolid, label: 'Home' },
  { href: '/friends', outline: SearchOutline, solid: SearchSolid, label: 'Friends' },
  { href: '/messages', outline: ChatOutline, solid: ChatSolid, label: 'Messages' },
  { href: '/notifications', outline: InboxOutline, solid: InboxSolid, label: 'Inbox', hasBadge: true },
  { href: '/profile', outline: UserOutline, solid: UserSolid, label: 'Profile' },
]

export default function NavBar() {
  const pathname = usePathname()
  const [badgeCount, setBadgeCount] = useState(0)
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    if (pathname === '/notifications') {
      setBadgeCount(0)
      return
    }
    const supabase = createClient()
    async function loadCount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('seen', false)

      setBadgeCount(notifCount || 0)
    }
    loadCount()
    const interval = setInterval(loadCount, 15000)
    return () => clearInterval(interval)
  }, [pathname])

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-card/95 backdrop-blur-lg border-t border-border z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-around h-14">
          {navItems.map(({ href, outline: Outline, solid: Solid, label, hasBadge }) => {
            const isActive = pathname.startsWith(href)
            const Icon = isActive ? Solid : Outline
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={`flex items-center justify-center px-3 py-2 relative transition-colors ${
                  isActive ? 'text-text' : 'text-text-muted'
                }`}
              >
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {hasBadge && badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-accent text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop left sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-56 flex-col py-6 px-3 gap-3 bg-bg z-40">
        {navItems.map(({ href, outline: Outline, solid: Solid, label, hasBadge }) => {
          const isActive = pathname.startsWith(href)
          const Icon = isActive ? Solid : Outline
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl relative transition-colors cursor-pointer ${
                isActive ? 'text-text' : 'text-text-muted hover:bg-bg-card-hover hover:text-text'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {hasBadge && badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-accent text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[14px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setComposeOpen(true)}
          className="press mt-6 w-full bg-accent text-white font-semibold text-[14px] py-3 rounded-xl hover:bg-accent-dark transition-colors cursor-pointer"
        >
          Post
        </button>
      </aside>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </>
  )
}
