"use client"

import Link from "next/link"
import { use, useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"

type PageProps = {
  params: Promise<{ id: string }>
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR")
}

export default function AdminUserDetailPage(props: PageProps) {
  const params = use(props.params)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = trpc.admin.getUserDetail.useQuery({
    userId: params.id,
  })

  const projects = useMemo(() => {
    if (!data?.projects) return []

    return [...data.projects].map((project) => ({
      ...project,
      chatMessages: [...project.chatMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }))
  }, [data?.projects])

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-[var(--text-secondary)]">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8 text-white">
        <div className="mx-auto max-w-6xl space-y-4">
          <Link href="/admin" className="text-sm text-[var(--text-secondary)] hover:text-white">
            ← 어드민으로 돌아가기
          </Link>
          <p className="text-red-400">사용자 정보를 불러오지 못했습니다.</p>
        </div>
      </div>
    )
  }

  const initial = (data.name ?? data.email ?? "?").charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/admin" className="text-sm text-[var(--text-secondary)] hover:text-white">
          ← 어드민으로 돌아가기
        </Link>

        <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-primary)] text-xl font-semibold text-white">
                {initial}
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white">{data.name ?? "이름 없음"}</h1>
                <p className="text-[var(--text-secondary)]">{data.email ?? "이메일 없음"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
                권한: {data.role}
              </span>
              <span className="rounded-full bg-[var(--accent-green)]/20 px-3 py-1 text-xs font-medium text-[var(--accent-green)]">
                요금제: {data.subscription?.tier ?? "free"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">가입일</p>
              <p className="mt-1 text-white">{formatDate(data.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">총 생성 수</p>
              <p className="mt-1 text-white">{data.totalGenerations.toLocaleString()}장</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">오늘 생성 수</p>
              <p className="mt-1 text-white">{data.todayGenerations.toLocaleString()}장</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">프로젝트</h2>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
              <p className="text-[var(--text-secondary)]">생성된 프로젝트가 없습니다.</p>
            </div>
          ) : (
            projects.map((project) => {
              const isExpanded = expandedProjectIds.has(project.id)

              return (
                <article
                  key={project.id}
                  className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {project.description || "설명이 없습니다."}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">생성일: {formatDate(project.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="rounded-full bg-[var(--bg-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-white"
                    >
                      {isExpanded ? "채팅 접기" : "채팅 보기"}
                    </button>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs text-[var(--text-tertiary)]">로고 썸네일</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {project.logos.length === 0 ? (
                        <p className="col-span-full text-sm text-[var(--text-secondary)]">
                          생성된 로고가 없습니다.
                        </p>
                      ) : (
                        project.logos.map((logo) => {
                          const latestVersion = logo.versions[logo.versions.length - 1] ?? logo.versions[0]

                          if (!latestVersion) return null

                          return (
                            <img
                              key={logo.id}
                              src={latestVersion.imageUrl}
                              alt="로고 썸네일"
                              className="h-24 w-full rounded-lg object-cover"
                            />
                          )
                        })
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 space-y-3 border-t border-[var(--border-primary)] pt-4">
                      <p className="text-xs text-[var(--text-tertiary)]">채팅 기록</p>
                      {project.chatMessages.length === 0 ? (
                        <p className="text-sm text-[var(--text-secondary)]">채팅 기록이 없습니다.</p>
                      ) : (
                        project.chatMessages.map((message) => {
                          const isUser = message.role === "user"
                          return (
                            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                                  isUser
                                    ? "bg-[var(--accent-green)]/20 text-white"
                                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                                }`}
                              >
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                                  {isUser ? "사용자" : "어시스턴트"}
                                </p>
                                <p className="whitespace-pre-wrap">{message.content}</p>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </article>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
