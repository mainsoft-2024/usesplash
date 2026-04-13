"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

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
    onSuccess: () => projects.refetch(),
  })

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Sp<span className="text-[#4CAF50]">lash</span>
            </h1>
            <p className="mt-1 text-sm text-[#666]">AI 로고 디자인 프로젝트</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-[#4CAF50] px-4 py-2 font-medium text-white transition-colors hover:bg-[#43A047]"
          >
            + 새 프로젝트
          </button>
        </div>

        {showNew && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowNew(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-xl font-bold">새 프로젝트</h2>
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
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="프로젝트 이름"
                  className="mb-3 w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-[#555] focus:border-[#4CAF50] focus:outline-none"
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="설명 (선택)"
                  className="mb-4 w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-[#555] focus:border-[#4CAF50] focus:outline-none"
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNew(false)}
                    className="px-4 py-2 text-[#888] hover:text-white"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim() || createProject.isPending}
                    className="rounded-lg bg-[#4CAF50] px-4 py-2 font-medium text-white hover:bg-[#43A047] disabled:opacity-50"
                  >
                    {createProject.isPending ? "생성 중..." : "만들기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h2 className="mb-2 text-lg font-bold">프로젝트 삭제</h2>
              <p className="mb-4 text-sm text-[#888]">
                이 프로젝트와 모든 로고가 삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-[#888] hover:text-white"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    deleteProject.mutate({ id: deleteConfirm })
                    setDeleteConfirm(null)
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {projects.isLoading ? (
          <div className="py-20 text-center text-[#666]">로딩 중...</div>
        ) : !projects.data?.length ? (
          <div className="py-20 text-center text-[#444]">
            <p className="mb-2 text-lg">아직 프로젝트가 없습니다</p>
            <p className="text-sm">새 프로젝트를 만들어 로고 디자인을 시작하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((project) => (
              <div
                key={project.id}
                className="group relative cursor-pointer rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-all hover:border-[#4CAF50]"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm(project.id)
                  }}
                  className="absolute right-3 top-3 text-lg text-[#444] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="삭제"
                >
                  ×
                </button>
                <h3 className="mb-1 text-lg font-semibold">{project.name}</h3>
                {project.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-[#888]">{project.description}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-[#1e1e2e] px-2 py-1 text-xs font-medium text-[#8888cc]">
                    {new Date(project.createdAt).toLocaleDateString("ko")}
                  </span>
                  <span className="rounded-md bg-[#1e2e1e] px-2 py-1 text-xs font-medium text-[#81c784]">
                    {project.logoCount} logos
                  </span>
                  {project.revisionCount > 0 && (
                    <span className="rounded-md bg-[#2e2e1e] px-2 py-1 text-xs font-medium text-[#cccc66]">
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
