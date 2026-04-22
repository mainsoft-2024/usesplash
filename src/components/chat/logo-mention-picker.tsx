import { Command } from "cmdk"
import { useMemo } from "react"
import type { LogoMentionData } from "@/lib/chat/mention-types"

type LogoMentionPickerProps = {
  versions: LogoMentionData[]
  open: boolean
  query: string
  onQueryChange: (query: string) => void
  onSelect: (mention: LogoMentionData) => void
  onClose: () => void
  anchorRect?: DOMRect
}

function byQuery(versions: LogoMentionData[], query: string) {
  const normalized = query.trim()
  const numericMatch = /^@?(\d+)(?:v(\d+))?/i.exec(normalized)
  if (numericMatch) {
    const order = Number(numericMatch[1])
    const version = numericMatch[2] ? Number(numericMatch[2]) : null
    return versions.filter((item) => item.orderIndex + 1 === order && (version ? item.versionNumber === version : true))
  }

  if (!normalized) return versions
  const lowered = normalized.toLowerCase()
  return versions.filter((item) => `#${item.orderIndex + 1} v${item.versionNumber}`.toLowerCase().includes(lowered))
}

export function LogoMentionPicker({ versions, open, query, onQueryChange, onSelect, onClose }: LogoMentionPickerProps) {
  const filtered = useMemo(() => byQuery(versions, query), [versions, query])

  if (!open) return null

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full" role="dialog" aria-label="로고 멘션 선택">
      <Command className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-lg" shouldFilter={false}>
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          placeholder="로고 번호를 입력하세요 (예: 2v1)"
          className="w-full border-b border-[var(--divider)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onClose()
            }
          }}
        />
        <Command.List className="max-h-56 overflow-y-auto p-1">
          {versions.length === 0 ? (
            <div className="px-2 py-3 text-xs text-[var(--text-muted)]">아직 로고가 없습니다 — 먼저 로고를 생성해주세요.</div>
          ) : (
            <>
              <Command.Empty className="px-2 py-3 text-xs text-[var(--text-muted)]">일치하는 로고가 없습니다.</Command.Empty>
              {filtered.map((item) => (
                <Command.Item
                  key={item.versionId}
                  value={`#${item.orderIndex + 1} v${item.versionNumber}`}
                  onSelect={() => {
                    onSelect(item)
                    onClose()
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] data-[selected=true]:bg-[var(--bg-secondary)]"
                >
                  <img src={item.imageUrl} alt="" className="h-6 w-6 rounded-full bg-white object-contain" />
                  <span className="text-xs">#{item.orderIndex + 1} v{item.versionNumber}</span>
                </Command.Item>
              ))}
            </>
          )}
        </Command.List>
      </Command>
    </div>
  )
}
