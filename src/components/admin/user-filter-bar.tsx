"use client"

type Tier = "free" | "pro" | "demo" | "enterprise"
type ActivityFilter = "all" | "active" | "inactive"

export type UserFilters = {
  search: string
  tiers: Tier[]
  activity: ActivityFilter
  signupFrom: string
  signupTo: string
}

type UserFilterBarProps = {
  value: UserFilters
  onChange: (next: UserFilters) => void
  onSubmit?: () => void
  onReset?: () => void
  disabled?: boolean
}

const TIER_OPTIONS: Array<{ value: Tier; label: string }> = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "demo", label: "Demo" },
  { value: "enterprise", label: "Enterprise" },
]

function toggleTier(list: Tier[], tier: Tier) {
  return list.includes(tier) ? list.filter((item) => item !== tier) : [...list, tier]
}

export function UserFilterBar({ value, onChange, onSubmit, onReset, disabled = false }: UserFilterBarProps) {
  const update = (patch: Partial<UserFilters>) => onChange({ ...value, ...patch })

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a1]">사용자 검색</label>
          <input
            value={value.search}
            onChange={(event) => update({ search: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit?.()
            }}
            disabled={disabled}
            placeholder="이름 또는 이메일 검색"
            className="h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 text-sm text-white placeholder:text-[#6b6b6b] focus:border-[var(--accent-green)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a1]">활성도</label>
          <select
            value={value.activity}
            onChange={(event) => update({ activity: event.target.value as ActivityFilter })}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 text-sm text-white focus:border-[var(--accent-green)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a1]">가입 시작일</label>
          <input
            type="date"
            value={value.signupFrom}
            onChange={(event) => update({ signupFrom: event.target.value })}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 text-sm text-white focus:border-[var(--accent-green)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a1]">가입 종료일</label>
          <input
            type="date"
            value={value.signupTo}
            onChange={(event) => update({ signupTo: event.target.value })}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 text-sm text-white focus:border-[var(--accent-green)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="flex items-end gap-2 lg:col-span-1">
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className="h-10 w-full rounded-lg bg-[var(--accent-green)] px-3 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            적용
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[#a1a1a1]">등급</span>
        {TIER_OPTIONS.map((option) => {
          const selected = value.tiers.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ tiers: toggleTier(value.tiers, option.value) })}
              disabled={disabled}
              className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                selected
                  ? "border-[var(--accent-green)] bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                  : "border-[#2a2a2a] bg-[#0f0f0f] text-[#a1a1a1] hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {option.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="ml-auto h-8 rounded-lg border border-[#2a2a2a] px-3 text-xs text-[#a1a1a1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          초기화
        </button>
      </div>
    </section>
  )
}
