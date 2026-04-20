import type { UIMessage } from "ai"

export type ChatMessage = {
  id: string
  content: string
  role: string
  createdAt: string | Date
  parts?: unknown
}

export function parseInitialMessages(messages: ChatMessage[] | undefined): UIMessage[] {
  if (!messages) return []

  return messages.map((msg) => {
    const fallbackParts: UIMessage["parts"] = [{
      type: "text" as const,
      text: msg.content,
    }]

    const rawParts = (msg as { parts?: unknown }).parts
    if (!Array.isArray(rawParts) || rawParts.length === 0) {
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: fallbackParts,
        createdAt: new Date(msg.createdAt),
      }
    }

    const validatedParts = rawParts.flatMap((part): UIMessage["parts"] => {
      if (!part || typeof part !== "object") return []

      const stored = part as Record<string, unknown>
      if (stored.type === "text" && typeof stored.text === "string") {
        return [{ type: "text" as const, text: stored.text }]
      }

      if (stored.type === "file" && typeof stored.mediaType === "string") {
        const data = typeof stored.data === "string" ? stored.data : undefined
        const url = typeof stored.url === "string" ? stored.url : data
        if (!url) return []
        return [{ type: "file" as any, mediaType: stored.mediaType, url, data } as any]
      }

      const hasValidToolShape =
        typeof stored.type === "string" &&
        stored.type.startsWith("tool-") &&
        typeof stored.toolCallId === "string" &&
        typeof stored.toolName === "string" &&
        typeof stored.state === "string" &&
        "input" in stored &&
        "output" in stored

      if (!hasValidToolShape) return []

      return [
        {
          type: stored.type,
          toolCallId: stored.toolCallId,
          toolName: stored.toolName,
          state: stored.state,
          input: stored.input,
          output: stored.output,
        } as UIMessage["parts"][number],
      ]
    })

    return {
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: validatedParts.length > 0 ? validatedParts : fallbackParts,
      createdAt: new Date(msg.createdAt),
    }
  })
}
