"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ActivityFeed } from "@/components/admin/activity-feed"
import { CohortRetentionHeatmap } from "@/components/admin/cohort-retention-heatmap"
import { CostByUserTable } from "@/components/admin/cost-by-user-table"
import { CostStackedArea } from "@/components/admin/cost-stacked-area"
import { CostTotalsRow } from "@/components/admin/cost-totals-row"
import { CsvExportButton } from "@/components/admin/csv-export-button"
import { FunnelWidget } from "@/components/admin/funnel-widget"
import { GeminiHealthPanel } from "@/components/admin/gemini-health-panel"
import { HourDowHeatmap } from "@/components/admin/hour-dow-heatmap"
import { MarginCard } from "@/components/admin/margin-card"
import { MrrKpiRow } from "@/components/admin/mrr-kpi-row"
import { MrrTrendChart } from "@/components/admin/mrr-trend-chart"
import { OverviewKpis } from "@/components/admin/overview-kpis"
import { PeriodSelector } from "@/components/admin/period-selector"
import { PlanBreakdown } from "@/components/admin/plan-breakdown"
import { PopularKeywords } from "@/components/admin/popular-keywords"
import { SampleGallery } from "@/components/admin/sample-gallery"
import { TabNav } from "@/components/admin/tab-nav"
import { ThresholdBanners } from "@/components/admin/threshold-banners"
import { UserFilterBar } from "@/components/admin/user-filter-bar"
import { UserRankings } from "@/components/admin/user-rankings"
import { UserTableV2 } from "@/components/admin/user-table-v2"
import { trpc } from "@/lib/trpc/client"

type AdminTab = "overview" | "cost" | "revenue" | "users" | "assets"
type PeriodValue = string

function WidgetSkeleton({ className = "h-40" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 ${className}`}>
      <div className="h-full w-full animate-pulse rounded bg-[#2a2a2a]" />
    </div>
  )
}

function parseTab(value: string | null): AdminTab {
  if (value === "cost" || value === "revenue" || value === "users" || value === "assets") {
    return value
  }

  return "overview"
}

function parsePeriod(value: string | null): PeriodValue {
  if (value === "7" || value === "30" || value === "90" || value === "all") return value
  return "30"
}

function OverviewTab({ period }: { period: PeriodValue }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton className="h-32" />}>
        <OverviewKpis period={period as never} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton />}>
          <MarginCard period={period as never} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <FunnelWidget period={period as never} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton className="h-64" />}>
          <HourDowHeatmap period={period as never} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton className="h-64" />}>
          <GeminiHealthPanel />
        </Suspense>
      </div>
    </div>
  )
}

function CostTab({ period }: { period: PeriodValue }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton className="h-32" />}>
        <CostTotalsRow period={period as never} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <CostStackedArea period={period as never} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <CostByUserTable period={period as never} />
      </Suspense>
    </div>
  )
}

function RevenueTab({ period }: { period: PeriodValue }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton className="h-32" />}>
        <MrrKpiRow period={period as never} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <MrrTrendChart period={period as never} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <PlanBreakdown />
      </Suspense>
    </div>
  )
}

const USERS_PAGE_SIZE = 20

type UserFiltersState = {
  search: string
  tiers: string[]
  activity: "active" | "inactive" | "all"
  signupFrom?: Date
  signupTo?: Date
}

function UsersTabContainer({ period }: { period: PeriodValue }) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<UserFiltersState>({
    search: "",
    tiers: [],
    activity: "all",
  })

  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    pageSize: USERS_PAGE_SIZE,
    search: filters.search,
    tiers: filters.tiers.length > 0 ? filters.tiers : undefined,
    activity: filters.activity === "all" ? undefined : filters.activity,
    signupFrom: filters.signupFrom,
    signupTo: filters.signupTo,
  })

  const users = usersQuery.data?.users ?? []
  const total = usersQuery.data?.total ?? 0

  const handleFilterChange = (nextFilters: UserFiltersState) => {
    setPage(1)
    setFilters(nextFilters)
  }

  return (
    <UsersTab
      period={period}
      users={users}
      total={total}
      page={page}
      onPageChange={setPage}
      filters={filters}
      onFiltersChange={handleFilterChange}
    />
  )
}
function UsersTab({
  period,
  users,
  total,
  page,
  onPageChange,
  filters,
  onFiltersChange,
}: {
  period: PeriodValue
  users: unknown[]
  total: number
  page: number
  onPageChange: (page: number) => void
  filters: UserFiltersState
  onFiltersChange: (filters: UserFiltersState) => void
}) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton className="h-24" />}>
        <UserFilterBar value={filters as never} onChange={onFiltersChange as never} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-80" />}>
        <UserTableV2
          users={users as never}
          total={total}
          page={page}
          pageSize={USERS_PAGE_SIZE}
          onPageChange={onPageChange as never}
        />
      </Suspense>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_auto]">
        <Suspense fallback={<WidgetSkeleton className="h-72" />}>
          <UserRankings period={period as never} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton className="h-12" />}>
          <CsvExportButton filters={filters as never} />
        </Suspense>
      </div>
    </div>
  )
}

function AssetsTab({ period }: { period: PeriodValue }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <CohortRetentionHeatmap />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton className="h-72" />}>
        <ActivityFeed />
      </Suspense>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton className="h-72" />}>
          <PopularKeywords />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton className="h-72" />}>
          <SampleGallery />
        </Suspense>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const searchParams = useSearchParams()
  const tab = parseTab(searchParams.get("tab"))
  const period = parsePeriod(searchParams.get("period"))

  return (
    <div className="min-h-screen bg-[#0e0e0e] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">관리자 대시보드</h1>

        <Suspense fallback={<WidgetSkeleton className="h-16" />}>
          <ThresholdBanners />
        </Suspense>

        <div className="flex flex-col gap-4">
          <Suspense fallback={<WidgetSkeleton className="h-12" />}>
            <PeriodSelector />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton className="h-12" />}>
            <TabNav />
          </Suspense>
        </div>

        {tab === "overview" && <OverviewTab period={period} />}
        {tab === "cost" && <CostTab period={period} />}
        {tab === "revenue" && <RevenueTab period={period} />}
        {tab === "users" && <UsersTabContainer period={period} />}
        {tab === "assets" && <AssetsTab period={period} />}
      </div>
    </div>
  )
}