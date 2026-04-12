'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import type { WallPost } from '@/types'
import Comments from '@/components/Comments'
import Impressions from '@/components/Impressions'
import Likes from '@/components/Likes'

interface WallPostItemProps {
  post: WallPost
  currentUserId: string
  wallOwnerId: string
  onDelete: (postId: string) => void
  isFriend?: boolean
}

export default function WallPostItem({ post, currentUserId, wallOwnerId, onDelete, isFriend = false }: WallPostItemProps) {
  const supabase = createClient()
  const canDelete = currentUserId === post.author_id || currentUserId === wallOwnerId
  const canEdit = currentUserId === post.author_id
  const canComment = isFriend || currentUserId === wallOwnerId || currentUserId === post.author_id
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [content, setContent] = useState(post.content)

  async function handleDelete() {
    // Nullify notification references before deleting so notifications don't cascade-delete
    await supabase.from('notifications').update({ post_id: null }).eq('post_id', post.id).eq('post_type', 'wall_post')
    await supabase.from('wall_posts').delete().eq('id', post.id)
    onDelete(post.id)
  }

  async function handleSave() {
    if (!editContent.trim()) return
    await supabase.from('wall_posts').update({ content: editContent.trim() }).eq('id', post.id)
    setContent(editContent.trim())
    setEditing(false)
  }

  function isVideo(url: string) {
    return /\.(mp4|webm|mov|avi)$/i.test(url)
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-4">
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
          {canEdit && !editing && (
            <button onClick={() => { setEditContent(content); setEditing(true) }} className="press text-text-muted hover:text-text p-1">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="press text-text-muted hover:text-red-500 p-1">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-2.5">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={2000}
            className="w-full bg-bg-input rounded-lg px-3 py-2 text-[14px] outline-none resize-none border border-border"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-1.5">
            <button onClick={handleSave} className="press flex items-center gap-1 text-[12px] font-medium text-accent">
              <Check size={13} /> Save
            </button>
            <button onClick={() => setEditing(false)} className="press flex items-center gap-1 text-[12px] text-text-muted">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {content && <p className="text-[14px] mt-2.5 whitespace-pre-wrap">{content}</p>}
          {post.media_url && (
            <div className="mt-2.5">
              {isVideo(post.media_url) ? (
                <video src={post.media_url} className="max-w-full rounded-xl" controls />
              ) : (
                <img src={post.media_url} alt="" className="max-w-full rounded-xl" />
              )}
            </div>
          )}
        </>
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
