"use client"

import Link from "next/link"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Link href="/" className="mb-4 inline-flex text-sm text-[#888] hover:text-white">
        ← 홈으로
      </Link>
      <div className="w-full max-w-sm p-8 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            Sp<span className="text-[#4CAF50]">lash</span>
          </h1>
          <p className="text-[#666] text-sm mt-2">AI 로고 디자인 플랫폼</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/projects" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 로그인
          </button>

        </div>

        <p className="text-center text-[#444] text-xs mt-6">
          로그인 시 서비스 이용약관에 동의합니다
        </p>
      </div>
    </div>
  )
}
