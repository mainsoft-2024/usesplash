import type { LogoMentionData } from "@/lib/chat/mention-types"

type MentionChipProps = {
  data: LogoMentionData
  onRemove?: () => void
  disabled?: boolean
  onClick?: () => void
}

export function MentionChip({ data, onRemove, disabled = false, onClick }: MentionChipProps) {
  const content = (
    <>
      <img
        src={data.imageUrl}
        alt={`#${data.orderIndex + 1} v${data.versionNumber}`}
        className="h-6 w-6 rounded-full bg-white object-contain ring-1 ring-black/5"
      />
      <span className="text-xs font-medium">
        #{data.orderIndex + 1} v{data.versionNumber}
      </span>
      {disabled && <span className="text-[10px] text-[var(--text-muted)]">삭제됨</span>}
    </>
  )

  return (
    <div
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-1.5 ${
        disabled
          ? "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-muted)] opacity-70"
          : "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
      }`}
    >
      {onClick && !disabled ? (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
          {content}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">{content}</span>
      )}
      {onRemove && !disabled ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          aria-label="멘션 제거"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
