"use client"

import { useState } from "react"

const tabs = ["이용약관", "개인정보처리방침"] as const

export default function TermsPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("이용약관")

  return (
    <div className="bg-[var(--bg-primary)]">
      <section className="mx-auto max-w-[65ch] px-6 py-24">
        <h1 className="text-4xl font-bold">법적 고지</h1>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
          {activeTab === "이용약관" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </section>
    </div>
  )
}

function TermsContent() {
  return (
    <>
      <p className="text-xs text-[var(--text-muted)]">최종 수정일: 2026년 4월 1일</p>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">제1조 (목적)</h2>
      <p>이 약관은 Splash(이하 "서비스")가 제공하는 AI 로고 디자인 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">제2조 (정의)</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>"서비스"란 Splash가 제공하는 AI 기반 로고 디자인 플랫폼을 의미합니다.</li>
        <li>"이용자"란 본 약관에 따라 서비스를 이용하는 자를 의미합니다.</li>
        <li>"콘텐츠"란 서비스를 통해 생성된 로고 및 디자인 산출물을 의미합니다.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">제3조 (서비스 이용)</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>서비스는 Google 계정을 통한 인증 후 이용할 수 있습니다.</li>
        <li>무료 플랜의 경우 일일 생성 횟수 및 프로젝트 수에 제한이 있습니다.</li>
        <li>서비스를 통해 생성된 로고의 저작권은 이용자에게 귀속됩니다.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">제4조 (금지 행위)</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>서비스를 이용하여 타인의 상표권을 침해하는 행위</li>
        <li>자동화된 수단을 이용한 대량 생성 행위</li>
        <li>서비스의 정상적인 운영을 방해하는 행위</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">제5조 (면책)</h2>
      <p>Splash는 AI가 생성한 콘텐츠의 상표 등록 가능성이나 독창성을 보장하지 않습니다. 이용자는 생성된 로고의 상업적 사용에 대한 법적 검토를 스스로 수행해야 합니다.</p>
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      <p className="text-xs text-[var(--text-muted)]">최종 수정일: 2026년 4월 1일</p>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">1. 수집하는 개인정보</h2>
      <p>Splash는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Google 계정 정보 (이름, 이메일, 프로필 이미지)</li>
        <li>서비스 이용 기록 (프로젝트, 생성 이력, 채팅 내용)</li>
        <li>접속 로그 (IP 주소, 브라우저 정보, 접속 시간)</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">2. 개인정보 이용 목적</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>서비스 제공 및 계정 관리</li>
        <li>AI 모델 개선을 위한 익명화된 데이터 분석</li>
        <li>고객 지원 및 문의 응대</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">3. 개인정보 보관 기간</h2>
      <p>계정 삭제 요청 시 즉시 파기합니다. 단, 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">4. 제3자 제공</h2>
      <p>Splash는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외입니다:</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>법령에 의한 요청이 있는 경우</li>
        <li>서비스 제공에 필수적인 외부 서비스 연동 (Google OAuth, Vercel 호스팅)</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-[var(--text-primary)]">5. 문의</h2>
      <p>개인정보 관련 문의는 hello@usesplash.vercel.app으로 연락해주세요.</p>
    </>
  )
}
