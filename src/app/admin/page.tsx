"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc/client"

const PAGE_SIZE = 20

type Tier = "free" | "pro" | "enterprise"
type PlatformStats = {
  totalUsers: number
  totalProjects: number
  totalGenerations: number
  activeUsersToday: number
}

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
}

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
}

function AdminStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 transition-colors hover:border-[var(--border-secondary)]">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[var(--accent-green)]/5 blur-2xl" />
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </span>
      <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6"
        >
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[var(--accent-green)]/5 blur-2xl" />
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[var(--border-primary)]" />
          <div className="h-8 w-20 animate-pulse rounded bg-[var(--border-primary)]" />
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [tierByUserId, setTierByUserId] = useState<Record<string, Tier>>({})

  const utils = trpc.useUtils()

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => {
      setMessage("")
      setMessageType("")
    }, 2200)
    return () => clearTimeout(timer)
  }, [message])

  const { data: statsData, isLoading: isStatsLoading } = trpc.admin.getPlatformStats.useQuery()

  const { data, isLoading } = trpc.admin.listUsers.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
  })

  useEffect(() => {
    if (!data?.users) return
    setTierByUserId((prev) => {
      const next = { ...prev }
      for (const user of data.users) {
        next[user.id] = (next[user.id] ?? user.tier) as Tier
      }
      return next
    })
  }, [data?.users])

  const updateTier = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: async () => {
      setMessageType("success")
      setMessage("구독 등급이 변경되었습니다.")
      await utils.admin.listUsers.invalidate()
    },
    onError: (e) => {
      setMessageType("error")
      setMessage(`등급 변경 실패: ${e.message}`)
    },
    onSettled: () => {
      setUpdatingUserId(null)
    },
  })

  const handleTierChange = (user: { id: string; tier: string; name: string | null }, nextTier: Tier) => {
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

  const users = data?.users ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const stats: PlatformStats =
    statsData ??
    ({
      totalUsers: 0,
      totalProjects: 0,
      totalGenerations: 0,
      activeUsersToday: 0,
    } as PlatformStats)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold text-white">관리자 대시보드</h1>

        {isStatsLoading ? (
          <AdminStatsSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
            <AdminStatCard label="전체 사용자" value={stats.totalUsers.toLocaleString("ko-KR")} />
            <AdminStatCard label="전체 프로젝트" value={stats.totalProjects.toLocaleString("ko-KR")} />
            <AdminStatCard label="총 생성 수" value={stats.totalGenerations.toLocaleString("ko-KR")} />
            <AdminStatCard label="오늘 활성 사용자" value={stats.activeUsersToday.toLocaleString("ko-KR")} />
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
          <label className="mb-2 block text-sm text-[var(--text-tertiary)]">사용자 검색</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--accent-green)] focus:outline-none"
          />
        </div>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              messageType === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
            }`}
          >
            {message}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <tr className="text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">이메일</th>
                  <th className="px-4 py-3">역할</th>
                  <th className="px-4 py-3">프로젝트</th>
                  <th className="px-4 py-3">생성 수</th>
                  <th className="px-4 py-3">구독</th>
                  <th className="px-4 py-3">가입일</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                    <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      불러오는 중...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                    <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      사용자 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const selectedTier = (tierByUserId[user.id] ?? user.tier) as Tier
                    const isRowPending = updateTier.isPending && updatingUserId === user.id

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] text-white"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${user.id}`} className="hover:text-[var(--accent-green)]">
                            {user.name ?? "이름 없음"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{user.email ?? "-"}</td>
                        <td className="px-4 py-3">{user.role}</td>
                        <td className="px-4 py-3">{user.projectCount}</td>
                        <td className="px-4 py-3">{user.totalGenerations}</td>
                        <td className="px-4 py-3">
                          <div className="relative inline-block">
                            <select
                              value={selectedTier}
                              onChange={(e) => handleTierChange(user, e.target.value as Tier)}
                              disabled={isRowPending}
                              className={`appearance-none cursor-pointer rounded-lg border border-[var(--border-primary)] bg-transparent py-1 pl-3 pr-8 text-sm font-medium text-white transition-colors hover:border-[var(--accent-green)] focus:border-[var(--accent-green)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-green)] ${
                                isRowPending ? "cursor-wait opacity-50" : ""
                              }`}
                            >
                              <option value="free" className="bg-[var(--bg-secondary)] text-white">
                                {TIER_LABEL.free}
                              </option>
                              <option value="pro" className="bg-[var(--bg-secondary)] text-white">
                                {TIER_LABEL.pro}
                              </option>
                              <option value="enterprise" className="bg-[var(--bg-secondary)] text-white">
                                {TIER_LABEL.enterprise}
                              </option>
                            </select>
                            <svg
                              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                              viewBox="0 0 20 20"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden
                            >
                              <path
                                d="M5 7.5L10 12.5L15 7.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {new Date(user.joinedAt).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              이전
            </button>
            <p className="text-sm text-[var(--text-secondary)]">
              {page} / {totalPages} 페이지
            </p>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}