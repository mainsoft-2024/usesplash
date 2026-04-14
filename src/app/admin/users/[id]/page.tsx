"use client"

import Link from "next/link"
import { use, useEffect, useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"

type PageProps = {
  params: Promise<{ id: string }>
}

type SubscriptionTier = "free" | "pro" | "enterprise"

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR")
}

export default function AdminUserDetailPage(props: PageProps) {
  const params = use(props.params)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = trpc.admin.getUserDetail.useQuery({
    userId: params.id,
  })

  const utils = trpc.useUtils()
  const currentTier = (data?.subscription?.tier ?? "free") as SubscriptionTier
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("free")

  useEffect(() => {
    setSelectedTier(currentTier)
  }, [currentTier])

  const updateTierMutation = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: async () => {
      await utils.admin.getUserDetail.invalidate({ userId: params.id })
    },
    onError: () => {
      setSelectedTier(currentTier)
      window.alert("요금제 변경에 실패했습니다. 다시 시도해주세요.")
    },
  })

  const handleTierChange = async (nextTier: SubscriptionTier) => {
    if (!data) return

    const tierOrder: Record<SubscriptionTier, number> = {
      free: 0,
      pro: 1,
      enterprise: 2,
    }

    const isDowngrade = tierOrder[nextTier] < tierOrder[currentTier]
    const needsConfirm = nextTier === "enterprise" || isDowngrade

    if (needsConfirm) {
      const confirmed = window.confirm(
        `요금제를 ${currentTier.toUpperCase()}에서 ${nextTier.toUpperCase()}로 변경할까요?`,
      )
      if (!confirmed) {
        setSelectedTier(currentTier)
        return
      }
    }

    setSelectedTier(nextTier)
    await updateTierMutation.mutateAsync({ userId: data.id, tier: nextTier })
  }
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
      <div className="min-h-screen bg-[#0e0e0e] p-8 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-[#a1a1a1]">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] p-8 text-white">
        <div className="mx-auto max-w-6xl space-y-4">
          <Link href="/admin" className="text-sm text-[#a1a1a1] transition-colors hover:text-white">
            ← 어드민으로 돌아가기
          </Link>
          <p className="text-red-400">사용자 정보를 불러오지 못했습니다.</p>
        </div>
      </div>
    )
  }

  const initial = (data.name ?? data.email ?? "?").charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#0e0e0e] p-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/admin" className="text-sm text-[#a1a1a1] transition-colors hover:text-white">
          ← 어드민으로 돌아가기
        </Link>

        <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2a2a2a] text-xl font-semibold text-white">
                {initial}
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white">{data.name ?? "이름 없음"}</h1>
                <p className="text-[#a1a1a1]">{data.email ?? "이메일 없음"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                권한: {data.role}
              </span>
              <div>
                <p className="text-xs text-[#6b6b6b]">요금제 관리</p>
                <div className="relative inline-block">
                  <select
                    value={selectedTier}
                    onChange={(event) => {
                      void handleTierChange(event.target.value as SubscriptionTier)
                    }}
                    disabled={updateTierMutation.isPending}
                    className={`appearance-none cursor-pointer rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] py-1 pl-3 pr-8 text-sm font-medium text-white transition-colors hover:border-[var(--accent-green)] focus:border-[var(--accent-green)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-green)] ${
                      updateTierMutation.isPending ? "cursor-wait opacity-50" : ""
                    }`}
                  >
                    <option value="free" className="bg-[#1a1a1a] text-white">
                      무료
                    </option>
                    <option value="pro" className="bg-[#1a1a1a] text-white">
                      프로
                    </option>
                    <option value="enterprise" className="bg-[#1a1a1a] text-white">
                      엔터프라이즈
                    </option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b6b]"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedTier === "free"
                    ? "bg-[#2a2a2a] text-[#a1a1a1]"
                    : selectedTier === "pro"
                      ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                      : "bg-purple-500/10 text-purple-400"
                }`}
              >
                {selectedTier.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#6b6b6b]">가입일</p>
              <p className="mt-1 text-white">{formatDate(data.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[#6b6b6b]">총 생성 수</p>
              <p className="mt-1 text-white">{data.totalGenerations.toLocaleString()}장</p>
            </div>
            <div>
              <p className="text-xs text-[#6b6b6b]">오늘 생성 수</p>
              <p className="mt-1 text-white">{data.todayGenerations.toLocaleString()}장</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">프로젝트</h2>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <p className="text-[#a1a1a1]">생성된 프로젝트가 없습니다.</p>
            </div>
          ) : (
            projects.map((project) => {
              const isExpanded = expandedProjectIds.has(project.id)

              return (
                <article
                  key={project.id}
                  className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      <p className="text-sm text-[#a1a1a1]">
                        {project.description || "설명이 없습니다."}
                      </p>
                      <p className="text-xs text-[#6b6b6b]">생성일: {formatDate(project.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="rounded-full bg-[#0f0f0f] px-3 py-1 text-xs font-medium text-[#a1a1a1] transition-colors hover:text-white"
                    >
                      {isExpanded ? "채팅 접기" : "채팅 보기"}
                    </button>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs text-[#6b6b6b]">로고 목록</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {project.logos.length === 0 ? (
                        <p className="col-span-full text-sm text-[#a1a1a1]">
                          생성된 로고가 없습니다.
                        </p>
                      ) : (
                        project.logos.map((logo) => {
                          const latestVersion = logo.versions[0]
                          const shortId = logo.id.length > 12 ? `${logo.id.slice(0, 12)}...` : logo.id

                          return (
                            <article
                              key={logo.id}
                              className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-3"
                            >
                              {latestVersion ? (
                                <img
                                  src={latestVersion.imageUrl}
                                  alt="최신 로고 썸네일"
                                  className="h-36 w-full rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-36 w-full items-center justify-center rounded-lg bg-[#1a1a1a] text-sm text-[#a1a1a1]">
                                  버전 이미지가 없습니다.
                                </div>
                              )}

                              <p className="mt-2 text-xs font-mono text-[#6b6b6b]">
                                로고 ID: {shortId}
                              </p>

                              <div className="mt-2 space-y-2">
                                {logo.versions.length === 0 ? (
                                  <p className="text-xs text-[#a1a1a1]">버전 기록이 없습니다.</p>
                                ) : (
                                  logo.versions.map((version) => (
                                    <div
                                      key={version.id}
                                      className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="rounded-full bg-[var(--accent-green)]/20 px-2 py-0.5 text-xs text-[var(--accent-green)]">
                                          v{version.versionNumber}
                                        </span>
                                        <span className="text-[10px] text-[#6b6b6b]">
                                          {formatDate(version.createdAt)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-[#a1a1a1]">
                                        {version.versionNumber === 1
                                          ? "원본 생성"
                                          : version.editPrompt?.trim() || "수정"}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </article>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 space-y-3 border-t border-[#2a2a2a] pt-4">
                      <p className="text-xs text-[#6b6b6b]">채팅 기록</p>
                      {project.chatMessages.length === 0 ? (
                        <p className="text-sm text-[#a1a1a1]">채팅 기록이 없습니다.</p>
                      ) : (
                        project.chatMessages.map((message) => {
                          const isUser = message.role === "user"
                          return (
                            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                                  isUser
                                    ? "bg-[var(--accent-green)]/10 text-white"
                                    : "bg-[#0f0f0f] text-[#a1a1a1]"
                                }`}
                              >
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#6b6b6b]">
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
