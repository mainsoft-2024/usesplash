"use client"

import { useRef, useEffect, useState } from "react"
import type { useProjectChat } from "@/lib/chat/hooks"

type ChatProps = {
  chat: ReturnType<typeof useProjectChat>
}

export function ChatPanel({ chat }: ChatProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.messages])

  return (
    <div className="h-full flex flex-col bg-[#0e0e0e]">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {chat.messages.length === 0 && (
          <div className="text-center text-[#555] py-12">
            <p className="text-lg mb-2">Splash에 오신 것을 환영합니다</p>
            <p className="text-sm">브랜드명, 스타일, 색상을 알려주시면 AI가 로고를 디자인해 드립니다</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {["픽셀아트 게임 로고", "미니멀 테크 스타트업", "마스코트 캐릭터 로고"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => chat.sendMessage(chip)}
                  className="rounded-full border border-[#333] bg-[#1a1a1a] px-3 py-1 text-xs text-[#bbb] transition-colors hover:border-[#4CAF50] hover:text-white"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-[#4CAF50] text-white" : "bg-[#1e1e1e] text-[#ddd] border border-[#2a2a2a]"
            }`}>
              {(() => {
                const parts = msg.parts as Array<Record<string, unknown>> | undefined
                if (!parts || parts.length === 0) {
                  return <span className="text-[#555]">...</span>
                }

                return parts.map((part, i) => {
                  if (part.type === "text") return <span key={i}>{String(part.text ?? "")}</span>
                  if (part.type === "tool-invocation") {
                    const inv = part.toolInvocation as Record<string, unknown>
                    const toolName = inv.toolName as string
                    const state = inv.state as string

                    if (state === "call") {
                      const args = inv.args as Record<string, unknown> | undefined
                      const count = args?.count ?? 5
                      return (
                        <div key={i} className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-[#ffb74d]">
                            <span className="inline-block w-3 h-3 border-2 border-[#ffb74d] border-t-transparent rounded-full animate-spin" />
                            {toolName === "generate_batch" ? `로고 ${count}개 생성 중...` : "로고 편집 중..."}
                          </div>
                          {toolName === "generate_batch" && (
                            <div className="flex gap-1">
                              {Array.from({ length: Number(count) }, (_, j) => (
                                <div
                                  key={j}
                                  className="w-8 h-8 rounded-lg bg-[#2a2a2a] animate-pulse"
                                  style={{ animationDelay: `${j * 300}ms` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (state === "result") {
                      const result = inv.result as Record<string, unknown> | undefined
                      if (toolName === "generate_batch") {
                        const generated = Number(result?.generated ?? 0)
                        const total = Number(result?.total ?? 0)
                        return (
                          <div key={i} className="mt-2 space-y-1.5">
                            <div className="text-xs text-[#81c784]">✓ {generated}/{total}개 로고 생성 완료</div>
                            {generated > 0 && (
                              <div className="text-[10px] text-[#555]">갤러리에서 확인하세요 →</div>
                            )}
                          </div>
                        )
                      }
                      if (toolName === "edit_logo") return <div key={i} className="text-xs text-[#81c784] mt-2">✓ 로고 #{String(result?.logoIndex)} v{String(result?.versionNumber)} 편집 완료</div>
                    }
                  }
                  return null
                })
              })()}
            </div>
          </div>
        ))}

        {chat.error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-red-900/30 border border-red-800/50 text-red-300">
              오류: {chat.error.message || "채팅 응답에 실패했습니다"}
            </div>
          </div>
        )}

        {chat.isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={chat.handleSubmit} className="p-4 border-t border-[#1a1a1a]">
        <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-2 transition-colors focus-within:border-[#4CAF50]/50">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={chat.input}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => {
                chat.setInput(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
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
              placeholder="메시지를 입력하세요..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-white text-sm placeholder-[#555] focus:outline-none max-h-[120px]"
            />
            {chat.isLoading ? (
              <button
                type="button"
                onClick={chat.stop}
                className="h-9 px-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                정지
              </button>
            ) : (
              <button
                type="submit"
                disabled={!chat.input.trim()}
                className="h-9 px-4 bg-[#4CAF50] text-white rounded-xl font-medium hover:bg-[#43A047] disabled:opacity-50 transition-colors"
              >
                전송
              </button>
            )}
          </div>
        </div>
        {isFocused && <div className="text-[10px] text-[#333] text-right mt-1.5">Shift+Enter 줄바꿈</div>}
      </form>
    </div>
  )
}