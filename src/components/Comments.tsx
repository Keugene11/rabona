'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Send, Heart, MessageCircle, MoreHorizontal, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import type { Comment } from '@/types'
import CommentComposer from '@/components/CommentComposer'
import { notifyFriends } from '@/lib/notifyFriends'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import { useMentionAutocomplete, MentionDropdown, notifyMentions } from '@/components/MentionAutocomplete'
import MentionText from '@/components/MentionText'

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|avi)$/i.test(url)
}

interface CommentsProps {
  postType: 'wall_post' | 'group_post'
  postId: string
  postAuthorId?: string
  canComment?: boolean
}

export default function Comments({ postType, postId, postAuthorId, canComment = true }: CommentsProps) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [input, setInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [userId, setUserId] = useState('')
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerParent, setComposerParent] = useState<Comment | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mention = useMentionAutocomplete({
    value: input,
    setValue: setInput,
    inputRef,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select(`*, author:profiles!comments_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('post_type', postType)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (data) {
      const allComments = data as Comment[]
      const topLevel: Comment[] = []
      const replyMap: Record<string, Comment[]> = {}

      for (const c of allComments) {
        if (c.parent_id) {
          if (!replyMap[c.parent_id]) replyMap[c.parent_id] = []
          replyMap[c.parent_id].push(c)
        } else {
          topLevel.push(c)
        }
      }

      for (const c of topLevel) {
        c.replies = replyMap[c.id] || []
      }

      setComments(topLevel)

      // Load likes for all comments
      const commentIds = allComments.map(c => c.id)
      if (commentIds.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds)
        if (likes) {
          const myLikes = new Set<string>()
          const counts: Record<string, number> = {}
          likes.forEach(l => {
            counts[l.comment_id] = (counts[l.comment_id] || 0) + 1
            if (user && l.user_id === user.id) myLikes.add(l.comment_id)
          })
          setLikedComments(myLikes)
          setLikeCounts(counts)
        }
      }
    }
  }

  function openComposer(parent: Comment | null = null) {
    setComposerParent(parent)
    setComposerOpen(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const maxSize = file.type.startsWith('video/') ? 20 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert(file.type.startsWith('video/') ? 'Video must be under 20 MB.' : 'Image must be under 5 MB.')
      return
    }
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  function clearMedia() {
    setMediaFile(null)
    setMediaPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleInlinePost() {
    const text = input.trim()
    if ((!text && !mediaFile) || !userId || posting) return
    setPosting(true)

    let media_url: string | null = null
    if (mediaFile) {
      const ext = (mediaFile.name.split('.').pop() || '').toLowerCase()
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov']
      if (!allowed.includes(ext)) { setPosting(false); return }
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, mediaFile)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path)
        media_url = publicUrl
      }
    }

    const { data: newComment } = await supabase.from('comments').insert({
      post_type: postType,
      post_id: postId,
      parent_id: null,
      author_id: userId,
      content: text,
      media_url,
    }).select('id').single()

    if (postAuthorId && postAuthorId !== userId) {
      await supabase.from('notifications').insert({
        user_id: postAuthorId,
        actor_id: userId,
        type: 'comment',
        post_type: postType,
        post_id: postId,
        comment_id: newComment?.id,
      })
    }

    const exclude: string[] = []
    if (postAuthorId && postAuthorId !== userId) exclude.push(postAuthorId)
    const mentionedIds = await notifyMentions(supabase, userId, text, {
      post_type: postType,
      post_id: postId,
      comment_id: newComment?.id,
    })
    mentionedIds.forEach(id => exclude.push(id))

    notifyFriends(supabase, userId, 'friend_comment', {
      post_type: postType,
      post_id: postId,
      comment_id: newComment?.id,
      content: text.slice(0, 100),
    }, exclude)

    setInput('')
    clearMedia()
    setPosting(false)
    loadComments()
  }

  async function handleDelete(commentId: string) {
    // Nullify notification references via server route (uses service role for cross-user updates)
    await fetch('/api/cleanup-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId }),
    })
    await supabase.from('comments').delete().eq('id', commentId)
    loadComments()
  }

  async function toggleLikeComment(commentId: string) {
    if (likedComments.has(commentId)) {
      await supabase.from('comment_likes').delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s })
      setLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] || 1) - 1 }))
      await supabase.from('notifications').delete()
        .eq('actor_id', userId)
        .eq('comment_id', commentId)
        .in('type', ['like_comment', 'friend_like_comment'])
    } else {
      await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: userId,
      })
      setLikedComments(prev => new Set([...prev, commentId]))
      setLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + 1 }))

      let commentAuthorId: string | undefined
      for (const c of comments) {
        if (c.id === commentId) { commentAuthorId = c.author_id; break }
        const reply = c.replies?.find(r => r.id === commentId)
        if (reply) { commentAuthorId = reply.author_id; break }
      }

      if (commentAuthorId && commentAuthorId !== userId) {
        await supabase.from('notifications').delete()
          .eq('actor_id', userId)
          .eq('comment_id', commentId)
          .eq('type', 'like_comment')
        await supabase.from('notifications').insert({
          user_id: commentAuthorId,
          actor_id: userId,
          type: 'like_comment',
          post_type: postType,
          post_id: postId,
          comment_id: commentId,
        })
      }

      await supabase.from('notifications').delete()
        .eq('actor_id', userId)
        .eq('comment_id', commentId)
        .eq('type', 'friend_like_comment')
      notifyFriends(supabase, userId, 'friend_like_comment', {
        post_type: postType,
        post_id: postId,
        comment_id: commentId,
      }, commentAuthorId && commentAuthorId !== userId ? [commentAuthorId] : [])
    }
  }

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)

  return (
    <div className="mt-2">
      {(totalCount > 0 || canComment) && (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id}>
              <CommentItem
                comment={c}
                userId={userId}
                onDelete={handleDelete}
                onReply={() => openComposer(c)}
                liked={likedComments.has(c.id)}
                likeCount={likeCounts[c.id] || 0}
                onToggleLike={() => toggleLikeComment(c.id)}
              />

              {c.replies && c.replies.length > 0 && (
                <div className="ml-6 space-y-1.5 mt-1.5">
                  {c.replies.map(r => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      userId={userId}
                      onDelete={handleDelete}
                      onReply={() => openComposer(r)}
                      liked={likedComments.has(r.id)}
                      likeCount={likeCounts[r.id] || 0}
                      onToggleLike={() => toggleLikeComment(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {canComment ? (
            <div>
              {mediaPreview && (
                <div className="relative inline-block mb-1.5">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video src={mediaPreview} className="max-h-32 rounded-lg" controls />
                  ) : (
                    <img src={mediaPreview} alt="" className="max-h-32 rounded-lg" />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 press"
                    aria-label="Remove media"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
              <div className="flex gap-3 items-center relative">
                <div className="flex-1 relative min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (mention.suggestions.length > 0 && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                        mention.onKeyDown(e)
                        return
                      }
                      if (e.key === 'Enter') handleInlinePost()
                    }}
                    maxLength={2000}
                    placeholder="Write a comment..."
                    className="w-full bg-bg-input rounded-lg px-3 py-1.5 text-[13px] outline-none placeholder:text-text-muted/50"
                  />
                  <MentionDropdown
                    suggestions={mention.suggestions}
                    highlightIndex={mention.highlightIndex}
                    onSelect={mention.select}
                    onHover={mention.setHighlightIndex}
                    className="bottom-full mb-1"
                  />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-text-muted hover:text-text press p-1"
                  aria-label="Attach media"
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  onClick={handleInlinePost}
                  disabled={(!input.trim() && !mediaFile) || posting}
                  className="text-accent disabled:opacity-30 press p-1 ml-1"
                  aria-label="Post comment"
                >
                  {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {composerOpen && (
        <CommentComposer
          postType={postType}
          postId={postId}
          postAuthorId={postAuthorId}
          parentCommentId={composerParent?.id}
          parentAuthorName={composerParent?.author?.full_name}
          parentAuthorAvatar={composerParent?.author?.avatar_url}
          parentContent={composerParent?.content}
          onClose={() => setComposerOpen(false)}
          onPosted={() => { setComposerOpen(false); loadComments() }}
        />
      )}
    </div>
  )
}

function CommentItem({ comment, userId, onDelete, onReply, liked, likeCount, onToggleLike }: {
  comment: Comment
  userId: string
  onDelete: (id: string) => void
  onReply?: () => void
  liked: boolean
  likeCount: number
  onToggleLike: () => void
}) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isAuthor = userId === comment.author_id

  return (
    <div className="flex gap-2">
      <Link href={`/profile/${comment.author_id}`} className="press flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-bg-input border border-border overflow-hidden">
          {comment.author?.avatar_url ? (
            <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
              {comment.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-bg-input rounded-xl px-3 py-2 inline-block max-w-full">
          <Link href={`/profile/${comment.author_id}`} className="text-[13px] font-semibold hover:underline">
            {comment.author?.full_name || 'Unknown'}
          </Link>
          {comment.content && (
            <p className="text-[13px] whitespace-pre-wrap break-words">
              <MentionText text={comment.content} />
            </p>
          )}
        </div>
        {comment.media_url && (
          <div className="mt-1.5">
            {isVideoUrl(comment.media_url) ? (
              <video src={comment.media_url} className="max-h-64 rounded-xl" controls />
            ) : (
              <img src={comment.media_url} alt="" className="max-h-64 rounded-xl" />
            )}
          </div>
        )}
        <div className="flex items-center gap-1 mt-1 -ml-2">
          <span className="text-[11px] text-text-muted px-2">{getTimeAgo(new Date(comment.created_at))}</span>
          <button
            onClick={onToggleLike}
            className="press flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-bg-input"
            aria-label="Like"
          >
            <Heart size={14} className={liked ? 'fill-red-500 text-red-500' : 'text-text-muted'} />
            {likeCount > 0 && <span className={`text-[11px] ${liked ? 'text-red-500' : 'text-text-muted'}`}>{likeCount}</span>}
          </button>
          {onReply && (
            <button
              onClick={onReply}
              className="press flex items-center px-2 py-1.5 rounded-full hover:bg-bg-input"
              aria-label="Reply"
            >
              <MessageCircle size={14} className="text-text-muted" />
            </button>
          )}
          {isAuthor && !confirmDelete && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="press flex items-center px-2 py-1.5 rounded-full hover:bg-bg-input"
                aria-label="More"
              >
                <MoreHorizontal size={14} className="text-text-muted" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 z-20 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                    <button
                      onClick={() => { setShowMenu(false); router.push(`/comment/${comment.id}/edit`) }}
                      className="press block w-full text-left px-4 py-2.5 text-[13px] hover:bg-bg-input"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setConfirmDelete(true) }}
                      className="press block w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-bg-input"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 px-2">
              <button onClick={() => onDelete(comment.id)} className="press text-[12px] text-red-500 font-medium">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="press text-[12px] text-text-muted font-medium">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
