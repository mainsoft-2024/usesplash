"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import type { UIMessage } from "ai"
import type { useProjectChat } from "@/lib/chat/hooks"
import { PulseSpinner, WaveSpinner } from "@/components/spinners"
import { ChatMarkdown } from "@/components/chat-markdown"

type ChatProps = {
  chat: ReturnType<typeof useProjectChat>
}

const THREAD = "mx-auto w-full max-w-[44rem] px-4 sm:px-6"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getToolData(part: unknown) {
  if (!isRecord(part)) {
    return { input: {}, output: {}, state: undefined as string | undefined }
  }

  const input = isRecord(part.input) ? part.input : {}
  const output = isRecord(part.output) ? part.output : {}
  const state = typeof part.state === "string" ? part.state : undefined

  return { input, output, state }
}

type Segment =
  | { kind: "text"; content: string }
  | { kind: "tool"; part: NonNullable<UIMessage["parts"]>[number]; index: number }

function buildSegments(parts: UIMessage["parts"]): Segment[] {
  if (!parts?.length) return []

  const segments: Segment[] = []
  let textBuf = ""

  const flushText = () => {
    if (textBuf.length > 0) {
      segments.push({ kind: "text", content: textBuf })
      textBuf = ""
    }
  }

  parts.forEach((part, index) => {
    if (part.type === "text") {
      textBuf += part.text
      return
    }
    flushText()
    segments.push({ kind: "tool", part, index })
  })

  flushText()
  return segments
}

export function ChatPanel({ chat }: ChatProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.messages])

  const suggestions = useMemo(
    () => ["픽셀아트 게임 로고", "미니멀 테크 스타트업", "마스코트 캐릭터 로고"],
    []
  )

  function renderToolPart(part: Segment & { kind: "tool" }, key: string) {
    const p = part.part

    if (p.type === "tool-generate_batch") {
      const { input, output, state } = getToolData(p)
      const count = Number(input.count ?? 5)
      if (state === "input-available" || state === "input-streaming") {
        return (
          <div key={key} className="mt-4 border-l-2 border-[var(--accent-orange)]/70 py-1 pl-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-orange)]">
              <PulseSpinner size={14} color="var(--accent-orange)" />
              로고 {count}개 생성 중…
            </div>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: Number(count) }, (_, j) => (
                <div
                  key={j}
                  className="h-8 w-8 rounded-md bg-[var(--bg-primary)] ring-1 ring-[var(--border-primary)] animate-pulse"
                  style={{ animationDelay: `${j * 260}ms` }}
                />
              ))}
            </div>
          </div>
        )
      }
      if (state === "output-available") {
        const generated = Number(output.generated ?? 0)
        const total = Number(output.total ?? 0)
        const isPartial = generated > 0 && generated < total
        return (
          <div
            key={key}
            className={`mt-4 border-l-2 py-1 pl-3 text-xs ${
              isPartial ? "border-[var(--accent-orange)]/70 text-[var(--accent-orange)]" : "border-[var(--accent-green)]/70 text-[var(--accent-green-light)]"
            }`}
          >
            <p className="font-medium">
              {isPartial ? `${generated}/${total}개 생성 (일부 실패)` : `${generated}/${total}개 로고 생성 완료`}
            </p>
            {generated > 0 && <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">갤러리에서 확인하세요</p>}
          </div>
        )
      }
      if (state === "output-error") {
        return (
          <div key={key} className="mt-4 border-l-2 border-red-500/60 py-1 pl-3 text-xs text-red-300">
            <p className="font-medium">로고 생성 실패</p>
            <p className="mt-1 text-[11px] text-red-200/85">잠시 후 다시 시도해주세요</p>
          </div>
        )
      }
      return null
    }

    if (p.type === "tool-edit_logo") {
      const { output, state } = getToolData(p)
      if (state === "input-available" || state === "input-streaming") {
        return (
          <div key={key} className="mt-4 border-l-2 border-[var(--accent-orange)]/70 py-1 pl-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-orange)]">
              <PulseSpinner size={14} color="var(--accent-orange)" />
              로고 편집 중…
            </div>
          </div>
        )
      }
      if (state === "output-available") {
        return (
          <div key={key} className="mt-4 border-l-2 border-[var(--accent-green)]/70 py-1 pl-3 text-xs font-medium text-[var(--accent-green-light)]">
            로고 #{String(output?.logoIndex)} v{String(output?.versionNumber)} 편집 완료
          </div>
        )
      }
      if (state === "output-error") {
        return (
          <div key={key} className="mt-4 border-l-2 border-red-500/60 py-1 pl-3 text-xs text-red-300">
            편집 실패
          </div>
        )
      }
      return null
    }

    return null
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-primary)]">
      <header className="shrink-0 border-b border-[var(--divider)]">
        <div className={`${THREAD} flex items-center justify-between gap-3 py-3`}>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">AI 디자이너</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">브리프 → 시안 → 수정</p>
          </div>
          <span className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Studio
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="pb-6">
          {chat.messages.length === 0 && (
            <div className={`${THREAD} animate-[fadeInUp_0.45s_ease-out_both] py-16 text-center`}>
              <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Splash에 오신 것을 환영합니다</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                브랜드명, 스타일, 색상을 알려주시면 AI가 로고를 디자인해 드립니다
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {suggestions.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => chat.sendMessage(chip)}
                    className="rounded-full border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-green)]/50 hover:text-[var(--text-primary)]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.messages.map((msg) => {
            const isUser = msg.role === "user"
            const segments = buildSegments(msg.parts)

            return (
              <article
                key={msg.id}
                aria-label={isUser ? "내 메시지" : "Splash 응답"}
                className={`border-b border-[var(--divider)] ${isUser ? "bg-[var(--bg-secondary)]/30" : ""} animate-[fadeIn_0.2s_ease-out_both]`}
              >
                <div className={`${THREAD} py-5 sm:py-6`}>
                  <div className="min-w-0 w-full">
                    {segments.length === 0 ? (
                      <p className="text-sm text-[var(--text-dim)]">…</p>
                    ) : (
                      segments.map((seg, si) => {
                        if (seg.kind === "text") {
                          return <ChatMarkdown key={`t-${si}`} content={seg.content} />
                        }
                        return renderToolPart(seg, `tool-${seg.index}-${si}`)
                      })
                    )}
                  </div>
                </div>
              </article>
            )
          })}

          {chat.error && (
            <div className="border-b border-red-900/30 bg-red-950/20" role="alert">
              <div className={`${THREAD} py-4`}>
                <p className="text-sm text-red-200">
                  오류: {chat.error.message || "채팅 응답에 실패했습니다"}
                </p>
              </div>
            </div>
          )}

          {chat.isLoading && (
            <div className="border-b border-[var(--divider)]" role="status" aria-live="polite">
              <div className={`${THREAD} flex items-center gap-2 py-5 sm:py-6`}>
                <WaveSpinner size={22} color="var(--accent-green)" />
                <span className="text-xs text-[var(--text-tertiary)]">응답 작성 중…</span>
              </div>
            </div>
          )}
        </div>
        <div ref={endRef} className="h-px shrink-0" aria-hidden />
      </div>

      <form onSubmit={chat.handleSubmit} className="shrink-0 border-t border-[var(--divider)] bg-[var(--bg-primary)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className={`${THREAD}`}>
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.02)] transition-shadow focus-within:border-[var(--accent-green)]/35 focus-within:ring-2 focus-within:ring-[var(--accent-green)]/20">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={chat.input}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => {
                  chat.setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || ("isComposing" in e && e.isComposing)) return
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (chat.input.trim() && !chat.isLoading) {
                      chat.handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
                    }
                  }
                }}
                placeholder="메시지를 입력하세요…"
                rows={1}
                className="max-h-[160px] min-h-[44px] w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.9375rem] leading-snug text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none"
              />
              {chat.isLoading ? (
                <button
                  type="button"
                  onClick={chat.stop}
                  className="mb-0.5 h-9 shrink-0 rounded-xl bg-[var(--accent-red)] px-3.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
                >
                  정지
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!chat.input.trim()}
                  className="mb-0.5 h-9 shrink-0 rounded-xl bg-[var(--accent-green)] px-4 text-sm font-semibold text-black transition-colors hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  전송
                </button>
              )}
            </div>
          </div>
          {isFocused && (
            <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">Shift+Enter 줄바꿈 · 마크다운</p>
          )}
        </div>
      </form>
    </div>
  )
}
