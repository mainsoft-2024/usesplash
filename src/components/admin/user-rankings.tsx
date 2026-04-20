"use client"

import { trpc } from "@/lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type RankingRow = {
  userId: string
  name: string | null
  email: string | null
  value: number
}

type UserRankingsProps = {
  period: Period
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function RankingTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string
  rows: RankingRow[]
  emptyLabel: string
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
      <header className="border-b border-[#2a2a2a] px-4 py-3 text-sm font-semibold text-white">{title}</header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#6b6b6b]">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm font-tabular-nums">
            <thead className="h-8 border-b border-[#2a2a2a] bg-[#0f0f0f] text-xs uppercase tracking-wider text-[#a1a1a1]">
              <tr>
                <th className="px-4 py-2">사용자</th>
                <th className="px-4 py-2">이메일</th>
                <th className="px-4 py-2 text-right">값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="h-10 border-b border-[#2a2a2a] hover:bg-[#1f1f1f]">
                  <td className="px-4 py-3 text-white">{row.name ?? "이름 없음"}</td>
                  <td className="px-4 py-3 text-[#a1a1a1]">{row.email ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-white">{formatCurrency(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function UserRankings({ period }: UserRankingsProps) {
  const rankingsQuery = trpc.adminInsights.getUserRankings.useQuery({ period })

  if (rankingsQuery.isLoading) {
    return (
      <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-[#2a2a2a] p-4">
              <div className="mb-4 h-4 w-28 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="h-6 animate-pulse rounded bg-[#2a2a2a]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (rankingsQuery.isError) {
    return (
      <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        사용자 랭킹 데이터를 불러오지 못했습니다.
      </section>
    )
  }

  const rankings = rankingsQuery.data
  if (!rankings) {
    return (
      <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#6b6b6b]">
        No active users found.
      </section>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <RankingTable title="Top Spenders" rows={rankings.topSpenders} emptyLabel="No active users found." />
      <RankingTable title="Top Cost Users" rows={rankings.topCostUsers} emptyLabel="No active users found." />
      <RankingTable title="Margin Ranking" rows={rankings.marginRanking} emptyLabel="No active users found." />
    </div>
  )
}
