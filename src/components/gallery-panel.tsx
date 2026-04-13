"use client"

import { useState, useCallback, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"

type LogoVersion = {
  id: string
  versionNumber: number
  parentVersionId: string | null
  imageUrl: string
  editPrompt: string | null
  s3Key: string
  createdAt: Date | string
}

type Logo = {
  id: string
  orderIndex: number
  prompt: string
  aspectRatio: string
  versions: LogoVersion[]
}

type GalleryProps = {
  logos: Logo[]
  isLoading: boolean
  projectId: string
  onRefresh: () => void
}

export function GalleryPanel({ logos, isLoading }: GalleryProps) {
  const [activeIdx, setActiveIdx] = useState<Record<string, number>>({})
  const [modalIdx, setModalIdx] = useState<number | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const cropMut = trpc.export.crop.useMutation()
  const bgMut = trpc.export.removeBg.useMutation()
  const svgMut = trpc.export.vectorize.useMutation()

  const getVer = useCallback((logo: Logo) => logo.versions[activeIdx[logo.id] ?? 0] ?? logo.versions[0], [activeIdx])

  const cycle = useCallback((logoId: string, dir: 1 | -1, total: number) => {
    setActiveIdx((p) => ({ ...p, [logoId]: ((p[logoId] ?? 0) + dir + total) % total }))
  }, [])

  const toggleFav = (id: string) => setFavorites((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => {
    if (modalIdx === null) return
    const h = (e: KeyboardEvent) => {
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
  }, [modalIdx, logos, cycle, getVer])

  if (isLoading) return <div className="h-full flex items-center justify-center text-[#666]">갤러리 로딩...</div>
  if (!logos.length) return <div className="h-full flex flex-col items-center justify-center text-[#555]"><p className="text-lg mb-2">아직 로고가 없습니다</p><p className="text-sm">AI와 대화하여 로고를 생성하세요</p></div>

  const mLogo = modalIdx !== null ? logos[modalIdx] : null
  const mVer = mLogo ? getVer(mLogo) : null

  return (
    <div className="h-full flex flex-col bg-[#0e0e0e]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="text-sm text-[#81c784] font-medium">{logos.length} logos · {logos.reduce((s, l) => s + Math.max(0, l.versions.length - 1), 0)} revisions</div>
        <div className="text-xs text-[#555]">← → 로고 · ↑ ↓ 버전 · F 즐겨찾기</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {logos.map((logo, idx) => {
            const ver = getVer(logo)
            const ai = activeIdx[logo.id] ?? 0
            const isRev = ai > 0
            const hasRevs = logo.versions.length > 1
            return (
              <div key={logo.id} className={`bg-[#1e1e1e] rounded-xl overflow-hidden transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] group ${hasRevs ? "border border-[#333]" : ""}`}>
                <div className="relative bg-white cursor-pointer aspect-[4/3] overflow-hidden" onClick={() => setModalIdx(idx)}>
                  <img src={ver.imageUrl} alt="" className="w-full h-full object-contain" />
                  <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${isRev ? "bg-[rgba(46,125,50,0.85)] text-white" : "bg-[rgba(0,0,0,0.6)] text-[#ccc]"}`}>
                    {isRev ? `REV v${ai}` : "ORIGINAL"}
                  </span>
                  {hasRevs && (<>
                    <button onClick={(e) => { e.stopPropagation(); cycle(logo.id, -1, logo.versions.length) }} className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-[rgba(0,0,0,0.5)] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity border-none">▲</button>
                    <button onClick={(e) => { e.stopPropagation(); cycle(logo.id, 1, logo.versions.length) }} className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[rgba(0,0,0,0.5)] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity border-none">▼</button>
                  </>)}
                </div>
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xs font-semibold">#{logo.orderIndex + 1}</span>
                  {isRev && <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#2d4a1e] text-[#81c784]">REV</span>}
                  {ver.editPrompt && <span className="text-[#777] text-[11px] truncate flex-1">{ver.editPrompt}</span>}
                  {hasRevs && <div className="ml-auto flex gap-1">{logo.versions.map((_, vi) => <div key={vi} className={`w-1.5 h-1.5 rounded-full ${vi === ai ? "bg-[#4CAF50]" : "bg-[#444]"}`} />)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {favorites.size > 0 && <div className="px-4 py-2.5 border-t border-[#333] bg-[#1a1a1a] text-sm"><span className="text-[#666]">즐겨찾기: </span><span className="text-[#4CAF50] font-medium">{favorites.size}개 선택</span></div>}

      {mLogo && mVer && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.92)] z-50 flex items-center justify-center flex-col" onClick={() => setModalIdx(null)}>
          <span className="absolute top-4 right-6 text-white text-4xl cursor-pointer hover:text-[#4CAF50]" onClick={() => setModalIdx(null)}>×</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-5xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50] select-none px-4" onClick={(e) => { e.stopPropagation(); setModalIdx((p) => p !== null ? (p - 1 + logos.length) % logos.length : null) }}>‹</span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-5xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50] select-none px-4" onClick={(e) => { e.stopPropagation(); setModalIdx((p) => p !== null ? (p + 1) % logos.length : null) }}>›</span>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={mVer.imageUrl} alt="" className="max-w-[85vw] max-h-[60vh] bg-white p-6 rounded-xl" />
            <span className={`absolute top-3 left-3 px-3 py-1 rounded-xl text-xs font-bold ${(activeIdx[mLogo.id] ?? 0) > 0 ? "bg-[rgba(46,125,50,0.85)] text-white" : "bg-[rgba(0,0,0,0.6)] text-[#ccc]"}`}>
              {(activeIdx[mLogo.id] ?? 0) > 0 ? `REV v${activeIdx[mLogo.id]}` : "ORIGINAL"}
            </span>
          </div>

          <div className="mt-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">#{mLogo.orderIndex + 1}</div>
            {mVer.editPrompt && <div className="text-[#81c784] text-xs mt-1">{mVer.editPrompt}</div>}
            {mLogo.versions.length > 1 && (
              <div className="flex items-center gap-3 mt-2 justify-center">
                <span className="text-white text-2xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50]" onClick={() => cycle(mLogo.id, -1, mLogo.versions.length)}>▲</span>
                <div className="flex gap-1.5">{mLogo.versions.map((_, vi) => <div key={vi} className={`w-2 h-2 rounded-full ${vi === (activeIdx[mLogo.id] ?? 0) ? "bg-[#4CAF50]" : "bg-[#444]"}`} />)}</div>
                <span className="text-white text-2xl cursor-pointer opacity-60 hover:opacity-100 hover:text-[#4CAF50]" onClick={() => cycle(mLogo.id, 1, mLogo.versions.length)}>▼</span>
              </div>
            )}
            <div className="flex gap-2 mt-4 justify-center">
              <button onClick={() => cropMut.mutate({ logoVersionId: mVer.id })} disabled={cropMut.isPending} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50] disabled:opacity-50">{cropMut.isPending ? "크롭 중..." : "크롭"}</button>
              <button onClick={() => bgMut.mutate({ logoVersionId: mVer.id })} disabled={bgMut.isPending} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50] disabled:opacity-50">{bgMut.isPending ? "제거 중..." : "배경제거"}</button>
              <button onClick={() => svgMut.mutate({ logoVersionId: mVer.id })} disabled={svgMut.isPending} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50] disabled:opacity-50">{svgMut.isPending ? "변환 중..." : "SVG"}</button>
            </div>
            {cropMut.data && <a href={cropMut.data.url} target="_blank" className="block text-xs text-[#4CAF50] mt-2 underline">크롭 결과 다운로드</a>}
            {bgMut.data && <a href={bgMut.data.url} target="_blank" className="block text-xs text-[#4CAF50] mt-1 underline">배경제거 결과 다운로드</a>}
            {svgMut.data && <a href={svgMut.data.url} target="_blank" className="block text-xs text-[#4CAF50] mt-1 underline">SVG 다운로드</a>}
            <div className="text-[#555] text-[11px] mt-4">← → 로고 · ↑ ↓ 버전 · F 즐겨찾기 · Esc 닫기</div>
          </div>
        </div>
      )}
    </div>
  )
}