'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Users, LogOut, Trash2, Send, Image, X, Pencil, Check, Camera, Settings, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Group, GroupMember, GroupPost, Profile } from '@/types'
import { PROFILE_PUBLIC_COLUMNS } from '@/lib/profile-select'
import Comments from '@/components/Comments'
import Impressions from '@/components/Impressions'
import Likes from '@/components/Likes'
import ImageCropper from '@/components/ImageCropper'
import { notifyFriends } from '@/lib/notifyFriends'

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
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
  const [editingGroup, setEditingGroup] = useState(false)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupDesc, setEditGroupDesc] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null)

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
      .select(`*, creator:profiles!groups_created_by_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .eq('id', id)
      .single()

    if (groupData) setGroup(groupData as Group)

    // Load members
    const { data: memberData } = await supabase
      .from('group_members')
      .select(`*, user:profiles!group_members_user_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
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
      .select(`*, author:profiles!group_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
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
        post_type: 'group',
        post_id: id,
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
      .select(`*, author:profiles!group_posts_author_id_fkey(${PROFILE_PUBLIC_COLUMNS})`)
      .single()

    if (!error && data) {
      setPosts([data as (GroupPost & { author: Profile }), ...posts])
      setPostContent('')
      setMediaFile(null)
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
    // Nullify notification references via server route (uses service role for cross-user updates)
    await fetch('/api/cleanup-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, post_type: 'group_post' }),
    })
    await supabase.from('group_posts').delete().eq('id', postId)
    setPosts(posts.filter(p => p.id !== postId))
  }

  function startEditingGroup() {
    if (!group) return
    setEditGroupName(group.name)
    setEditGroupDesc(group.description || '')
    setEditingGroup(true)
  }

  async function handleSaveGroup() {
    if (!group || !editGroupName.trim()) return
    setSavingGroup(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: editGroupName.trim(), description: editGroupDesc.trim() })
      .eq('id', id)
    if (!error) {
      setGroup({ ...group, name: editGroupName.trim(), description: editGroupDesc.trim() })
      setEditingGroup(false)
    }
    setSavingGroup(false)
  }

  async function handleDeleteGroup() {
    if (!group) return
    setDeletingGroup(true)
    // Delete all group posts, members, then the group itself
    await supabase.from('group_posts').delete().eq('group_id', id)
    await supabase.from('group_members').delete().eq('group_id', id)
    // Delete group image from storage if exists
    if (group.image_url && group.image_url.includes('/posts/')) {
      const oldPath = group.image_url.split('/posts/')[1]
      if (oldPath) await supabase.storage.from('posts').remove([decodeURIComponent(oldPath)])
    }
    await supabase.from('groups').delete().eq('id', id)
    router.push('/groups')
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
      <div className="max-w-xl mx-auto px-4 pt-6 text-center">
        <p className="text-text-muted">Group not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 ">

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
            {editingGroup ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-muted mb-1 block">Group Name</label>
                  <input
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    maxLength={100}
                    className="w-full bg-bg-input border border-border rounded-xl px-3 py-2 text-[14px] outline-none focus:border-text-muted"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-muted mb-1 block">Description</label>
                  <textarea
                    value={editGroupDesc}
                    onChange={(e) => setEditGroupDesc(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full bg-bg-input border border-border rounded-xl px-3 py-2 text-[14px] outline-none resize-none focus:border-text-muted"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveGroup}
                    disabled={savingGroup || !editGroupName.trim()}
                    className="flex-1 bg-accent text-white rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {savingGroup ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                  </button>
                  <button
                    onClick={() => setEditingGroup(false)}
                    className="flex-1 bg-bg-input border border-border rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-1.5"
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h1 className="text-[20px] font-bold tracking-tight">{group.name}</h1>
                    <p className="text-[12px] text-text-muted">{members.length} member{members.length !== 1 ? 's' : ''} · {group.group_type}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={startEditingGroup} className="press text-text-muted hover:text-text p-1.5">
                      <Settings size={18} />
                    </button>
                  )}
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

                {/* Delete group */}
                {isAdmin && (
                  <>
                    {showDeleteConfirm ? (
                      <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <p className="text-[13px] font-medium text-red-500 mb-2">Delete this group? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDeleteGroup}
                            disabled={deletingGroup}
                            className="flex-1 bg-red-500 text-white rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {deletingGroup ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 bg-bg-input border border-border rounded-xl py-2 text-[13px] font-medium press"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full mt-2 text-red-500 border border-red-500/20 rounded-xl py-2 text-[13px] font-medium press flex items-center justify-center gap-2 hover:bg-red-500/5"
                      >
                        <Trash2 size={14} /> Delete Group
                      </button>
                    )}
                  </>
                )}
              </>
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
          <div className="mb-3">
            <h2 className="text-[18px] font-bold">Group Wall</h2>
            <div className="accent-bar" />
          </div>

          {isMember && (
            <form onSubmit={handlePost} className="bg-bg-card border border-border rounded-2xl p-3 mb-4">
              <textarea
                value={postContent}
                onChange={(e) => { setPostContent(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                maxLength={2000}
                placeholder="Write something to the group..."
                className="w-full bg-transparent text-[14px] placeholder:text-text-muted/50 outline-none resize-none min-h-[4rem] max-h-[50vh] overflow-y-auto"
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
                      {(currentUserId === post.author_id || isAdmin) && confirmDeletePostId !== post.id && (
                        <button onClick={() => setConfirmDeletePostId(post.id)} className="press text-text-muted hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                      {confirmDeletePostId === post.id && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { handleDeletePost(post.id); setConfirmDeletePostId(null) }} className="press text-red-500 text-[11px] font-medium">Delete</button>
                          <button onClick={() => setConfirmDeletePostId(null)} className="press text-text-muted text-[11px] font-medium">Cancel</button>
                        </div>
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
                      {post.content && <p className="text-[14px] mt-2.5 whitespace-pre-wrap">{post.content}</p>}
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
          aspectRatio={4/3}
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
