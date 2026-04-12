'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Users, LogOut, Trash2, Send, Image, X, Pencil, Check, Camera } from 'lucide-react'
import Link from 'next/link'
import type { Group, GroupMember, GroupPost, Profile } from '@/types'
import Comments from '@/components/Comments'
import Impressions from '@/components/Impressions'
import Likes from '@/components/Likes'
import MentionText from '@/components/MentionText'
import MentionInput, { extractMentionIds } from '@/components/MentionInput'
import ImageCropper from '@/components/ImageCropper'
import { notifyFriends } from '@/lib/notifyFriends'

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<(GroupMember & { user: Profile })[]>([])
  const [posts, setPosts] = useState<(GroupPost & { author: Profile })[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [postContent, setPostContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editPostContent, setEditPostContent] = useState('')
  const [groupCropFile, setGroupCropFile] = useState<File | null>(null)

  useEffect(() => {
    loadGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadGroup() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Load group
    const { data: groupData } = await supabase
      .from('groups')
      .select('*, creator:profiles!groups_created_by_fkey(*)')
      .eq('id', id)
      .single()

    if (groupData) setGroup(groupData as Group)

    // Load members
    const { data: memberData } = await supabase
      .from('group_members')
      .select('*, user:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', id)
      .order('joined_at', { ascending: true })

    if (memberData) {
      setMembers(memberData as (GroupMember & { user: Profile })[])
      const me = memberData.find(m => m.user_id === user.id)
      setIsMember(!!me)
      setIsAdmin(me?.role === 'admin')
    }

    // Load posts
    const { data: postData } = await supabase
      .from('group_posts')
      .select('*, author:profiles!group_posts_author_id_fkey(*)')
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (postData) setPosts(postData as (GroupPost & { author: Profile })[])

    setLoading(false)
  }

  async function handleJoin() {
    await supabase.from('group_members').insert({
      group_id: id,
      user_id: currentUserId,
      role: 'member',
    })
    // Notify the group creator
    if (group && group.created_by !== currentUserId) {
      await supabase.from('notifications').insert({
        user_id: group.created_by,
        actor_id: currentUserId,
        type: 'group_join',
      })
    }
    loadGroup()
  }

  async function handleLeave() {
    await supabase.from('group_members').delete()
      .eq('group_id', id)
      .eq('user_id', currentUserId)
    loadGroup()
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!postContent.trim() && !mediaFile) return
    setPosting(true)

    let media_url: string | null = null
    if (mediaFile) {
      const maxSize = mediaFile.type.startsWith('video/') ? 20 * 1024 * 1024 : 5 * 1024 * 1024
      if (mediaFile.size > maxSize) { alert(mediaFile.type.startsWith('video/') ? 'Video must be under 20 MB.' : 'Image must be under 5 MB.'); setPosting(false); return }
      const ext = (mediaFile.name.split('.').pop() || '').toLowerCase()
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov']
      if (!allowed.includes(ext)) { setPosting(false); return }
      const path = `${currentUserId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, mediaFile)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path)
        media_url = publicUrl
      }
    }

    const { data, error } = await supabase
      .from('group_posts')
      .insert({
        group_id: id,
        author_id: currentUserId,
        content: postContent.trim(),
        media_url,
      })
      .select('*, author:profiles!group_posts_author_id_fkey(*)')
      .single()

    if (!error && data) {
      setPosts([data as (GroupPost & { author: Profile }), ...posts])
      setPostContent('')
      setMediaFile(null)
      // Notify mentioned users
      const mentionedIds = extractMentionIds(postContent).filter(mid => mid !== currentUserId)
      for (const mentionedId of mentionedIds) {
        await supabase.from('notifications').insert({
          user_id: mentionedId,
          actor_id: currentUserId,
          type: 'mention',
          post_type: 'group_post',
          post_id: data.id,
          content: postContent.trim().slice(0, 100),
        })
      }
      // Notify friends
      notifyFriends(supabase, currentUserId, 'friend_post', {
        post_type: 'group_post',
        post_id: data.id,
        content: postContent.trim().slice(0, 100) || undefined,
      })
      setMediaPreview(null)
    }
    setPosting(false)
  }

  async function handleEditPost(postId: string) {
    if (!editPostContent.trim()) return
    await supabase.from('group_posts').update({ content: editPostContent.trim() }).eq('id', postId)
    setPosts(posts.map(p => p.id === postId ? { ...p, content: editPostContent.trim() } : p))
    setEditingPost(null)
  }

  function handleGroupImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return }
    setGroupCropFile(file)
    e.target.value = ''
  }

  async function handleGroupImageSave(blob: Blob) {
    setGroupCropFile(null)
    if (!group) return
    const previewUrl = URL.createObjectURL(blob)
    setGroup({ ...group, image_url: previewUrl })
    if (group.image_url && group.image_url.includes('/posts/')) {
      const oldPath = group.image_url.split('/posts/')[1]
      if (oldPath) await supabase.storage.from('posts').remove([decodeURIComponent(oldPath)])
    }
    const path = `${currentUserId}/group-${id}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('posts').upload(path, blob)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path)
      await supabase.from('groups').update({ image_url: publicUrl }).eq('id', id)
      setGroup({ ...group, image_url: publicUrl })
    }
  }

  async function handleDeletePost(postId: string) {
    // Nullify notification references before deleting so notifications don't cascade-delete
    await supabase.from('notifications').update({ post_id: null }).eq('post_id', postId).eq('post_type', 'group_post')
    await supabase.from('group_posts').delete().eq('id', postId)
    setPosts(posts.filter(p => p.id !== postId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center">
        <p className="text-text-muted">Group not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-28 ">

      <div className="flex flex-col md:flex-row md:gap-6 md:items-start">

        {/* LEFT — Group info + members */}
        <div className="md:w-[320px] md:flex-shrink-0 md:sticky md:top-4">

          {/* Group image */}
          <div className="relative rounded-2xl overflow-hidden mb-4 bg-bg-card border border-border">
            {group.image_url ? (
              <img src={group.image_url} alt={group.name} className="w-full h-56 object-cover" />
            ) : (
              <div className="w-full h-56 bg-bg-input flex items-center justify-center">
                <Users size={36} className="text-text-muted/30" />
              </div>
            )}
            {isAdmin && (
              <label className="absolute bottom-2 right-2 cursor-pointer press bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors">
                <Camera size={12} />
                {group.image_url ? 'Change' : 'Add Photo'}
                <input type="file" accept="image/*" onChange={handleGroupImageSelect} className="hidden" />
              </label>
            )}
          </div>

          {/* Group header */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="mb-3">
              <h1 className="text-[20px] font-bold tracking-tight">{group.name}</h1>
              <p className="text-[12px] text-text-muted">{members.length} member{members.length !== 1 ? 's' : ''} · {group.group_type}</p>
            </div>

            {group.description && (
              <p className="text-[13px] text-text-muted mb-3">{group.description}</p>
            )}

            {/* Join / Leave button */}
            {isMember ? (
              <button
                onClick={handleLeave}
                className="w-full bg-bg-input border border-border rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Leave Group
              </button>
            ) : (
              <button
                onClick={handleJoin}
                className="w-full bg-accent text-white rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-2"
              >
                <Users size={14} /> Join Group
              </button>
            )}
          </div>

          {/* Members list */}
          <div className="bg-bg-card border border-border rounded-2xl p-4 mb-6">
            <h2 className="text-[14px] font-semibold mb-3">Members ({members.length})</h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {members.map(m => (
                <Link key={m.id} href={`/profile/${m.user_id}`} className="press flex items-center gap-2.5 hover:bg-bg-card-hover rounded-lg p-1 -mx-1">
                  <div className="w-8 h-8 rounded-full bg-bg-input border border-border overflow-hidden flex-shrink-0">
                    {m.user?.avatar_url ? (
                      <img src={m.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-text-muted">
                        {m.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{m.user?.full_name}</p>
                    {m.role === 'admin' && <p className="text-[10px] text-accent font-medium">Admin</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Group wall */}
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-bold mb-3">Group Wall</h2>

          {isMember && (
            <form onSubmit={handlePost} className="bg-bg-card border border-border rounded-2xl p-3 mb-4">
              <MentionInput
                value={postContent}
                onChange={setPostContent}
                maxLength={2000}
                placeholder="Write something to the group... (@ to mention)"
                className="w-full bg-transparent text-[14px] placeholder:text-text-muted/50 outline-none h-16"
                multiline
              />
              {mediaPreview && (
                <div className="relative mb-2 inline-block">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video src={mediaPreview} className="max-h-48 rounded-xl" controls />
                  ) : (
                    <img src={mediaPreview} alt="" className="max-h-48 rounded-xl" />
                  )}
                  <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null) }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 press">
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="press text-text-muted hover:text-text p-1 cursor-pointer">
                  <Image size={18} />
                  <input type="file" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)) } }} className="hidden" />
                </label>
                <button
                  type="submit"
                  disabled={posting || (!postContent.trim() && !mediaFile)}
                  className="bg-accent text-white rounded-xl px-4 py-1.5 text-[13px] font-medium press flex items-center gap-1.5 disabled:opacity-50"
                >
                  {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Post
                </button>
              </div>
            </form>
          )}

          {!isMember && (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center mb-4">
              <p className="text-text-muted text-[14px]">Join the group to post on the wall.</p>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-text-muted text-[14px]">No posts yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className="bg-bg-card border border-border rounded-2xl p-4">
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
                      <Likes postType="group_post" postId={post.id} userId={currentUserId} authorId={post.author_id} />
                      <Impressions postType="group_post" postId={post.id} userId={currentUserId} />
                      {currentUserId === post.author_id && editingPost !== post.id && (
                        <button onClick={() => { setEditingPost(post.id); setEditPostContent(post.content) }} className="press text-text-muted hover:text-text p-1">
                          <Pencil size={13} />
                        </button>
                      )}
                      {(currentUserId === post.author_id || isAdmin) && (
                        <button onClick={() => handleDeletePost(post.id)} className="press text-text-muted hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingPost === post.id ? (
                    <div className="mt-2.5">
                      <textarea
                        value={editPostContent}
                        onChange={(e) => setEditPostContent(e.target.value)}
                        maxLength={2000}
                        className="w-full bg-bg-input rounded-lg px-3 py-2 text-[14px] outline-none resize-none border border-border"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => handleEditPost(post.id)} className="press flex items-center gap-1 text-[12px] font-medium text-accent">
                          <Check size={13} /> Save
                        </button>
                        <button onClick={() => setEditingPost(null)} className="press flex items-center gap-1 text-[12px] text-text-muted">
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.content && <p className="text-[14px] mt-2.5 whitespace-pre-wrap"><MentionText text={post.content} /></p>}
                      {post.media_url && (
                        <div className="mt-2.5">
                          {/\.(mp4|webm|mov|avi)$/i.test(post.media_url) ? (
                            <video src={post.media_url} className="max-w-full rounded-xl" controls />
                          ) : (
                            <img src={post.media_url} alt="" className="max-w-full rounded-xl" />
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <Comments postType="group_post" postId={post.id} postAuthorId={post.author_id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {groupCropFile && (
        <ImageCropper
          file={groupCropFile}
          aspectRatio={2}
          onSave={handleGroupImageSave}
          onCancel={() => setGroupCropFile(null)}
        />
      )}
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
