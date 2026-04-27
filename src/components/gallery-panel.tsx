"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { CropModal } from "@/components/crop-modal"
import { trpc } from "@/lib/trpc/client"
import { PulseSpinner } from "@/components/spinners"
import { toast } from "sonner"
import { useComposerStore } from "@/lib/chat/composer-store"
import { useGallerySpotlightStore } from "@/lib/chat/gallery-spotlight-store"

import { MAX_FILE_SIZE, ACCEPTED_TYPES, MAX_FILES_PER_BATCH } from "@/lib/attachment-constants"
import { parseMetadata } from "@/lib/logo-version-metadata"
type LogoVersion = {
  id: string
  versionNumber: number
  parentVersionId: string | null
  imageUrl: string
  svgUrl?: string | null
  editPrompt: string | null
  s3Key: string
  createdAt: Date | string
  metadata?: unknown
}

type Logo = {
  id: string
  orderIndex: number
  prompt: string
  aspectRatio: string
  versions: LogoVersion[]
}

type ToolActivity =
  | { type: "idle" }
  | { type: "generating"; count: number }
  | { type: "editing"; logoIndex: number; versionNumber?: number }
  | { type: "generated"; count: number; generated: number }
  | { type: "edited"; logoIndex: number; versionNumber: number }

type GalleryProps = {
  logos: Logo[]
  isLoading: boolean
  projectId: string
  onRefresh: () => void
  toolActivity?: ToolActivity
}
export function GalleryPanel({ logos, isLoading, onRefresh, projectId, toolActivity }: GalleryProps) {
  const [activeIdx, setActiveIdx] = useState<Record<string, number>>({})
  const [modalIdx, setModalIdx] = useState<number | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const composerProjectId = useComposerStore((state) => state.activeProjectId)

  const svgMut = trpc.export.vectorize.useMutation()
  const utils = trpc.useUtils()
  const [pendingUploads, setPendingUploads] = useState<Array<{ localId: string; status: "uploading" | "error" }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const uploadMutation = trpc.logo.uploadBaseImage.useMutation()

  const handleFiles = useCallback(async (files: File[]) => {
    if (!projectId) return
    const valid: File[] = []
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
        toast.error(`${file.name}: PNG, JPEG, WebP 형식만 지원해요.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: 이미지당 최대 4MB까지 업로드할 수 있어요.`)
        continue
      }
      valid.push(file)
    }
    let batch = valid
    if (batch.length > MAX_FILES_PER_BATCH) {
      toast.warning("한 번에 최대 10개까지 업로드할 수 있어요. 처음 10개만 업로드해요.")
      batch = batch.slice(0, MAX_FILES_PER_BATCH)
    }
    if (!batch.length) return
    let succeeded = 0
    for (const file of batch) {
      const localId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setPendingUploads((prev) => [...prev, { localId, status: "uploading" }])
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error ?? new Error("read failed"))
          reader.readAsDataURL(file)
        })
        await uploadMutation.mutateAsync({ projectId, mimeType: file.type, dataUrl })
        setPendingUploads((prev) => prev.filter((p) => p.localId !== localId))
        succeeded++
        await utils.logo.listByProject.invalidate({ projectId })
        await utils.project.invalidate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "업로드에 실패했어요."
        toast.error(`${file.name}: ${message}`)
        setPendingUploads((prev) => prev.map((p) => p.localId === localId ? { ...p, status: "error" } : p))
        setTimeout(() => {
          setPendingUploads((prev) => prev.filter((p) => p.localId !== localId))
        }, 3000)
      }
    }
    if (batch.length > 1) {
      if (succeeded === batch.length) {
        toast.success(`${succeeded}/${batch.length}개 업로드 완료`)
      } else {
        toast.error(`${batch.length}개 중 ${succeeded}개 업로드됐어요.`)
      }
    }
  }, [projectId, uploadMutation, utils])
  const getVer = useCallback((logo: Logo) => logo.versions[activeIdx[logo.id] ?? 0] ?? logo.versions[0], [activeIdx])

  const cycle = useCallback((logoId: string, dir: 1 | -1, total: number) => {
    setActiveIdx((p) => ({ ...p, [logoId]: ((p[logoId] ?? 0) + dir + total) % total }))
  }, [])

  const toggleFav = (id: string) => setFavorites((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => {
    if (modalIdx === null) return
    const h = (e: KeyboardEvent) => {
      if (cropModalOpen) {
        if (e.key === "Escape") setCropModalOpen(false)
        return
      }
      if (e.key === "Escape") setModalIdx(null)
      if (e.key === "ArrowLeft") setModalIdx((p) => p !== null ? (p - 1 + logos.length) % logos.length : null)
      if (e.key === "ArrowRight") setModalIdx((p) => p !== null ? (p + 1) % logos.length : null)
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
        const l = logos[modalIdx]; if (l?.versions.length > 1) cycle(l.id, e.key === "ArrowUp" ? -1 : 1, l.versions.length)
      }
      if (e.key === "f" || e.key === "F") { const l = logos[modalIdx]; if (l) toggleFav(getVer(l).id) }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [modalIdx, logos, cycle, getVer, cropModalOpen])

  useEffect(() => {
    const highlighted = new Map<HTMLElement, number>()
    const unsubscribe = useGallerySpotlightStore.subscribe((state, prevState) => {
      const versionId = state.spotlightVersionId
      if (!versionId || versionId === prevState.spotlightVersionId) return

      const targetEl = document.getElementById(`logo-version-${versionId}`)
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
        targetEl.classList.add("ring-2", "ring-[#ffb74d]")
        const timeoutId = window.setTimeout(() => {
          targetEl.classList.remove("ring-2", "ring-[#ffb74d]")
          highlighted.delete(targetEl)
        }, 1200)
        highlighted.set(targetEl, timeoutId)
      }

      useGallerySpotlightStore.getState().clear()
    })

    return () => {
      unsubscribe()
      highlighted.forEach((timeoutId, element) => {
        window.clearTimeout(timeoutId)
        element.classList.remove("ring-2", "ring-[#ffb74d]")
      })
      highlighted.clear()
    }
  }, [])

  if (isLoading) return <div className="h-full flex-1 overflow-y-auto p-4">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="rounded-2xl border border-[#2a2a2a] bg-[#1b1b1b] overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-[#2a2a2a]" />
          <div className="px-3 py-3 space-y-2">
            <div className="h-3 w-20 rounded bg-[#2a2a2a]" />
            <div className="h-2.5 w-32 rounded bg-[#232323]" />
          </div>
        </div>
      ))}
    </div>
  </div>

  const mLogo = modalIdx !== null ? logos[modalIdx] : null
  const mVer = mLogo ? getVer(mLogo) : null
  const mVerMeta = parseMetadata(mVer?.metadata)
  const modalShowEditProgress =
    Boolean(mLogo && toolActivity?.type === "editing" && mLogo.orderIndex + 1 === toolActivity.logoIndex)
  const revCount = logos.reduce((sum, logo) => sum + Math.max(0, logo.versions.length - 1), 0)
  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, "_blank")
    }
  }

  const handleSvgClick = async (version: LogoVersion) => {
    try {
      const filename = `splash-logo-${mLogo?.orderIndex ?? 0}-v${version.versionNumber}.svg`
      if (version.svgUrl) {
        await handleDownload(version.svgUrl, filename)
        return
      }

      const result = await svgMut.mutateAsync({ logoVersionId: version.id })
      await handleDownload(result.url, filename)
      await Promise.all([utils.project.invalidate(), utils.logo.invalidate()])
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "SVG 변환에 실패했습니다. 잠시 후 다시 시도해 주세요."
      toast.error(message)
    }
  }

  const handleCropCommitted = useCallback(async (_newVersion: { id: string; versionNumber: number; imageUrl: string }) => {
    setCropModalOpen(false)
    await utils.logo.listByProject.invalidate({ projectId })
    if (modalIdx !== null) {
      const currentLogo = logos[modalIdx]
      if (currentLogo) {
        setActiveIdx((prev) => ({
          ...prev,
          [currentLogo.id]: currentLogo.versions.length,
        }))
      }
    }
  }, [utils, projectId, modalIdx, logos])

  return (
    <div
      className="h-full flex flex-col bg-[#0e0e0e] relative"
      onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; if (dragCounterRef.current === 1) setIsDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); dragCounterRef.current = Math.max(0, dragCounterRef.current - 1); if (dragCounterRef.current === 0) setIsDragging(false) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy" }}
      onDrop={(e) => { e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")); if (files.length) void handleFiles(files) }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-xs text-[#666]">{logos.length}개 로고{revCount > 0 ? ` · ${revCount}개 수정본` : ""}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[#888] hover:text-white transition-colors"
            data-testid="gallery-upload-button"
            title="이미지 업로드"
          >+ 업로드</button>
          <button onClick={onRefresh} className="text-[#555] hover:text-white transition-colors" title="새로고침">↻</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {(!logos.length && !pendingUploads.length) ? (
          <div className="h-full flex items-center justify-center px-6">
            <div className="relative w-full max-w-md rounded-2xl p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#2a2a2a] via-[#4CAF50]/50 to-[#2a2a2a] opacity-60 blur-sm animate-pulse" />
              <div className="relative rounded-2xl border border-[#2a2a2a] bg-[#111] px-6 py-10 text-center text-[#555]">
                <p className="mb-2 text-lg text-[#ddd]">아직 생성된 로고가 없습니다</p>
                <p className="text-sm">AI와 대화하거나 가지고 계신 이미지를 업로드하세요</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-4 py-2 rounded-lg border border-[#333] bg-[#1a1a1a] hover:bg-[#222] text-white text-sm"
                  data-testid="gallery-upload-empty-button"
                >
                  이미지 업로드
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
          {(toolActivity?.type === "generated" && toolActivity.generated > 0) && (
            <div className="col-span-full mb-3 px-3 py-2 bg-[#1a2e1a] border border-[#4CAF50]/30 rounded-lg">
              <div className="text-xs text-[#81c784]">✓ {toolActivity.generated}개 새 로고가 추가되었습니다</div>
            </div>
          )}
          {toolActivity?.type === "generating" && (
            <div className="col-span-full mb-4">
              <div className="text-xs text-[#ffb74d] mb-2 flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-[#ffb74d] border-t-transparent rounded-full animate-spin" />
                로고 {toolActivity.count}개 생성 중...
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {Array.from({ length: toolActivity.count }, (_, i) => (
                  <div key={`gen-${i}`} className="aspect-square rounded-lg bg-[#1a1a1a] animate-pulse border border-[#333]" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>
            </div>
          )}
          {logos.filter((logo) => logo.versions.length > 0).map((logo, idx) => {
            const ver = getVer(logo)
            const ai = activeIdx[logo.id] ?? 0
            const isRev = ai > 0
            const hasRevs = logo.versions.length > 1
            const isBeingEdited = toolActivity?.type === "editing" && logo.orderIndex + 1 === toolActivity.logoIndex
            const justEdited = toolActivity?.type === "edited" && logo.orderIndex + 1 === toolActivity.logoIndex
            const verMeta = parseMetadata(ver.metadata)
            return (
              <div
                key={logo.id}
                className={`group relative rounded-2xl overflow-hidden border transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_12px_34px_rgba(0,0,0,0.45)] ${hasRevs ? "border-[#333]" : "border-[#2a2a2a]"} ${isBeingEdited ? "ring-2 ring-[#ffb74d] ring-offset-2 ring-offset-[#0e0e0e] gallery-card-editing z-[1]" : ""} ${justEdited ? "ring-2 ring-[#4CAF50] ring-offset-2 ring-offset-[#0e0e0e]" : ""}`}
              >
                {/* Fixed aspect ratio container — this NEVER changes height */}
                <div
                  id={`logo-version-${ver.id}`}
                  className="relative bg-white cursor-pointer aspect-square overflow-hidden"
                  onClick={() => setModalIdx(idx)}
                >
                  <img src={ver.imageUrl} alt="" className="w-full h-full object-contain" />

                  {/* Top-left: Logo number badge */}
                  <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${isRev ? "bg-[rgba(46,125,50,0.85)] text-white" : "bg-[rgba(0,0,0,0.6)] text-[#ccc]"}`}>
                    #{logo.orderIndex + 1}{isRev ? ` · v${ver.versionNumber}` : ""}
                  </span>
                  {(verMeta?.source === "crop_manual" || verMeta?.source === "crop_auto") && (
                    <span
                      className="absolute top-2 left-2 mt-5 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-[rgba(46,125,50,0.85)] text-white"
                      title={verMeta?.source === "crop_manual" ? "수동 크롭" : "자동 크롭"}
                    >
                      ✂️
                    </span>
                  )}

                  {/* Editing overlay — shimmer + indeterminate bar + activity spinner */}
                  {isBeingEdited && (
                    <>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/65" aria-hidden />
                      <div className="pointer-events-none absolute inset-0 overflow-hidden" role="status" aria-live="polite" aria-label="로고 편집 적용 중">
                        <div
                          className="absolute inset-y-[-20%] w-[55%] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-80"
                          style={{ animation: "gallery-edit-shimmer 2.1s ease-in-out infinite" }}
                        />
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
                        <PulseSpinner size={26} color="#ffb74d" />
                        <div>
                          <p className="text-[13px] font-semibold tracking-tight text-[#ffb74d]">편집 적용 중</p>
                          <p className="mt-1 text-[10px] leading-snug text-white/75">AI가 이미지를 다시 그리는 중이에요. 잠시만 기다려 주세요.</p>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-black/50">
                        <div
                          className="absolute top-0 h-full w-[38%] rounded-full bg-gradient-to-r from-[#ffb74d]/20 via-[#ffb74d] to-[#ffb74d]/20"
                          style={{ animation: "gallery-edit-bar 1.35s ease-in-out infinite" }}
                        />
                      </div>
                    </>
                  )}

                  {/* Bottom overlay — only visible on hover, shows edit prompt + version dots */}
                  {(hasRevs || ver.editPrompt) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      {ver.editPrompt && (
                        <p className="text-[11px] text-white/80 truncate mb-1">{ver.editPrompt}</p>
                      )}
                      {hasRevs && (
                        <div className="flex items-center gap-1">
                          {logo.versions.map((_, vi) => (
                            <div key={vi} className={`w-1.5 h-1.5 rounded-full ${vi === ai ? "bg-[#4CAF50]" : "bg-white/40"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    data-testid={`mention-button-${ver.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const added = useComposerStore.getState().addMention(projectId, {
                        logoId: logo.id,
                        versionId: ver.id,
                        orderIndex: logo.orderIndex,
                        versionNumber: ver.versionNumber,
                        imageUrl: ver.imageUrl,
                      })
                      if (!added) return
                    }}
                    disabled={Boolean(composerProjectId && composerProjectId !== projectId)}
                    title={composerProjectId && composerProjectId !== projectId ? "현재 열린 채팅 프로젝트와 달라 인용할 수 없어요" : undefined}
                    className="absolute top-1.5 right-10 bg-[rgba(0,0,0,0.5)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity border-none hover:bg-[rgba(76,175,80,0.7)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[rgba(0,0,0,0.5)]"
                  >
                    @
                  </button>

                  {/* Version navigation buttons */}
                  {hasRevs && (<>
                    <button onClick={(e) => { e.stopPropagation(); cycle(logo.id, -1, logo.versions.length) }} className="absolute top-1.5 right-2 bg-[rgba(0,0,0,0.5)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity border-none hover:bg-[rgba(76,175,80,0.7)]">▲</button>
                    <button onClick={(e) => { e.stopPropagation(); cycle(logo.id, 1, logo.versions.length) }} className="absolute bottom-1.5 right-2 bg-[rgba(0,0,0,0.5)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity border-none hover:bg-[rgba(76,175,80,0.7)]">▼</button>
                  </>) }
                </div>
              </div>
            )
          })}
          {pendingUploads.map((p) => (
            <div
              key={p.localId}
              data-testid={`pending-upload-${p.status}`}
              className={
                p.status === "uploading"
                  ? "aspect-square rounded-lg bg-[#1a1a1a] animate-pulse border border-[#333]"
                  : "aspect-square rounded-lg bg-[#1a1a1a] border border-red-500/60 flex items-center justify-center text-red-400 text-xl"
              }
            >{p.status === "error" ? "✕" : null}</div>
          ))}
        </div>
        )}
      </div>

      {isDragging && (
        <div
          data-testid="gallery-drop-overlay"
          className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.7)] border-2 border-dashed border-[#4CAF50] rounded-lg pointer-events-none"
        >
          <p className="text-white text-lg font-medium pointer-events-none">여기에 놓아주세요</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) void handleFiles(files)
          e.target.value = ""
        }}
        className="absolute w-0 h-0 overflow-hidden opacity-0"
        data-testid="gallery-upload-input"
      />

      {favorites.size > 0 && <div className="px-4 py-2.5 border-t border-[#333] bg-[#1a1a1a] text-sm"><span className="text-[#666]">즐겨찾기: </span><span className="text-[#4CAF50] font-medium">{favorites.size}개 선택</span></div>}

      {mLogo && mVer && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.92)] z-50 flex flex-col" onClick={() => setModalIdx(null)}>
          <span className="absolute top-4 right-6 text-white text-4xl cursor-pointer hover:text-[#4CAF50] z-10" onClick={() => setModalIdx(null)}>×</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-5xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50] select-none px-4 z-10" onClick={(e) => { e.stopPropagation(); setModalIdx((p) => p !== null ? (p - 1 + logos.length) % logos.length : null) }}>‹</span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-5xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50] select-none px-4 z-10" onClick={(e) => { e.stopPropagation(); setModalIdx((p) => p !== null ? (p + 1) % logos.length : null) }}>›</span>

          {/* Image area — fixed position, always vertically centered */}
          <div className="flex-1 flex items-center justify-center min-h-0" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img src={mVer.imageUrl} alt="" className="max-w-[85vw] max-h-[55vh] bg-white p-6 rounded-xl" />
              <span className={`absolute top-3 left-3 z-20 px-3 py-1 rounded-xl text-xs font-bold ${(activeIdx[mLogo.id] ?? 0) > 0 ? "bg-[rgba(46,125,50,0.85)] text-white" : "bg-[rgba(0,0,0,0.6)] text-[#ccc]"}`}>
                {(activeIdx[mLogo.id] ?? 0) > 0 ? `REV v${mVer.versionNumber}` : "ORIGINAL"}
              </span>
              {(mVerMeta?.source === "crop_manual" || mVerMeta?.source === "crop_auto") && (
                <span
                  className="absolute top-3 left-3 mt-6 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(46,125,50,0.85)] text-white"
                  title={mVerMeta?.source === "crop_manual" ? "수동 크롭" : "자동 크롭"}
                >
                  ✂️ 크롭
                </span>
              )}
              {modalShowEditProgress && (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/70 via-black/35 to-black/25" aria-hidden />
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                    role="status"
                    aria-live="polite"
                    aria-label="로고 편집 적용 중"
                  >
                    <div
                      className="absolute inset-y-[-30%] w-[50%] bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      style={{ animation: "gallery-edit-shimmer 2.1s ease-in-out infinite" }}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl">
                    <PulseSpinner size={32} color="#ffb74d" />
                    <p className="rounded-lg bg-black/55 px-4 py-2 text-sm font-medium text-[#ffb74d] shadow-lg backdrop-blur-sm">
                      편집 적용 중…
                    </p>
                  </div>
                  <div className="pointer-events-none absolute bottom-4 left-6 right-6 h-1 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="absolute top-0 h-full w-[42%] rounded-full bg-gradient-to-r from-[#ffb74d]/25 via-[#ffb74d] to-[#ffb74d]/25"
                      style={{ animation: "gallery-edit-bar 1.35s ease-in-out infinite" }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {!cropModalOpen && (
          <div className="shrink-0 h-40 flex flex-col items-center justify-start pt-2 pb-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">#{mLogo.orderIndex + 1}</div>
            <div className="h-5 flex items-center">
              {mVer.editPrompt ? <span className="text-[#81c784] text-xs truncate max-w-[60vw]">{mVer.editPrompt}</span> : <span className="text-[#555] text-xs">원본</span>}
            </div>
            {mLogo.versions.length > 1 && (
              <div className="flex items-center gap-3 mt-1 justify-center">
                <span className="text-white text-2xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50]" onClick={() => cycle(mLogo.id, -1, mLogo.versions.length)}>▲</span>
                <div className="flex gap-1.5">{mLogo.versions.map((_, vi) => <div key={vi} className={`w-2 h-2 rounded-full ${vi === (activeIdx[mLogo.id] ?? 0) ? "bg-[#4CAF50]" : "bg-[#444]"}`} />)}</div>
                <span className="text-white text-2xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50]" onClick={() => cycle(mLogo.id, 1, mLogo.versions.length)}>▼</span>
              </div>
            )}
            <div className="flex gap-2 mt-2 justify-center">
              <button
                onClick={() => handleDownload(mVer.imageUrl, `splash-logo-${mLogo?.orderIndex ?? 0}-v${mVer.versionNumber}.png`)}
                className="rounded-lg bg-[var(--accent-green)] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[var(--accent-green-hover)]"
              >
                PNG 다운로드
              </button>
              <button onClick={() => setCropModalOpen(true)} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50]">크롭</button>
              <span title="출시 예정" className="px-3 py-1.5 text-xs bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg text-[#777] cursor-not-allowed select-none">배경제거 <span className="ml-1 text-[10px] text-[#4CAF50]/70">예정</span></span>
              <button onClick={() => handleSvgClick(mVer)} disabled={svgMut.isPending} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50] disabled:opacity-50">{svgMut.isPending ? <><PulseSpinner size={12} color="#4CAF50" /> SVG 변환 중...</> : "SVG 다운로드"}</button>
            </div>
            <div className="text-[#555] text-[11px] mt-2">← → 로고 · ↑ ↓ 버전 · F 즐겨찾기 · Esc 닫기</div>
          </div>)}
          {cropModalOpen && modalIdx !== null && mVer && (
            <CropModal
              sourceVersion={{ id: mVer.id, imageUrl: mVer.imageUrl }}
              onClose={() => setCropModalOpen(false)}
              onCommitted={handleCropCommitted}
            />
          )}
        </div>
      )}
    </div>
  )
}