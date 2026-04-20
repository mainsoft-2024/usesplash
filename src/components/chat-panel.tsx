"use client"

import { useRef, useEffect, useState, useMemo, useCallback } from "react"
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
  | { kind: "image"; url: string; mediaType: string }
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
    if (part.type === "file") {
      flushText()
      segments.push({
        kind: "image",
        url: ((part as any).url || (part as any).data) as string,
        mediaType: (part as any).mediaType as string,
      })
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

  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlMapRef = useRef(new Map<File, string>())
  const MAX_FILE_SIZE = 4 * 1024 * 1024
  const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]

  useEffect(() => {
    return () => {
      previewUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlMapRef.current.clear()
    }
  }, [])

  const getPreviewUrl = useCallback((file: File) => {
    const existing = previewUrlMapRef.current.get(file)
    if (existing) return existing
    try {
      const next = URL.createObjectURL(file)
      previewUrlMapRef.current.set(file, next)
      return next
    } catch {
      return ""
    }
  }, [])

  const convertFilesToDataURLParts = useCallback(async (files: File[]) => {
    const parts = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ type: "file"; mediaType: string; url: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ type: "file", mediaType: file.type, url: String(reader.result) })
            reader.onerror = () => reject(new Error("파일 변환에 실패했습니다"))
            reader.readAsDataURL(file)
          })
      )
    )
    return parts
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => {
      const target = prev[index]
      if (target) {
        const previewUrl = previewUrlMapRef.current.get(target)
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          previewUrlMapRef.current.delete(target)
        }
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const clearAttachedFiles = useCallback(() => {
    attachedFiles.forEach((file) => {
      const previewUrl = previewUrlMapRef.current.get(file)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        previewUrlMapRef.current.delete(file)
      }
    })
    setAttachedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [attachedFiles])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const validFiles: File[] = []
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 첨부할 수 있어요.")
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        alert("이미지당 최대 4MB까지 첨부할 수 있어요.")
        return
      }
      validFiles.push(file)
    })

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles])
    }
    event.target.value = ""
  }, [ACCEPTED_TYPES, MAX_FILE_SIZE])

  const submitMessage = useCallback(async () => {
    if (chat.isLoading) return

    const content = chat.input.trim()
    const hasFiles = attachedFiles.length > 0
    if (!content && !hasFiles) return

    const fileParts = hasFiles ? await convertFilesToDataURLParts(attachedFiles) : undefined
    chat.sendMessage(content, fileParts)
    chat.setInput("")
    if (inputRef.current) inputRef.current.style.height = "auto"
    clearAttachedFiles()
  }, [attachedFiles, chat, clearAttachedFiles, convertFilesToDataURLParts])

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void submitMessage()
    },
    [submitMessage]
  )
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
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">원하는 로고를 설명하고, 수정해달라고 요청하세요.</p>
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
                        if (seg.kind === "image") {
                          return <img key={`img-${si}`} src={seg.url} alt="첨부 이미지" className="mt-2 max-h-64 max-w-xs rounded-lg border border-[var(--border-primary)]" />
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
                {(chat.error as any)?.code === "DAILY_LIMIT_REACHED" ? (
                  <>
                    <p className="text-sm font-medium text-red-200">
                      일일 생성 한도 초과
                    </p>
                    <p className="mt-1 text-xs text-red-300/70">
                      오늘의 묣료 생성 횟수를 모두 사용했습니다. 내일 자정(UTC) 이후에 다시 시도해주세요.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-200">
                    오류: {chat.error.message || "채팅 응답에 실패했습니다"}
                  </p>
                )}
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

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="absolute w-0 h-0 overflow-hidden opacity-0"
      />
      <form onSubmit={handleFormSubmit} className="shrink-0 border-t border-[var(--divider)] bg-[var(--bg-primary)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className={`${THREAD}`}>
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.02)] transition-shadow focus-within:border-[var(--accent-green)]/35 focus-within:ring-2 focus-within:ring-[var(--accent-green)]/20">
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto px-1">
                {attachedFiles.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="relative h-12 w-12 shrink-0">
                    <img src={getPreviewUrl(file)} alt={file.name} className="h-12 w-12 rounded-md border border-[var(--border-primary)] object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-primary)] hover:text-[var(--text-primary)]"
                      aria-label="첨부 이미지 제거"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--text-secondary)]"
                aria-label="이미지 첨부"
              >
                📎
              </button>
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
                    if ((chat.input.trim() || attachedFiles.length > 0) && !chat.isLoading) {
                      void submitMessage()
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
                  disabled={!chat.input.trim() && attachedFiles.length === 0}
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
