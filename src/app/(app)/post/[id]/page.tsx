'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ChevronLeft, Trash2, Pencil } from 'lucide-react'
import type { WallPost } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import Comments from '@/components/Comments'
import Impressions from '@/components/Impressions'
import Likes from '@/components/Likes'

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [post, setPost] = useState<WallPost | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadPost()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPost() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const { data } = await supabase
      .from('wall_posts')
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('id', id)
      .maybeSingle()

    if (data) {
      setPost(data as WallPost)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!post) return
    await fetch('/api/cleanup-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, post_type: 'wall_post' }),
    })
    await supabase.from('wall_posts').delete().eq('id', post.id)
    router.back()
  }

  function isVideo(url: string) {
    return /\.(mp4|webm|mov|avi)$/i.test(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-12 pb-28">
        <button onClick={() => router.back()} className="press flex items-center gap-1 text-[13px] text-text-muted mb-4">
          <ChevronLeft size={16} /> Back
        </button>
        <p className="text-[14px] text-text-muted text-center mt-12">Post not found.</p>
      </div>
    )
  }

  const canDelete = currentUserId === post.author_id || currentUserId === post.wall_owner_id
  const canEdit = currentUserId === post.author_id
  const canComment = !!currentUserId

  return (
    <div className="max-w-xl mx-auto pb-28">
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-2">
        <button onClick={() => router.back()} className="press text-text-muted hover:text-text">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold">Post</h1>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.author_id}`} className="press">
            <div className="w-11 h-11 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[15px] font-bold text-text-muted">
                  {post.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${post.author_id}`} className="text-[15px] font-semibold hover:underline block">
              {post.author?.full_name || 'Unknown'}
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && !showDeleteConfirm && (
              <button onClick={() => router.push(`/post/${post.id}/edit`)} className="press text-text-muted hover:text-text p-1.5">
                <Pencil size={14} />
              </button>
            )}
            {canDelete && !showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className="press text-text-muted hover:text-text p-1.5">
                <Trash2 size={15} />
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-1.5">
                <button onClick={handleDelete} className="press text-text text-[12px] font-medium">Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="press text-text-muted text-[12px] font-medium">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {post.content && (
          <p className="text-[17px] leading-[1.45] mt-3 whitespace-pre-wrap">{post.content}</p>
        )}
        {post.media_url && (
          <div className="mt-3">
            {isVideo(post.media_url) ? (
              <video src={post.media_url} className="w-full rounded-xl" controls />
            ) : (
              <img src={post.media_url} alt="" className="w-full rounded-xl" />
            )}
          </div>
        )}
        <p className="text-[13px] text-text-muted mt-3">
          {new Date(post.created_at).toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>

        <div className="flex items-center gap-4 py-3 mt-3 border-y border-border">
          <Likes postType="wall_post" postId={post.id} userId={currentUserId} authorId={post.author_id} />
          <Impressions postType="wall_post" postId={post.id} userId={currentUserId} />
        </div>

        <div className="mt-3">
          <Comments postType="wall_post" postId={post.id} postAuthorId={post.author_id} canComment={canComment} />
        </div>
      </div>
    </div>
  )
}
