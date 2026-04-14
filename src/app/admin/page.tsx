"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc/client"

const PAGE_SIZE = 20

type Tier = "free" | "pro" | "enterprise"

export default function AdminPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const [userId, setUserId] = useState("")
  const [tier, setTier] = useState<Tier>("pro")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading } = trpc.admin.listUsers.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
  })

  const updateTier = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: () => setMessage("구독이 업데이트되었습니다."),
    onError: (e) => setMessage(`오류: ${e.message}`),
  })

  const users = data?.users ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold text-white">관리자 사용자 관리</h1>

        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
          <label className="mb-2 block text-sm text-[var(--text-tertiary)]">사용자 검색</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--accent-green)] focus:outline-none"
          />
        </div>

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
                  users.map((user) => (
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
                      <td className="px-4 py-3">{user.tier}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {new Date(user.joinedAt).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))
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

        <details className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
          <summary className="cursor-pointer text-lg font-semibold text-white">구독 등급 수동 변경</summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-[var(--text-tertiary)]">사용자 ID</label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--accent-green)] focus:outline-none"
                placeholder="cuid..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[var(--text-tertiary)]">구독 등급</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
                className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--accent-green)] focus:outline-none"
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (userId) updateTier.mutate({ userId, tier })
              }}
              disabled={!userId || updateTier.isPending}
              className="rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateTier.isPending ? "처리 중..." : "구독 변경"}
            </button>

            {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
          </div>
        </details>
      </div>
    </div>
  )
}