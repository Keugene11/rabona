'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react'

interface ImageCropperProps {
  file: File
  aspectRatio?: number
  onSave: (blob: Blob) => void
  onCancel: () => void
}

export default function ImageCropper({ file, aspectRatio = 16 / 9, onSave, onCancel }: ImageCropperProps) {
  const [imgSrc] = useState(() => URL.createObjectURL(file))
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const WIDTH = Math.min(400, typeof window !== 'undefined' ? window.innerWidth - 32 : 400)
  const HEIGHT = WIDTH / aspectRatio

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imgSrc
    return () => URL.revokeObjectURL(imgSrc)
  }, [imgSrc])

  const baseScale = imgNatural.w > 0 ? Math.max(WIDTH / imgNatural.w, HEIGHT / imgNatural.h) : 1

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleSave() {
    const img = imgRef.current
    if (!img) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const outW = 800
    const outH = outW / aspectRatio
    canvas.width = outW
    canvas.height = outH
    const s = outW / WIDTH
    const totalScale = baseScale * zoom
    const drawW = imgNatural.w * totalScale * s
    const drawH = imgNatural.h * totalScale * s
    const drawX = (outW - drawW) / 2 + offset.x * s
    const drawY = (outH - drawH) / 2 + offset.y * s
    ctx.drawImage(img, drawX, drawY, drawW, drawH)
    canvas.toBlob((blob) => { if (blob) onSave(blob) }, 'image/jpeg', 0.9)
  }

  const dispW = imgNatural.w * baseScale * zoom
  const dispH = imgNatural.h * baseScale * zoom

  return (
    <div className="fixed inset-0 bg-bg/95 z-50 flex flex-col items-center justify-center px-4">
      <div className="text-center mb-5">
        <h2 className="text-text text-[18px] font-bold">Adjust photo</h2>
        <p className="text-text-muted text-[13px] mt-1">Drag to reposition</p>
      </div>

      <div
        className="relative overflow-hidden border border-border rounded-2xl cursor-grab active:cursor-grabbing bg-bg-input"
        style={{ width: WIDTH, height: HEIGHT, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {imgNatural.w > 0 && (
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            draggable={false}
            className="absolute select-none pointer-events-none"
            style={{
              width: dispW,
              height: dispH,
              left: (WIDTH - dispW) / 2 + offset.x,
              top: (HEIGHT - dispH) / 2 + offset.y,
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <ZoomOut size={16} className="text-text-muted" />
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-48 accent-accent"
        />
        <ZoomIn size={16} className="text-text-muted" />
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="press flex items-center gap-2 bg-bg-card border border-border rounded-2xl px-6 py-2.5 text-[14px] font-medium">
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} className="press flex items-center gap-2 bg-accent text-white rounded-2xl px-6 py-2.5 text-[14px] font-medium">
          <Check size={16} /> Save
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
