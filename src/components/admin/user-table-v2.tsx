"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"

type Tier = "free" | "pro" | "demo" | "enterprise"
type SortKey = "joinedAt" | "totalGenerations" | "totalCostUsd" | "ltvUsd" | "marginUsd"
type SortDirection = "asc" | "desc"

type UserRow = {
  id: string
  name: string | null
  email: string | null
  tier: Tier | string
  projectCount: number
  totalGenerations: number
  joinedAt: string | Date
  totalCostUsd: number
  ltvUsd: number
  marginUsd: number
}

type UserTableV2Props = {
  users: UserRow[]
  total: number
  page: number
  pageSize: number
  onPageChange: (nextPage: number) => void
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
}

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  demo: "Demo",
  enterprise: "Enterprise",
}

const TIER_BADGE_CLASS: Record<Tier, string> = {
  free: "bg-[#2a2a2a] text-[#a1a1a1]",
  pro: "bg-[var(--accent-green)]/10 text-[var(--accent-green)]",
  demo: "bg-blue-500/10 text-blue-400",
  enterprise: "bg-purple-500/10 text-purple-400",
}

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  demo: 2,
  enterprise: 3,
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function getInitial(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "U"
  return source.charAt(0).toUpperCase()
}

export function UserTableV2({
  users,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading = false,
  isError = false,
  errorMessage,
}: UserTableV2Props) {
  const [sortKey, setSortKey] = useState<SortKey>("joinedAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [tierByUserId, setTierByUserId] = useState<Record<string, Tier>>({})

  const utils = trpc.useUtils()
  const updateTier = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.listUsers.invalidate(), utils.adminInsights.getUserRankings.invalidate()])
    },
    onSettled: () => {
      setUpdatingUserId(null)
    },
  })

  useEffect(() => {
    setTierByUserId((prev) => {
      const next = { ...prev }
      for (const user of users) {
        const tier = user.tier as Tier
        if (tier in TIER_LABEL) next[user.id] = next[user.id] ?? tier
      }
      return next
    })
  }, [users])

  const sortedUsers = useMemo(() => {
    const copy = [...users]
    copy.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1
      if (sortKey === "joinedAt") {
        return (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()) * direction
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * direction
    })
    return copy
  }, [users, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const setSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(nextKey)
    setSortDirection("desc")
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDirection === "asc" ? "↑" : "↓"
  }

  const handleTierChange = (user: UserRow, nextTier: Tier) => {
    const currentTier = (tierByUserId[user.id] ?? user.tier) as Tier
    if (currentTier === nextTier) return

    const isUpgradeToEnterprise = nextTier === "enterprise"
    const isDowngrade = TIER_ORDER[nextTier] < TIER_ORDER[currentTier]

    if (isUpgradeToEnterprise || isDowngrade) {
      const confirmed = window.confirm(
        isUpgradeToEnterprise
          ? "엔터프라이즈 등급으로 변경할까요?"
          : `${user.name ?? "사용자"}님의 구독을 낮은 등급으로 변경할까요?`,
      )

      if (!confirmed) {
        setTierByUserId((prev) => ({ ...prev, [user.id]: currentTier }))
        return
      }
    }

    setTierByUserId((prev) => ({ ...prev, [user.id]: nextTier }))
    setUpdatingUserId(user.id)
    updateTier.mutate(
      { userId: user.id, tier: nextTier },
      {
        onError: () => {
          setTierByUserId((prev) => ({ ...prev, [user.id]: currentTier }))
        },
      },
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="h-8 border-b border-[#2a2a2a] bg-[#0f0f0f] text-xs uppercase tracking-wider text-[#a1a1a1]">
            <tr>
              <th className="px-4 py-2">사용자</th>
              <th className="px-4 py-2">이메일</th>
              <th className="px-4 py-2">구독</th>
              <th className="px-4 py-2">프로젝트</th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSort("totalGenerations")} className="inline-flex items-center gap-1">
                  생성 수 <span className="text-white">{sortArrow("totalGenerations")}</span>
                </button>
              </th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSort("totalCostUsd")} className="inline-flex items-center gap-1">
                  비용 <span className="text-white">{sortArrow("totalCostUsd")}</span>
                </button>
              </th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSort("ltvUsd")} className="inline-flex items-center gap-1">
                  LTV <span className="text-white">{sortArrow("ltvUsd")}</span>
                </button>
              </th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSort("marginUsd")} className="inline-flex items-center gap-1">
                  마진 <span className="text-white">{sortArrow("marginUsd")}</span>
                </button>
              </th>
              <th className="px-4 py-2">
                <button type="button" onClick={() => setSort("joinedAt")} className="inline-flex items-center gap-1">
                  가입일 <span className="text-white">{sortArrow("joinedAt")}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="h-10 border-b border-[#2a2a2a]">
                <td colSpan={9} className="px-4 py-8 text-center text-[#a1a1a1]">
                  사용자 데이터를 불러오는 중입니다.
                </td>
              </tr>
            ) : isError ? (
              <tr className="h-10 border-b border-[#2a2a2a]">
                <td colSpan={9} className="px-4 py-8 text-center text-red-400">
                  {errorMessage ?? "사용자 데이터를 불러오지 못했습니다."}
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr className="h-10 border-b border-[#2a2a2a]">
                <td colSpan={9} className="px-4 py-8 text-center text-[#6b6b6b]">
                  No active users found.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => {
                const selectedTier = (tierByUserId[user.id] ?? user.tier) as Tier
                const isRowPending = updateTier.isPending && updatingUserId === user.id

                return (
                  <tr key={user.id} className="h-10 border-b border-[#2a2a2a] font-tabular-nums transition-colors hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white">
                          {getInitial(user.name, user.email)}
                        </span>
                        <span className="font-medium text-white hover:text-[var(--accent-green)]">{user.name ?? "이름 없음"}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#a1a1a1]">{user.email ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${TIER_BADGE_CLASS[selectedTier]}`}>
                          {TIER_LABEL[selectedTier]}
                        </span>
                        <select
                          value={selectedTier}
                          onChange={(event) => handleTierChange(user, event.target.value as Tier)}
                          disabled={isRowPending}
                          className={`appearance-none rounded-lg border border-[#2a2a2a] bg-transparent py-1 px-2 text-xs font-medium text-white transition-colors focus:border-[var(--accent-green)] focus:outline-none ${
                            isRowPending ? "cursor-wait opacity-50" : "cursor-pointer hover:border-[var(--accent-green)]"
                          }`}
                        >
                          <option value="free" className="bg-[#1a1a1a] text-white">
                            {TIER_LABEL.free}
                          </option>
                          <option value="pro" className="bg-[#1a1a1a] text-white">
                            {TIER_LABEL.pro}
                          </option>
                          <option value="demo" className="bg-[#1a1a1a] text-white">
                            {TIER_LABEL.demo}
                          </option>
                          <option value="enterprise" className="bg-[#1a1a1a] text-white">
                            {TIER_LABEL.enterprise}
                          </option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-white">{user.projectCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white">{user.totalGenerations.toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#ef4444]">{formatCurrency(user.totalCostUsd)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--accent-green)]">{formatCurrency(user.ltvUsd)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${user.marginUsd >= 0 ? "text-[var(--accent-green)]" : "text-[#ef4444]"}`}>
                      {formatCurrency(user.marginUsd)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#a1a1a1]">
                      {new Date(user.joinedAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
          className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          이전
        </button>
        <p className="text-sm font-tabular-nums text-[#a1a1a1]">
          {page} / {totalPages} 페이지
        </p>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || isLoading}
          className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음
        </button>
      </div>
    </section>
  )
}
