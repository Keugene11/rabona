'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2, Image, X } from 'lucide-react'
import type { WallPost } from '@/types'
import { notifyFriends } from '@/lib/notifyFriends'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import { useMentionAutocomplete, MentionDropdown, notifyMentions } from '@/components/MentionAutocomplete'

interface WallPostFormProps {
  wallOwnerId: string
  onPost: (post: WallPost) => void
  variant?: 'inline' | 'modal'
}

export default function WallPostForm({ wallOwnerId, onPost, variant = 'inline' }: WallPostFormProps) {
  const supabase = createClient()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mention = useMentionAutocomplete({
    value: content,
    setValue: setContent,
    inputRef: textareaRef,
  })

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [content])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const maxSize = file.type.startsWith('video/') ? 20 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) { alert(file.type.startsWith('video/') ? 'Video must be under 20 MB.' : 'Image must be under 5 MB.'); return }
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  function clearMedia() {
    setMediaFile(null)
    setMediaPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && !mediaFile) return

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let media_url: string | null = null
    if (mediaFile) {
      const ext = (mediaFile.name.split('.').pop() || '').toLowerCase()
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov']
      if (!allowed.includes(ext)) { setLoading(false); return }
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, mediaFile)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path)
        media_url = publicUrl
      }
    }

    const { data, error } = await supabase
      .from('wall_posts')
      .insert({
        author_id: user.id,
        wall_owner_id: wallOwnerId,
        content: content.trim(),
        media_url,
      })
      .select(`*, author:profiles!wall_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .single()

    if (!error && data) {
      onPost(data as WallPost)
      const bodyText = content.trim()
      setContent('')
      clearMedia()

      const mentionedIds = await notifyMentions(supabase, user.id, bodyText, {
        post_type: 'wall_post',
        post_id: data.id,
      })

      notifyFriends(supabase, user.id, 'friend_post', {
        post_type: 'wall_post',
        post_id: data.id,
        content: bodyText.slice(0, 100) || undefined,
      }, mentionedIds)
    }
    setLoading(false)
  }

  const isVideo = mediaFile?.type.startsWith('video/')
  const isModal = variant === 'modal'

  return (
    <form onSubmit={handleSubmit} className={isModal ? '' : 'bg-bg-card border border-border rounded-2xl p-3'}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={mention.onKeyDown}
          maxLength={2000}
          placeholder={isModal ? "What's on your mind?" : 'Write on the wall...'}
          className={`w-full bg-transparent placeholder:text-text-muted/50 outline-none resize-none overflow-hidden ${isModal ? 'text-[16px] leading-[1.5] min-h-[200px]' : 'text-[15px] leading-[1.45] min-h-[4rem]'}`}
        />
        <MentionDropdown
          suggestions={mention.suggestions}
          highlightIndex={mention.highlightIndex}
          onSelect={mention.select}
          onHover={mention.setHighlightIndex}
          className="top-full mt-1"
        />
      </div>
      {mediaPreview && (
        <div className="relative mb-2 inline-block">
          {isVideo ? (
            <video src={mediaPreview} className="max-h-48 rounded-xl" controls />
          ) : (
            <img src={mediaPreview} alt="" className="max-h-48 rounded-xl" />
          )}
          <button type="button" onClick={clearMedia} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 press">
            <X size={12} />
          </button>
        </div>
      )}
      <div className={`flex items-center justify-between ${isModal ? 'mt-5 pt-3 border-t border-border' : 'mt-3'}`}>
        <button type="button" onClick={() => fileRef.current?.click()} className="press text-text-muted hover:text-text p-1">
          <Image size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
        <button
          type="submit"
          disabled={loading || (!content.trim() && !mediaFile)}
          className="bg-accent text-white rounded-xl px-5 py-2 text-[13px] font-semibold press flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Post
        </button>
      </div>
    </form>
  )
}
