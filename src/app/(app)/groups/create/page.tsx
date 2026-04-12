'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Image, X } from 'lucide-react'

export default function CreateGroupPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupType, setGroupType] = useState('open')
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let image_url: string | null = null
    if (imageFile) {
      const ext = (imageFile.name.split('.').pop() || '').toLowerCase()
      const path = `${user.id}/group-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, imageFile)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path)
        image_url = publicUrl
      }
    }

    // Get user's university
    const { data: myProfile } = await supabase.from('profiles').select('university').eq('id', user.id).single()

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        description: description.trim(),
        group_type: groupType,
        created_by: user.id,
        image_url,
        university: myProfile?.university || 'cornell',
      })
      .select()
      .single()

    if (!error && group) {
      // Auto-join as admin
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
      })
      router.push(`/groups/${group.id}`)
    }
    setLoading(false)
  }

  const inputClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-text-muted transition-colors'
  const selectClass = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-text-muted transition-colors cursor-pointer'

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-28 ">
      <h1 className="text-[24px] font-bold tracking-tight mb-6">Create a Group</h1>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Group Photo */}
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5 block">Group Photo</label>
          {imagePreview ? (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={imagePreview} alt="" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 press"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-36 bg-bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 press hover:bg-bg-card-hover transition-colors"
            >
              <Image size={24} className="text-text-muted" />
              <span className="text-[13px] text-text-muted">Add a cover photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </div>

        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5 block">Group Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. CSE 214 Study Group"
            required
          />
        </div>

        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-none h-24`}
            placeholder="What's this group about?"
          />
        </div>

        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5 block">Type</label>
          <select value={groupType} onChange={(e) => setGroupType(e.target.value)} className={selectClass}>
            <option value="open">Open — anyone can join</option>
            <option value="closed">Closed — approval needed</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-accent text-white py-3 rounded-2xl font-semibold press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Group'}
        </button>
      </form>
    </div>
  )
}
