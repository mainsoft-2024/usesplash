"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
}

export function SampleGallery() {
  const query = trpc.adminInsights.getSampleGallery.useQuery()
  const items = query.data ?? []

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <header className="mb-3">
        <h3 className="text-xs uppercase tracking-wider text-[#a1a1a1]">Sample Gallery</h3>
      </header>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={`gallery-skeleton-${index}`} className="aspect-square animate-pulse rounded-lg bg-[#2a2a2a]" />
          ))}
        </div>
      ) : null}

      {query.isError ? <p className="text-sm text-[#ef4444]">Error loading data</p> : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <p className="text-sm text-[#6b6b6b]">No recent generations.</p>
      ) : null}

      {!query.isLoading && !query.isError && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/users/${item.userId}`}
              className="group relative block overflow-hidden rounded-lg border border-[#2a2a2a]"
            >
              <img src={item.imageUrl} alt={item.userName ?? "sample"} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex flex-col justify-end bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/60 group-hover:opacity-100">
                <p className="truncate text-xs text-white">{item.userName ?? "Unknown"}</p>
                <p className="text-[10px] text-[#a1a1a1]">{formatDate(item.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
