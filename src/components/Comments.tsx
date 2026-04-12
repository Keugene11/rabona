'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Send, Trash2, Pencil, Check, X, Heart } from 'lucide-react'
import type { Comment } from '@/types'
import { notifyFriends } from '@/lib/notifyFriends'

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
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyInput, setReplyInput] = useState('')
  const [userId, setUserId] = useState('')
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})

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
      .select('*, author:profiles!comments_author_id_fkey(*)')
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

  async function handlePost(parentId: string | null = null) {
    const text = parentId ? replyInput.trim() : input.trim()
    if (!text || !userId) return

    const { data: newComment } = await supabase.from('comments').insert({
      post_type: postType,
      post_id: postId,
      parent_id: parentId,
      author_id: userId,
      content: text,
    }).select('id').single()

    if (parentId) {
      const parent = comments.find(c => c.id === parentId) || comments.flatMap(c => c.replies || []).find(c => c.id === parentId)
      if (parent && parent.author_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: parent.author_id,
          actor_id: userId,
          type: 'reply',
          post_type: postType,
          post_id: postId,
          comment_id: newComment?.id,
        })
      }
    } else if (postAuthorId && postAuthorId !== userId) {
      await supabase.from('notifications').insert({
        user_id: postAuthorId,
        actor_id: userId,
        type: 'comment',
        post_type: postType,
        post_id: postId,
        comment_id: newComment?.id,
      })
    }

    // Notify friends (exclude people who already got a direct notification)
    const exclude: string[] = []
    if (parentId) {
      const parent = comments.find(c => c.id === parentId) || comments.flatMap(c => c.replies || []).find(c => c.id === parentId)
      if (parent && parent.author_id !== userId) exclude.push(parent.author_id)
    } else if (postAuthorId && postAuthorId !== userId) {
      exclude.push(postAuthorId)
    }
    notifyFriends(supabase, userId, 'friend_comment', {
      post_type: postType,
      post_id: postId,
      comment_id: newComment?.id,
      content: text.slice(0, 100),
    }, exclude)

    if (parentId) {
      setReplyInput('')
      setReplyTo(null)
    } else {
      setInput('')
    }
    loadComments()
  }

  async function handleDelete(commentId: string) {
    // Nullify notification references before deleting so notifications don't cascade-delete
    await supabase.from('notifications').update({ comment_id: null }).eq('comment_id', commentId)
    await supabase.from('comments').delete().eq('id', commentId)
    loadComments()
  }

  async function handleEdit(commentId: string, newContent: string) {
    await supabase.from('comments').update({ content: newContent }).eq('id', commentId)
    loadComments()
  }

  async function toggleLikeComment(commentId: string) {
    if (likedComments.has(commentId)) {
      await supabase.from('comment_likes').delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s })
      setLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] || 1) - 1 }))
    } else {
      await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: userId,
      })
      setLikedComments(prev => new Set([...prev, commentId]))
      setLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + 1 }))
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
                onEdit={handleEdit}
                onReply={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyInput('') }}
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
                      onEdit={handleEdit}
                      liked={likedComments.has(r.id)}
                      likeCount={likeCounts[r.id] || 0}
                      onToggleLike={() => toggleLikeComment(r.id)}
                    />
                  ))}
                </div>
              )}

              {replyTo === c.id && (
                <div className="ml-6 mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePost(c.id) }}
                    maxLength={2000}
                    placeholder="Write a reply..."
                    className="flex-1 bg-bg-input rounded-lg px-3 py-1.5 text-[12px] outline-none placeholder:text-text-muted/50"
                    autoFocus
                  />
                  <button
                    onClick={() => handlePost(c.id)}
                    disabled={!replyInput.trim()}
                    className="text-accent disabled:opacity-30 press"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {canComment ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePost(null) }}
                maxLength={2000}
                placeholder="Write a comment..."
                className="flex-1 bg-bg-input rounded-lg px-3 py-1.5 text-[12px] outline-none placeholder:text-text-muted/50"
              />
              <button
                onClick={() => handlePost(null)}
                disabled={!input.trim()}
                className="text-accent disabled:opacity-30 press"
              >
                <Send size={14} />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CommentItem({ comment, userId, onDelete, onEdit, onReply, liked, likeCount, onToggleLike }: {
  comment: Comment
  userId: string
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
  onReply?: () => void
  liked: boolean
  likeCount: number
  onToggleLike: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.content)

  function handleSave() {
    if (!editText.trim()) return
    onEdit(comment.id, editText.trim())
    setEditing(false)
  }

  return (
    <div className="flex gap-2">
      <Link href={`/profile/${comment.author_id}`} className="press flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-bg-input border border-border overflow-hidden">
          {comment.author?.avatar_url ? (
            <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-text-muted">
              {comment.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              maxLength={2000}
              className="w-full bg-bg-input rounded-lg px-3 py-1.5 text-[12px] outline-none border border-border"
              autoFocus
            />
            <div className="flex gap-2 mt-1 px-1">
              <button onClick={handleSave} className="press flex items-center gap-0.5 text-[10px] font-medium text-accent">
                <Check size={10} /> Save
              </button>
              <button onClick={() => setEditing(false)} className="press flex items-center gap-0.5 text-[10px] text-text-muted">
                <X size={10} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-bg-input rounded-xl px-3 py-1.5 inline-block">
              <Link href={`/profile/${comment.author_id}`} className="text-[12px] font-semibold hover:underline">
                {comment.author?.full_name || 'Unknown'}
              </Link>
              <p className="text-[12px]">{comment.content}</p>
            </div>
            <div className="flex items-center gap-3 mt-0.5 px-1">
              <span className="text-[10px] text-text-muted">{getTimeAgo(new Date(comment.created_at))}</span>
              <button onClick={onToggleLike} className="flex items-center gap-0.5 press">
                <Heart size={10} className={liked ? 'fill-red-500 text-red-500' : 'text-text-muted hover:text-red-400'} />
                {likeCount > 0 && <span className={`text-[10px] ${liked ? 'text-red-500' : 'text-text-muted'}`}>{likeCount}</span>}
              </button>
              {onReply && (
                <button onClick={onReply} className="text-[10px] text-text-muted hover:text-text font-medium press">Reply</button>
              )}
              {userId === comment.author_id && (
                <button onClick={() => { setEditText(comment.content); setEditing(true) }} className="text-[10px] text-text-muted hover:text-text font-medium press">Edit</button>
              )}
              {userId === comment.author_id && (
                <button onClick={() => onDelete(comment.id)} className="text-[10px] text-text-muted hover:text-red-500 press">Delete</button>
              )}
            </div>
          </>
        )}
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
