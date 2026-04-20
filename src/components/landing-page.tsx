"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import data from "@/lib/logo-evolution.json"
import { LandingSharedSections } from "./landing-shared-sections"

type Version = { n: number; url: string; caption: string }
type Sequence = { id: string; name: string; tagline: string; initialPrompt: string; versions: Version[] }

const SEQUENCES = data.sequences as Sequence[]
const ROTATE_MS = 2200

export function LandingPage({ session }: { session: any }) {
  const isLoggedIn = !!session?.user
  const [seqId, setSeqId] = useState<string>(SEQUENCES[0].id)
  const seq = useMemo(() => SEQUENCES.find((s) => s.id === seqId) ?? SEQUENCES[0], [seqId])
  const slides = seq.versions
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setIdx(0)
  }, [seqId])

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS)
    return () => clearTimeout(t)
  }, [idx, paused, slides.length])

  const current = slides[idx]

  return (
    <div className="bg-[var(--bg-primary)]">
      {/* Hero — copy-driven */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
          {/* LEFT: copy */}
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              한 마디 던지면,{"\n"}로고가 바뀐다.
            </h1>

            {/* sequence switcher */}
            <div className="mt-6">
              <SequenceTabs seqId={seqId} onChange={setSeqId} />
            </div>

            {/* rotating caption */}
            <div
              className="mt-6 flex min-h-[96px] flex-col justify-center md:min-h-[120px]"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              aria-live="polite"
            >
              <div
                key={`${seqId}-${current.n}`}
                className="animate-[slideUpIn_320ms_ease-out] text-xl font-medium leading-snug text-[var(--text-primary)] md:text-2xl"
              >
                <span className="text-[var(--text-muted)]">「</span>
                {current.caption}
                <span className="text-[var(--text-muted)]">」</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-[var(--text-muted)]" : "bg-[var(--accent-green)] animate-pulse"}`} />
                <span className="font-mono text-[var(--accent-green)]">{String(current.n).padStart(2, "0")}</span>
                <span>/ {slides.length}번째 대화</span>
                {paused && <span className="ml-1">· 일시정지</span>}
              </div>
            </div>

            <p className="mt-6 max-w-md text-base text-[var(--text-secondary)]">
              복잡한 툴도, 디자인 지식도 필요 없어요. 친구한테 말하듯 툭툭 던지면, AI가 알아서 고쳐줍니다.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {isLoggedIn ? (
                <Link
                  href="/projects"
                  className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]"
                >
                  대시보드로 이동
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]"
                  >
                    무료로 시작하기
                  </Link>
                  <span className="text-sm text-[var(--text-muted)]">3개 프로젝트 무료 · 신용카드 불필요</span>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: logo that morphs with the caption */}
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-[#4CAF50]/20 via-teal-400/10 to-transparent blur-3xl" />
            <LogoStage seqId={seqId} idx={idx} slides={slides} seqName={seq.name} />
            {/* timeline dots */}
            <div className="mt-3 flex items-center gap-1 px-1">
              {slides.map((s, i) => (
                <button
                  key={`${seqId}-${s.n}`}
                  onClick={() => setIdx(i)}
                  aria-label={`${s.n}번째 대화`}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    i === idx
                      ? "bg-[var(--accent-green)]"
                      : i < idx
                        ? "bg-[var(--accent-green)]/40"
                        : "bg-[var(--border-primary)] hover:bg-[var(--border-secondary)]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              {seq.tagline} · {slides.length}번의 대화로 완성.
            </p>
          </div>
        </div>
      </section>

      <LandingSharedSections isLoggedIn={isLoggedIn} />
    </div>
  )
}

function SequenceTabs({ seqId, onChange }: { seqId: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SEQUENCES.map((s) => {
        const active = s.id === seqId
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-[var(--accent-green)] text-black"
                : "border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {s.name}
            <span className={`ml-1.5 font-mono text-[10px] ${active ? "text-black/60" : "text-[var(--text-muted)]"}`}>
              {s.versions.length}단계
            </span>
          </button>
        )
      })}
    </div>
  )
}

function LogoStage({
  seqId,
  idx,
  slides,
  seqName,
}: {
  seqId: string
  idx: number
  slides: Version[]
  seqName: string
}) {
  const prevRef = useRef(idx)
  // Reset prev when sequence switches so the base layer doesn't hold an image from another sequence
  const prevSeqRef = useRef(seqId)
  if (prevSeqRef.current !== seqId) {
    prevSeqRef.current = seqId
    prevRef.current = idx
  }
  const prevIdx = prevRef.current
  useEffect(() => {
    prevRef.current = idx
  }, [idx])
  const prev = slides[prevIdx] ?? slides[idx]
  const curr = slides[idx]
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-[var(--border-primary)] bg-white shadow-2xl">
      <img
        src={prev.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain p-4 transition-opacity duration-300"
        style={{ opacity: prevIdx === slides.length - 1 && idx === 0 ? 0 : 1 }}
        draggable={false}
      />
      <img
        key={`${seqId}-${idx}`}
        src={curr.url}
        alt={`${seqName} v${curr.n}`}
        className="wipe-in-lr absolute inset-0 h-full w-full object-contain p-4"
        draggable={false}
      />
      <div className="hidden" aria-hidden>
        {slides.map((s) => (
          <img key={`${seqId}-${s.n}`} src={s.url} alt="" />
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] text-white shadow">
        v{curr.n} / {slides.length}
      </div>
    </div>
  )
}
