import type { UIMessage } from "ai"

export type ToolActivity =
  | { type: "idle" }
  | { type: "generating"; count: number }
  | { type: "editing"; logoIndex: number; versionNumber?: number }
  | { type: "generated"; count: number; generated: number }
  | { type: "edited"; logoIndex: number; versionNumber: number }

export function deriveToolActivity(messages: UIMessage[]): ToolActivity {
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant")
  if (!lastAssistant?.parts) return { type: "idle" }

  for (const part of lastAssistant.parts) {
    const p = part as any
    if (p.type === "tool-generate_batch") {
      if (p.state === "input-available" || p.state === "input-streaming") {
        return { type: "generating", count: p.input?.count ?? 5 }
      }
      if (p.state === "output-available") {
        return {
          type: "generated",
          count: Number(p.output?.total ?? 0),
          generated: Number(p.output?.generated ?? 0),
        }
      }
    }

    if (p.type === "tool-edit_logo") {
      if (p.state === "input-available" || p.state === "input-streaming") {
        return {
          type: "editing",
          logoIndex: Number(p.input?.logoOrderIndex ?? 0),
          versionNumber: p.input?.versionNumber,
        }
      }
      if (p.state === "output-available") {
        return {
          type: "edited",
          logoIndex: Number(p.output?.logoIndex ?? 0),
          versionNumber: Number(p.output?.versionNumber ?? 0),
        }
      }
    }
  }

  return { type: "idle" }
}
