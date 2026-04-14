"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { LoadingScreen } from "@/components/spinners"
import { UsageStats } from "@/components/usage-stats"

function ThumbnailGrid({ thumbnails }: { thumbnails: string[] }) {
  if (thumbnails.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center bg-[var(--bg-primary)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-8 w-8 text-[var(--text-tertiary)]/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
          <circle cx="9" cy="10" r="1.4" />
          <path d="M6.5 16l4-4 2.5 2.5 2-2 2.5 3.5" />
        </svg>
      </div>
    )
  }

  if (thumbnails.length === 1) {
    return (
      <div className="h-[180px] overflow-hidden">
        <img
          src={thumbnails[0]}
          alt=""
          loading="lazy"
          className="h-full w-full animate-[fadeIn_300ms_ease-out] object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    )
  }

  if (thumbnails.length === 2) {
    return (
      <div className="grid h-[180px] grid-cols-2 gap-px overflow-hidden bg-[var(--bg-primary)]">
        {thumbnails.map((url) => (
          <div key={url} className="overflow-hidden">
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full animate-[fadeIn_300ms_ease-out] object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid h-[180px] grid-cols-5 gap-px overflow-hidden bg-[var(--bg-primary)]">
      <div className="col-span-3 overflow-hidden">
        <img
          src={thumbnails[0]}
          alt=""
          loading="lazy"
          className="h-full w-full animate-[fadeIn_300ms_ease-out] object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="col-span-2 grid grid-rows-2 gap-px overflow-hidden">
        {thumbnails.slice(1, 3).map((url) => (
          <div key={url} className="overflow-hidden">
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full animate-[fadeIn_300ms_ease-out] object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")

  const projects = trpc.project.list.useQuery()
  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`)
    },
  })
  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      projects.refetch()
      setDeleteConfirm(null)
    },
  })

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const closeNewModal = () => {
    setShowNew(false)
    setNewName("")
    setNewDesc("")
    if (createProject.error) {
      createProject.reset()
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-3xl font-bold hover:opacity-90">
              Sp<span className="text-[var(--accent-green)]">lash</span>
            </Link>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">AI 로고 디자인 프로젝트</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--accent-green-hover)]"
          >
            + 새 프로젝트
          </button>
        </div>

        <div className="mb-8">
          <UsageStats />
        </div>

        {showNew && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex animate-[fadeIn_150ms_ease-out] items-center justify-center bg-black/60"
            onClick={closeNewModal}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeNewModal()
            }}
          >
            <div
              className="w-full max-w-md animate-[scaleIn_150ms_ease-out] rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="new-project-title" className="mb-4 text-xl font-bold">
                새 프로젝트
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newName.trim()) {
                    createProject.mutate({
                      name: newName.trim(),
                      description: newDesc.trim() || undefined,
                    })
                  }
                }}
              >
                <input
                  autoFocus
                  aria-label="프로젝트 이름"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="프로젝트 이름"
                  className="mb-3 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder-[var(--text-dim)] focus:border-[var(--accent-green)] focus:outline-none"
                />
                <input
                  aria-label="프로젝트 설명"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="설명 (선택)"
                  className="mb-4 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder-[var(--text-dim)] focus:border-[var(--accent-green)] focus:outline-none"
                />
                {createProject.error?.message && (
                  <p className="mb-4 text-sm text-red-400">{createProject.error.message}</p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeNewModal}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-white"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim() || createProject.isPending}
                    className="rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)] disabled:opacity-50"
                  >
                    {createProject.isPending ? "생성 중..." : "만들기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex animate-[fadeIn_150ms_ease-out] items-center justify-center bg-black/60"
            onClick={() => setDeleteConfirm(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleteConfirm(null)
            }}
          >
            <div
              className="w-full max-w-sm animate-[scaleIn_150ms_ease-out] rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-project-title" className="mb-2 text-lg font-bold">
                프로젝트 삭제
              </h2>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                이 프로젝트와 모든 로고가 삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-white"
                >
                  취소
                </button>
                <button
                  disabled={deleteProject.isPending}
                  onClick={() => {
                    if (!deleteConfirm) return
                    deleteProject.mutate({ id: deleteConfirm })
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteProject.isPending ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          </div>
        )}

        {projects.isLoading ? (
          <LoadingScreen />
        ) : projects.isError ? (
          <div className="py-20 text-center">
            <p className="mb-3 text-sm text-red-400">프로젝트를 불러오지 못했습니다.</p>
            <button
              onClick={() => projects.refetch()}
              className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-green-hover)]"
            >
              다시 시도
            </button>
          </div>
        ) : !projects.data?.length ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)] py-20">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-10 w-10 text-[var(--text-tertiary)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
              <circle cx="9" cy="10" r="1.4" />
              <path d="M6.5 16l4-4 2.5 2.5 2-2 2.5 3.5" />
            </svg>
            <p className="mt-4 text-lg text-[var(--text-secondary)]">아직 프로젝트가 없습니다</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">새 프로젝트를 만들어 로고 디자인을 시작하세요</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-6 rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--accent-green-hover)]"
            >
              + 새 프로젝트
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((project) => (
              <div
                key={project.id}
                role="article"
                tabIndex={0}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-green)]"
                onClick={() => router.push(`/projects/${project.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/projects/${project.id}`)
                  }
                }}
              >
                <ThumbnailGrid thumbnails={project.thumbnails} />
                <div className="p-5">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-lg font-medium">{project.name}</h3>
                    <button
                      aria-label="프로젝트 삭제"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(project.id)
                      }}
                      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] opacity-0 transition hover:bg-[var(--bg-tertiary)] hover:text-red-500 group-hover:opacity-100"
                      title="삭제"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M4 7h16" />
                        <path d="M9 7V5h6v2" />
                        <path d="M8 7l.7 11h6.6L16 7" />
                        <path d="M10.5 10.5v5" />
                        <path d="M13.5 10.5v5" />
                      </svg>
                    </button>
                  </div>
                  {project.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">{project.description}</p>
                  )}
                  <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                    {project.logoCount}개의 로고 · {project.revisionCount}개의 버전 · {new Date(project.createdAt).toLocaleDateString("ko")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
