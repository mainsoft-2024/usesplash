"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"

const PAGE_SIZE = 20

type Tier = "free" | "pro" | "enterprise"
type TrendDirection = "up" | "down"
type Period = 7 | 30 | 90

type PlatformStats = {
  totalUsers: number
  totalGenerations: number
  activeUsersToday: number
  proUserCount: number
  userSparkline: number[]
  generationSparkline: number[]
  usersTrend: number
  generationsTrend: number
}

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
}

const TIER_BADGE_CLASS: Record<Tier, string> = {
  free: "bg-[#2a2a2a] text-[#a1a1a1]",
  pro: "bg-[var(--accent-green)]/10 text-[var(--accent-green)]",
  enterprise: "bg-purple-500/10 text-purple-400",
}

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
}

const AdminAreaChart = dynamic(
  () =>
    import("recharts").then((mod) => {
      const {
        AreaChart,
        Area,
        CartesianGrid,
        ResponsiveContainer,
        Tooltip,
        XAxis,
        YAxis,
      } = mod

      return function AdminAreaChartInner({
        data,
      }: {
        data: Array<{ date: string; count: number }>
      }) {
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#6b6b6b" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="#6b6b6b" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#a1a1a1" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--accent-green)"
                strokeWidth={2}
                fill="url(#greenGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }
    }),
  { ssr: false },
)

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR")
}

function getInitial(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "U"
  return source.charAt(0).toUpperCase()
}

function buildSparklinePoints(values: number[]) {
  if (values.length <= 1) return "0,20 100,20"

  const width = 100
  const height = 40
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")
}

function formatTrend(value: number) {
  const direction: TrendDirection = value >= 0 ? "up" : "down"
  const text = `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
  return { direction, text }
}

function timeAgo(dateValue: string | Date) {
  const date = new Date(dateValue)
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return "방금 전"
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  return `${Math.floor(diff / day)}일 전`
}

function KpiCard({
  label,
  value,
  trend,
  sparkline,
}: {
  label: string
  value: string
  trend: { direction: TrendDirection; text: string }
  sparkline: number[]
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-all hover:border-[var(--accent-green)] hover:bg-[#1f1f1f]">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider text-[#a1a1a1]">{label}</span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            trend.direction === "up" ? "text-[#10b981]" : "text-[#ef4444]"
          }`}
        >
          <span>{trend.direction === "up" ? "↑" : "↓"}</span>
          {trend.text}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <div className="mt-4 h-[40px] w-full">
        <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
          <polyline
            fill="none"
            stroke="var(--accent-green)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildSparklinePoints(sparkline)}
          />
        </svg>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [days, setDays] = useState<Period>(30)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [tierByUserId, setTierByUserId] = useState<Record<string, Tier>>({})

  const utils = trpc.useUtils()

  const statsQuery = trpc.admin.getPlatformStats.useQuery()
  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
  })
  const chartQuery = trpc.admin.getDailyGenerations.useQuery({ days })
  const activityQuery = trpc.admin.getRecentActivity.useQuery()

  const updateTier = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: async () => {
      setMessageType("success")
      setMessage("구독 등급이 변경되었습니다.")
      await Promise.all([
        utils.admin.listUsers.invalidate(),
        utils.admin.getPlatformStats.invalidate(),
      ])
    },
    onError: (error) => {
      setMessageType("error")
      setMessage(`등급 변경 실패: ${error.message}`)
    },
    onSettled: () => {
      setUpdatingUserId(null)
    },
  })

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

  useEffect(() => {
    if (!usersQuery.data?.users) return
    setTierByUserId((prev) => {
      const next = { ...prev }
      for (const user of usersQuery.data.users) {
        next[user.id] = (next[user.id] ?? user.tier) as Tier
      }
      return next
    })
  }, [usersQuery.data?.users])

  const stats: PlatformStats =
    statsQuery.data ??
    ({
      totalUsers: 0,
      totalGenerations: 0,
      activeUsersToday: 0,
      proUserCount: 0,
      userSparkline: [],
      generationSparkline: [],
      usersTrend: 0,
      generationsTrend: 0,
    } as PlatformStats)

  const users = usersQuery.data?.users ?? []
  const total = usersQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const chartData = chartQuery.data ?? []
  const activities = activityQuery.data ?? []

  const kpiCards = useMemo(
    () => [
      {
        label: "전체 사용자",
        value: formatNumber(stats.totalUsers),
        trend: formatTrend(stats.usersTrend),
        sparkline: stats.userSparkline,
      },
      {
        label: "총 생성 수",
        value: formatNumber(stats.totalGenerations),
        trend: formatTrend(stats.generationsTrend),
        sparkline: stats.generationSparkline,
      },
      {
        label: "오늘 활성 사용자",
        value: formatNumber(stats.activeUsersToday),
        trend: formatTrend(stats.usersTrend),
        sparkline: stats.userSparkline,
      },
      {
        label: "Pro 사용자",
        value: formatNumber(stats.proUserCount),
        trend: formatTrend(stats.usersTrend),
        sparkline: stats.userSparkline,
      },
    ],
    [stats],
  )

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

  return (
    <div className="min-h-screen bg-[#0e0e0e] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-white">관리자 대시보드</h1>

        <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {statsQuery.isLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5"
                >
                  <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="mb-4 h-8 w-20 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="h-[40px] animate-pulse rounded bg-[#2a2a2a]" />
                </div>
              ))
            : kpiCards.map((card) => (
                <KpiCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  trend={card.trend}
                  sparkline={card.sparkline}
                />
              ))}
        </section>

        <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 mb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">일별 생성 추이</h2>
            <div className="flex items-center rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-1">
              {([7, 30, 90] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setDays(period)}
                  className={
                    days === period
                      ? "rounded-md bg-[#2a2a2a] px-3 py-1 text-sm font-medium text-white"
                      : "rounded-md px-3 py-1 text-sm font-medium text-[#6b6b6b] hover:text-[#a1a1a1]"
                  }
                >
                  {period}일
                </button>
              ))}
            </div>
          </div>
          <AdminAreaChart data={chartData} />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="col-span-1 xl:col-span-8">
            <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
              <div className="border-b border-[#2a2a2a] bg-[#0f0f0f] p-4">
                <label className="mb-2 block text-xs uppercase tracking-wider text-[#a1a1a1]">사용자 검색</label>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="이름 또는 이메일 검색"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-[#6b6b6b] focus:border-[var(--accent-green)] focus:outline-none"
                />
              </div>

              {message && (
                <div
                  className={`mx-4 mt-4 rounded-lg border px-3 py-2 text-sm ${
                    messageType === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#2a2a2a] bg-[#0f0f0f] text-xs uppercase tracking-wider text-[#a1a1a1]">
                    <tr>
                      <th className="px-4 py-3">사용자</th>
                      <th className="px-4 py-3">이메일</th>
                      <th className="px-4 py-3">역할</th>
                      <th className="px-4 py-3">프로젝트</th>
                      <th className="px-4 py-3">생성 수</th>
                      <th className="px-4 py-3">구독</th>
                      <th className="px-4 py-3">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.isLoading ? (
                      <tr className="group border-b border-[#2a2a2a]">
                        <td colSpan={7} className="px-4 py-8 text-center text-[#a1a1a1]">
                          사용자 데이터를 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr className="group border-b border-[#2a2a2a]">
                        <td colSpan={7} className="px-4 py-8 text-center text-[#a1a1a1]">
                          사용자 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => {
                        const selectedTier = (tierByUserId[user.id] ?? user.tier) as Tier
                        const isRowPending = updateTier.isPending && updatingUserId === user.id

                        return (
                          <tr key={user.id} className="group border-b border-[#2a2a2a] transition-colors hover:bg-[#1f1f1f]">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white">
                                  {getInitial(user.name, user.email)}
                                </span>
                                <span className="font-medium text-white group-hover:text-[var(--accent-green)]">
                                  {user.name ?? "이름 없음"}
                                </span>
                              </Link>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-[#a1a1a1]">{user.email ?? "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-white">{user.role}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-white">{user.projectCount}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-white">{user.totalGenerations}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                                    TIER_BADGE_CLASS[selectedTier]
                                  }`}
                                >
                                  {TIER_LABEL[selectedTier]}
                                </span>
                                <div className="relative inline-block">
                                  <select
                                    value={selectedTier}
                                    onChange={(event) => handleTierChange(user, event.target.value as Tier)}
                                    disabled={isRowPending}
                                    className={`appearance-none rounded-lg border border-[#2a2a2a] bg-transparent py-1 pl-2 pr-7 text-xs font-medium text-white transition-colors focus:border-[var(--accent-green)] focus:outline-none ${
                                      isRowPending ? "cursor-wait opacity-50" : "cursor-pointer hover:border-[var(--accent-green)]"
                                    }`}
                                  >
                                    <option value="free" className="bg-[#1a1a1a] text-white">
                                      {TIER_LABEL.free}
                                    </option>
                                    <option value="pro" className="bg-[#1a1a1a] text-white">
                                      {TIER_LABEL.pro}
                                    </option>
                                    <option value="enterprise" className="bg-[#1a1a1a] text-white">
                                      {TIER_LABEL.enterprise}
                                    </option>
                                  </select>
                                  <svg
                                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]"
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
                              </div>
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
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이전
                </button>
                <p className="text-sm text-[#a1a1a1]">
                  {page} / {totalPages} 페이지
                </p>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          </section>

          <aside className="col-span-1 xl:col-span-4 flex flex-col gap-6">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#a1a1a1]">빠른 인사이트</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1a1]">전체 사용자</span>
                  <span className="font-medium text-white">{formatNumber(stats.totalUsers)}명</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1a1]">Pro 비율</span>
                  <span className="font-medium text-white">
                    {stats.totalUsers > 0
                      ? `${((stats.proUserCount / stats.totalUsers) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1a1]">오늘 활성 사용자</span>
                  <span className="font-medium text-white">{formatNumber(stats.activeUsersToday)}명</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#a1a1a1]">최근 활동</h3>
              <div>
                {activityQuery.isLoading ? (
                  <p className="text-sm text-[#6b6b6b]">활동 데이터를 불러오는 중입니다.</p>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-[#6b6b6b]">최근 활동이 없습니다.</p>
                ) : (
                  activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 border-b border-[#2a2a2a] py-3 last:border-0 last:pb-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2a2a] text-[10px] font-semibold text-white">
                        {getInitial(item.userName, item.userEmail)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm leading-5 text-white">
                          <span className="font-medium">{item.userName ?? "사용자"}</span>님이
                          {" "}
                          {item.type === "generate" ? "로고 생성" : "로고 수정"} ({item.count}건)
                        </p>
                        <p className="text-xs text-[#6b6b6b]">{timeAgo(item.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}