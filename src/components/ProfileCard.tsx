'use client'

import Link from 'next/link'
import { Briefcase, Circle } from 'lucide-react'
import type { Profile } from '@/types'

interface ProfileCardProps {
  profile: Profile
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const privateFields = profile.private_fields ? profile.private_fields.split(',').filter(Boolean) : []
  const showMajor = !privateFields.includes('major') && !privateFields.includes('major:followers')
  const showJob = !privateFields.includes('job') && !privateFields.includes('job:followers')
  return (
    <Link href={`/profile/${profile.id}`} className="press block">
      <div className="bg-bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:bg-bg-card-hover transition-colors">
        <div className="w-12 h-12 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[16px] font-bold text-text-muted">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold truncate">{profile.full_name}</p>
          {showMajor && (
            <p className="text-[12px] text-text-muted truncate">
              {profile.major}{profile.class_year ? ` '${profile.class_year.toString().slice(-2)}` : ''}
            </p>
          )}
          {showJob && profile.job && (
            <p className="text-[11px] text-text-muted flex items-center gap-1 truncate">
              <Briefcase size={10} /> {profile.job}
            </p>
          )}
          {profile.last_seen && (
            <p className={`text-[11px] flex items-center gap-1 ${isOnline(profile.last_seen) ? 'text-green-500' : 'text-text-muted'}`}>
              <Circle size={6} className={isOnline(profile.last_seen) ? 'fill-green-500 text-green-500' : 'fill-text-muted/40 text-text-muted/40'} />
              {getLastSeen(profile.last_seen)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen).getTime()) < 60000
}

function getLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return ''
  const seconds = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000)
  if (seconds < 60) return 'Online now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Active ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Active ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Active yesterday'
  if (days < 7) return `Active ${days}d ago`
  return `Active ${new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
