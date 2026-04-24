'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MoreHorizontal } from 'lucide-react'
import type { WallPost } from '@/types'
import Comments from '@/components/Comments'
import Impressions from '@/components/Impressions'
import Likes from '@/components/Likes'
import MentionText from '@/components/MentionText'

const TRUNCATE_LENGTH = 280

interface WallPostItemProps {
  post: WallPost
  currentUserId: string
  wallOwnerId: string
  onDelete: (postId: string) => void
  isFriend?: boolean
  truncate?: boolean
  linkToDetail?: boolean
}

export default function WallPostItem({ post, currentUserId, wallOwnerId, onDelete, truncate = false, linkToDetail = true }: WallPostItemProps) {
  const supabase = createClient()
  const router = useRouter()
  const canDelete = currentUserId === post.author_id || currentUserId === wallOwnerId
  const canEdit = currentUserId === post.author_id
  const canComment = !!currentUserId
  const content = post.content

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const shouldTruncate = truncate && content.length > TRUNCATE_LENGTH
  const displayContent = shouldTruncate ? content.slice(0, TRUNCATE_LENGTH).trimEnd() + '…' : content

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!linkToDetail) return
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, textarea, video, label, [role="button"]')) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (sel && sel.toString().length > 0) return
    router.push(`/post/${post.id}`)
  }

  async function handleDelete() {
    // Nullify notification references via server route (uses service role for cross-user updates)
    await fetch('/api/cleanup-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, post_type: 'wall_post' }),
    })
    await supabase.from('wall_posts').delete().eq('id', post.id)
    onDelete(post.id)
  }

  function isVideo(url: string) {
    return /\.(mp4|webm|mov|avi)$/i.test(url)
  }

  return (
    <div
      onClick={handleCardClick}
      className={`bg-bg-card border border-border rounded-2xl p-4 transition-colors${linkToDetail ? ' cursor-pointer active:bg-bg-card-hover' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Link href={`/profile/${post.author_id}`} className="press">
            <div className="w-8 h-8 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[12px] font-bold text-text-muted">
                  {post.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </Link>
          <div>
            <Link href={`/profile/${post.author_id}`} className="text-[13px] font-semibold hover:underline">
              {post.author?.full_name || 'Unknown'}
            </Link>
            <p className="text-[11px] text-text-muted">{getTimeAgo(new Date(post.created_at))}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Likes postType="wall_post" postId={post.id} userId={currentUserId} authorId={post.author_id} />
          <Impressions postType="wall_post" postId={post.id} userId={currentUserId} />
          {(canEdit || canDelete) && !showDeleteConfirm && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="press text-text-muted hover:text-text p-1"
                aria-label="More"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute top-full right-0 mt-1 z-20 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                    {canEdit && (
                      <button
                        onClick={() => { setShowMenu(false); router.push(`/post/${post.id}/edit`) }}
                        className="press block w-full text-left px-4 py-2.5 text-[13px] hover:bg-bg-input"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}
                        className="press block w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-bg-input"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {showDeleteConfirm && (
            <div className="flex items-center gap-1.5">
              <button onClick={handleDelete} className="press text-red-500 text-[11px] font-medium">Delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="press text-text-muted text-[11px] font-medium">Cancel</button>
            </div>
          )}
        </div>
      </div>
      {content && (
        <p className="text-[14px] mt-2.5 whitespace-pre-wrap">
          <MentionText text={displayContent} />
          {shouldTruncate && <span className="text-accent font-medium ml-1">more</span>}
        </p>
      )}
      {post.media_url && (
        <div className="mt-2.5">
          {isVideo(post.media_url) ? (
            <video src={post.media_url} className="max-w-full rounded-xl" controls />
          ) : (
            <img src={post.media_url} alt="" className="max-w-full rounded-xl" />
          )}
        </div>
      )}
      <Comments postType="wall_post" postId={post.id} postAuthorId={post.author_id} canComment={canComment} />
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
