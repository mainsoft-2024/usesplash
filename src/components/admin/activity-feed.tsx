"use client"

import { useEffect, useMemo, useRef } from "react"
import { trpc } from "@/lib/trpc/client"

const PAGE_SIZE = 50

function timeAgo(dateValue: string | Date) {
  const date = new Date(dateValue)
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return "방금 전"
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}분 전`
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}시간 전`
  return `${Math.max(1, Math.floor(diff / day))}일 전`
}

export function ActivityFeed() {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const query = trpc.adminInsights.getActivityFeed.useInfiniteQuery(
    { limit: PAGE_SIZE },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  )

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data?.pages])

  const refresh = () => {
    void query.refetch()
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void query.refetch()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [query])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        if (!query.hasNextPage || query.isFetchingNextPage) return
        void query.fetchNextPage()
      },
      { rootMargin: "200px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [query])

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Activity Feed</h3>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-[#2a2a2a] px-2.5 py-1.5 text-xs text-[#a1a1a1] transition-colors hover:border-[#a1a1a1] hover:text-white"
        >
          새로고침
        </button>
      </header>

      {query.isError ? <p className="text-sm text-[#ef4444]">Error loading data</p> : null}

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="flex items-start gap-3 border-b border-[#2a2a2a] py-3 last:border-0">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[#2a2a2a]" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-[#2a2a2a]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!query.isLoading && !query.isError ? (
        items.length === 0 ? (
          <p className="text-sm text-[#6b6b6b]">최근 활동이 없습니다.</p>
        ) : (
          <div className="space-y-0">
            {items.map((item) => {
              const payload = item.payload as Record<string, unknown>
              const body =
                item.kind === "usage"
                  ? `${String(payload.usageType ?? "usage")} · ${Number(payload.count ?? 0)}건 · $${Number(payload.totalCostUsd ?? 0).toFixed(4)}`
                  : `tier 변경 → ${String(payload.tier ?? "unknown")}`

              return (
                <div key={item.id} className="flex items-start gap-3 border-b border-[#2a2a2a] py-3 last:border-0">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
                  <div className="min-w-0 flex-1 border-l border-[#2a2a2a] pl-3">
                    <p className="truncate text-sm text-white">
                      <span className="font-medium">{item.userId}</span> · {body}
                    </p>
                    <p className="mt-1 text-xs text-[#6b6b6b]">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
              )
            })}

            <div ref={sentinelRef} className="h-4" />
            {query.isFetchingNextPage ? <p className="text-xs text-[#6b6b6b]">더 불러오는 중...</p> : null}
          </div>
        )
      ) : null}
    </section>
  )
}
