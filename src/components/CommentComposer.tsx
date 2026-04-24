'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Image as ImageIcon } from 'lucide-react'
import { notifyFriends } from '@/lib/notifyFriends'
import { useMentionAutocomplete, MentionDropdown, notifyMentions } from '@/components/MentionAutocomplete'

interface PostPreview {
  author_name: string
  author_avatar: string | null
  content: string
}

interface CommentComposerProps {
  postType: 'wall_post' | 'group_post'
  postId: string
  postAuthorId?: string
  parentCommentId?: string | null
  parentAuthorName?: string | null
  parentAuthorAvatar?: string | null
  parentContent?: string | null
  onClose: () => void
  onPosted: () => void
}

export default function CommentComposer({
  postType,
  postId,
  postAuthorId,
  parentCommentId,
  parentAuthorName,
  parentAuthorAvatar,
  parentContent,
  onClose,
  onPosted,
}: CommentComposerProps) {
  const supabase = createClient()
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postPreview, setPostPreview] = useState<PostPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const mention = useMentionAutocomplete({
    value: text,
    setValue: setText,
    inputRef: textareaRef,
  })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    if (parentCommentId) {
      setPostPreview({
        author_name: parentAuthorName || 'Unknown',
        author_avatar: parentAuthorAvatar || null,
        content: parentContent || '',
      })
    } else {
      const table = postType === 'wall_post' ? 'wall_posts' : 'group_posts'
      const authorFK = postType === 'wall_post' ? 'wall_posts_author_id_fkey' : 'group_posts_author_id_fkey'
      const { data } = await supabase
        .from(table)
        .select(`content, author:profiles!${authorFK}(full_name, avatar_url)`)
        .eq('id', postId)
        .maybeSingle()

      if (data) {
        const author = Array.isArray(data.author) ? data.author[0] : data.author
        setPostPreview({
          author_name: author?.full_name || 'Unknown',
          author_avatar: author?.avatar_url || null,
          content: data.content,
        })
      }
    }
    setLoading(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
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

  async function handlePost() {
    if ((!text.trim() && !mediaFile) || posting || !userId) return
    setPosting(true)
    const body = text.trim()

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
      parent_id: parentCommentId || null,
      author_id: userId,
      content: body,
      media_url,
    }).select('id').single()

    if (parentCommentId) {
      const { data: parent } = await supabase.from('comments').select('author_id').eq('id', parentCommentId).maybeSingle()
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

    const exclude: string[] = []
    if (parentCommentId) {
      const { data: parent } = await supabase.from('comments').select('author_id').eq('id', parentCommentId).maybeSingle()
      if (parent && parent.author_id !== userId) exclude.push(parent.author_id)
    } else if (postAuthorId && postAuthorId !== userId) {
      exclude.push(postAuthorId)
    }
    const mentionedIds = await notifyMentions(supabase, userId, body, {
      post_type: postType,
      post_id: postId,
      comment_id: newComment?.id,
    })
    mentionedIds.forEach(id => exclude.push(id))

    notifyFriends(supabase, userId, 'friend_comment', {
      post_type: postType,
      post_id: postId,
      comment_id: newComment?.id,
      content: body.slice(0, 100),
    }, exclude)

    onPosted()
  }

  const replyingTo = parentAuthorName || postPreview?.author_name

  return (
    <div
      className="fixed inset-0 z-[60] sm:bg-black/60 sm:backdrop-blur-sm sm:flex sm:items-start sm:justify-center sm:pt-16 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full h-full bg-bg sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <button onClick={onClose} className="press text-text-muted hover:text-text p-1" aria-label="Close">
            <X size={20} />
          </button>
          <button
            onClick={handlePost}
            disabled={(!text.trim() && !mediaFile) || posting}
            className="press bg-text text-bg font-semibold text-[13px] px-4 py-1.5 rounded-full disabled:opacity-40"
          >
            {posting ? 'Posting...' : 'Reply'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-text-muted" size={20} />
            </div>
          ) : postPreview ? (
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                  {postPreview.author_avatar ? (
                    <img src={postPreview.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[13px] font-bold text-text-muted">
                      {postPreview.author_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold">{postPreview.author_name}</p>
                  <p className="text-[14px] whitespace-pre-wrap break-words mt-0.5">{postPreview.content}</p>
                </div>
              </div>
              <p className="text-[12px] text-text-muted mt-3 ml-[52px]">
                Replying to <span className="text-accent font-medium">{replyingTo}</span>
              </p>
            </div>
          ) : null}

          <div className="px-4 pb-4 flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={mention.onKeyDown}
              maxLength={2000}
              placeholder="Write your reply..."
              className="w-full bg-transparent text-[16px] leading-[1.5] outline-none resize-none"
              rows={6}
              autoFocus
            />
            <MentionDropdown
              suggestions={mention.suggestions}
              highlightIndex={mention.highlightIndex}
              onSelect={mention.select}
              onHover={mention.setHighlightIndex}
              className="top-24 left-4 right-4"
            />
            {mediaPreview && (
              <div className="relative inline-block mt-2">
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={mediaPreview} className="max-h-48 rounded-xl" controls />
                ) : (
                  <img src={mediaPreview} alt="" className="max-h-48 rounded-xl" />
                )}
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 press"
                  aria-label="Remove media"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex-shrink-0">
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
            className="press text-text-muted hover:text-text p-1"
            aria-label="Attach media"
          >
            <ImageIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
