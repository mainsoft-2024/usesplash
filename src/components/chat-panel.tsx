"use client"

import { useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { useProjectChat } from "@/lib/chat/hooks"

type ChatProps = {
  projectName: string
  chat: ReturnType<typeof useProjectChat>
  projectId: string
}

export function ChatPanel({ projectName, chat }: ChatProps) {
  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat.messages])

  return (
    <div className="h-full flex flex-col bg-[#0e0e0e]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a]">
        <button onClick={() => router.push("/projects")} className="text-[#666] hover:text-white text-lg" title="프로젝트 목록">←</button>
        <h2 className="font-semibold text-sm truncate">{projectName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chat.messages.length === 0 && (
          <div className="text-center text-[#555] py-12">
            <p className="text-lg mb-2">안녕하세요!</p>
            <p className="text-sm">어떤 로고를 만들어 드릴까요?</p>
            <p className="text-xs text-[#444] mt-2">브랜드명, 스타일, 색상을 알려주세요</p>
          </div>
        )}

        {chat.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-[#4CAF50] text-white" : "bg-[#1e1e1e] text-[#ddd] border border-[#2a2a2a]"
            }`}>
              {msg.parts?.map((part: Record<string, unknown>, i: number) => {
                if (part.type === "text") return <span key={i}>{part.text as string}</span>
                if (part.type === "tool-invocation") {
                  const inv = part.toolInvocation as Record<string, unknown>
                  const toolName = inv.toolName as string
                  const state = inv.state as string
                  if (state === "call") {
                    return <div key={i} className="text-xs text-[#ffb74d] mt-2 flex items-center gap-2"><span className="animate-spin">⚙️</span>{toolName === "generate_batch" ? "로고 생성 중..." : "로고 편집 중..."}</div>
                  }
                  if (state === "result") {
                    const result = inv.result as Record<string, unknown> | undefined
                    if (toolName === "generate_batch") return <div key={i} className="text-xs text-[#81c784] mt-2">✓ {String(result?.generated ?? 0)}개 로고 생성 완료</div>
                    if (toolName === "edit_logo") return <div key={i} className="text-xs text-[#81c784] mt-2">✓ 로고 #{String(result?.logoIndex)} v{String(result?.versionNumber)} 편집 완료</div>
                  }
                }
                return null
              })}
            </div>
          </div>
        ))}

        {chat.isLoading && chat.messages.length > 0 && chat.messages[chat.messages.length - 1]?.role === "user" && (
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

      <form onSubmit={chat.handleSubmit} className="p-3 border-t border-[#2a2a2a]">
        <div className="flex gap-2">
          <textarea
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chat.handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>) } }}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-xl text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#4CAF50]"
          />
          <button type="submit" disabled={!chat.input.trim() || chat.isLoading} className="px-4 py-2.5 bg-[#4CAF50] text-white rounded-xl font-medium hover:bg-[#43A047] disabled:opacity-50 transition-colors">전송</button>
        </div>
      </form>
    </div>
  )
}