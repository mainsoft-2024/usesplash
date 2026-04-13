"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

export default function AdminPage() {
  const [userId, setUserId] = useState("")
  const [tier, setTier] = useState<"free" | "pro" | "enterprise">("pro")
  const [message, setMessage] = useState("")

  const updateTier = trpc.subscription.adminUpdateTier.useMutation({
    onSuccess: () => setMessage("구독이 업데이트되었습니다."),
    onError: (e) => setMessage(`오류: ${e.message}`),
  })

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-bold">관리자 - 구독 관리</h1>

        <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-[#888]">사용자 ID</label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-[#555] focus:border-[#4CAF50] focus:outline-none"
                placeholder="cuid..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#888]">구독 등급</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as "free" | "pro" | "enterprise")}
                className="w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white focus:border-[#4CAF50] focus:outline-none"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (userId) updateTier.mutate({ userId, tier })
              }}
              disabled={!userId || updateTier.isPending}
              className="w-full rounded-xl bg-[#4CAF50] py-3 font-medium text-white hover:bg-[#43A047] disabled:opacity-50"
            >
              {updateTier.isPending ? "처리 중..." : "구독 변경"}
            </button>
            {message && <p className="text-center text-sm text-[#81c784]">{message}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
