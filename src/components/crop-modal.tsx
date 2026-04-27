"use client"

import { useEffect, useRef, useState } from "react"
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

type CropModalProps = {
  sourceVersion: { id: string; imageUrl: string }
  onClose: () => void
  onCommitted: (newVersion: { id: string; versionNumber: number; imageUrl: string }) => void
}

type Stage = "select" | "preview"
type Tab = "auto" | "manual"

const ASPECT_OPTIONS: Array<{ label: string; value: number | undefined }> = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
  { label: "자유", value: undefined },
]

function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
  )
}

export function CropModal({ sourceVersion, onClose, onCommitted }: CropModalProps) {
  const [tab, setTab] = useState<Tab>("manual")
  const [aspect, setAspect] = useState<number | undefined>(1)
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(undefined)
  const [stage, setStage] = useState<Stage>("select")
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined)
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined)
  const imgRef = useRef<HTMLImageElement>(null)

  const previewAuto = trpc.export.previewAutoCrop.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.previewUrl)
      setStage("preview")
    },
    onError: (err) => toast.error(err.message),
  })

  const previewManual = trpc.export.previewManualCrop.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.previewUrl)
      setStage("preview")
    },
    onError: (err) => toast.error(err.message),
  })

  const commit = trpc.export.commitCrop.useMutation({
    onSuccess: (data) => {
      onCommitted(data.newVersion)
    },
    onError: (err) => toast.error(err.message),
  })

  const isPending = previewAuto.isPending || previewManual.isPending || commit.isPending

  // Reset state when switching tabs
  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setStage("select")
    setPreviewUrl(undefined)
    setPendingRect(undefined)
  }

  function seedCrop(img: HTMLImageElement, aspectRatio: number | undefined) {
    const { naturalWidth, naturalHeight } = img
    const effectiveAspect = aspectRatio ?? naturalWidth / naturalHeight
    const seeded = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, effectiveAspect, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight,
    )
    setCrop(seeded)
    setCompletedCrop(undefined)
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    seedCrop(e.currentTarget, aspect)
  }

  function handleAspectChange(value: number | undefined) {
    setAspect(value)
    if (imgRef.current) {
      seedCrop(imgRef.current, value)
    }
  }

  function computeNaturalRect(completed: PixelCrop) {
    const img = imgRef.current
    if (!img) return null
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    return {
      x: Math.round(completed.x * scaleX),
      y: Math.round(completed.y * scaleY),
      width: Math.round(completed.width * scaleX),
      height: Math.round(completed.height * scaleY),
    }
  }

  function getSizeLabel() {
    if (!completedCrop || !imgRef.current) return null
    const rect = computeNaturalRect(completedCrop)
    if (!rect) return null
    return `${rect.width} × ${rect.height}px`
  }

  function handlePreview() {
    if (tab === "auto") {
      previewAuto.mutate({ logoVersionId: sourceVersion.id })
      return
    }
    if (!completedCrop) {
      toast.error("먼저 영역을 선택해 주세요")
      return
    }
    const rect = computeNaturalRect(completedCrop)
    if (!rect) return
    setPendingRect(rect)
    previewManual.mutate({ logoVersionId: sourceVersion.id, rect })
  }

  function handleCommit() {
    if (tab === "auto") {
      commit.mutate({ sourceVersionId: sourceVersion.id, source: "crop_auto" })
    } else {
      const rect = pendingRect
      if (!rect) {
        toast.error("미리보기를 먼저 실행해 주세요")
        return
      }
      commit.mutate({ sourceVersionId: sourceVersion.id, source: "crop_manual", rect })
    }
  }

  function handleBack() {
    setStage("select")
    setPreviewUrl(undefined)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        if (stage === "preview") {
          handleBack()
        } else {
          onClose()
        }
        return
      }
      if (e.key === "Enter") {
        if (stage === "select") {
          handlePreview()
        } else if (stage === "preview") {
          handleCommit()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, tab, completedCrop, pendingRect])

  const sizeLabel = getSizeLabel()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="크롭"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col w-full max-w-2xl mx-4 rounded-xl border border-[#333] bg-[#111] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h2 className="text-sm font-semibold text-white">크롭</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#888] hover:text-white transition-colors"
            aria-label="닫기"
            disabled={isPending}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#222] mt-3 px-5 gap-4">
          {(["manual", "auto"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              disabled={isPending}
              className={[
                "pb-2 text-xs font-medium transition-colors",
                tab === t
                  ? "text-white border-b-2 border-[#4CAF50] -mb-px"
                  : "text-[#888] hover:text-white",
              ].join(" ")}
            >
              {t === "manual" ? "영역 크롭" : "자동 크롭"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-3 px-5 py-4 min-h-[260px] justify-center">
          {stage === "select" && (
            <>
              {tab === "manual" && (
                <>
                  {/* Crop image area */}
                  <div style={{ touchAction: "none" }}>
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={aspect}
                      keepSelection
                      ruleOfThirds
                      minWidth={20}
                      minHeight={20}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={imgRef}
                        src={sourceVersion.imageUrl}
                        alt="크롭할 이미지"
                        className="max-w-[85vw] max-h-[55vh] object-contain"
                        onLoad={handleImageLoad}
                        draggable={false}
                      />
                    </ReactCrop>
                  </div>

                  {/* Aspect pills */}
                  <div className="flex gap-2 flex-wrap justify-center">
                    {ASPECT_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleAspectChange(opt.value)}
                        disabled={isPending}
                        className={[
                          "px-3 py-1 text-xs rounded-full border transition-colors",
                          aspect === opt.value
                            ? "border-[#4CAF50] text-[#4CAF50] bg-[rgba(76,175,80,0.08)]"
                            : "border-[#333] text-[#888] hover:border-[#555] hover:text-white",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Size label */}
                  {sizeLabel && (
                    <p className="text-xs text-[#666]">{sizeLabel}</p>
                  )}
                </>
              )}

              {tab === "auto" && (
                <>
                  <p className="text-xs text-[#888] text-center">여백을 자동으로 제거하고 정사각으로 맞춥니다</p>
                  {/* Source preview (non-interactive) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceVersion.imageUrl}
                    alt="원본 이미지"
                    className="max-w-[85vw] max-h-[55vh] object-contain rounded border border-[#222]"
                    draggable={false}
                  />
                </>
              )}
            </>
          )}

          {stage === "preview" && previewUrl && (
            <>
              <p className="text-xs text-[#888]">미리보기</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="크롭 미리보기"
                className="max-w-[85vw] max-h-[55vh] object-contain rounded border border-[#333]"
                draggable={false}
              />
            </>
          )}
        </div>

        {/* Footer action bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#1e1e1e]">
          {stage === "select" ? (
            <>
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-1.5 text-xs rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handlePreview}
                disabled={isPending || (tab === "manual" && !completedCrop)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-[#4CAF50] text-white hover:bg-[#43A047] transition-colors disabled:opacity-50"
              >
                {(previewAuto.isPending || previewManual.isPending) && <Spinner />}
                미리보기
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                disabled={isPending}
                className="px-4 py-1.5 text-xs rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors disabled:opacity-50"
              >
                다시 자르기
              </button>
              <button
                onClick={handleCommit}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-[#4CAF50] text-white hover:bg-[#43A047] transition-colors disabled:opacity-50"
              >
                {commit.isPending && <Spinner />}
                적용
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}