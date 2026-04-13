"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { LoadingScreen } from "@/components/spinners"

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
          <div className="py-20 text-center text-[var(--text-muted)]">
            <p className="mb-2 text-lg">아직 프로젝트가 없습니다</p>
            <p className="text-sm">새 프로젝트를 만들어 로고 디자인을 시작하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((project) => (
              <div
                key={project.id}
                role="article"
                tabIndex={0}
                className="group relative cursor-pointer rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5 transition-all hover:border-[var(--accent-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-green)]"
                onClick={() => router.push(`/projects/${project.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/projects/${project.id}`)
                  }
                }}
              >
                <button
                  aria-label="프로젝트 삭제"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm(project.id)
                  }}
                  className="absolute right-3 top-3 text-lg text-[var(--text-muted)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="삭제"
                >
                  ×
                </button>
                <h3 className="mb-1 text-lg font-semibold">{project.name}</h3>
                {project.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-[var(--text-secondary)]">{project.description}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-[var(--badge-purple-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-purple)]">
                    {new Date(project.createdAt).toLocaleDateString("ko")}
                  </span>
                  <span className="rounded-md bg-[var(--badge-green-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-green-light)]">
                    {project.logoCount} logos
                  </span>
                  {project.revisionCount > 0 && (
                    <span className="rounded-md bg-[var(--badge-yellow-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-yellow)]">
                      {project.revisionCount} revisions
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
