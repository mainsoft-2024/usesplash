"use client"

import Link from "next/link"
import { trpc } from "../../lib/trpc/client"

type Period = "7" | "30" | "90" | "all"

type CostByUserTableProps = {
  period: Period
}

type TopCostUser = {
  userId: string
  name: string | null
  email: string | null
  value: number
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function CostByUserTable({ period }: CostByUserTableProps) {
  const { data, isLoading, error } = trpc.adminInsights.getUserRankings.useQuery({ period })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-10 animate-pulse rounded bg-[#2a2a2a]" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-red-500">Error loading user costs</div>
  }

  const rows: TopCostUser[] = data?.topCostUsers ?? []

  if (rows.length === 0) {
    return <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-[#a1a1a1]">No active users found.</div>
  }

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-3">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Top Cost Users</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="h-8 border-b border-[#2a2a2a] text-left text-xs uppercase text-[#a1a1a1]">
              <th className="px-3">User</th>
              <th className="px-3">Email</th>
              <th className="px-3 text-right">Total API Cost</th>
              <th className="px-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="h-10 border-b border-[#2a2a2a] text-sm font-tabular-nums text-white hover:bg-[#1f1f1f]">
                <td className="px-3">{row.name ?? "Unknown"}</td>
                <td className="px-3 text-[#a1a1a1]">{row.email}</td>
                <td className="px-3 text-right">{currency.format(row.value)}</td>
                <td className="px-3 text-right">
                  <Link href={`/admin/users/${row.userId}`} className="text-[#10b981] hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
