import type { Metadata } from "next"

export const metadata: Metadata = { title: "소개" }

export default function AboutPage() {
  return (
    <div className="bg-[var(--bg-primary)]">
      <article className="mx-auto max-w-[65ch] px-6 py-24">
        <h1 className="text-4xl font-bold md:text-5xl">왜 Splash를 만들었는가</h1>
        <p className="mt-6 text-lg leading-relaxed text-[var(--text-secondary)]">
          좋은 로고는 비싸고, 디자인 툴은 어렵습니다. 우리는 이 문제를 AI로 해결하고 싶었습니다.
        </p>

        <div className="my-12 border-l-2 border-[var(--accent-green)] pl-6">
          <p className="text-xl font-medium italic leading-relaxed">
            "모든 브랜드는 시각적 정체성을 가질 자격이 있습니다. 예산이나 디자인 경험과 관계없이."
          </p>
        </div>

        <h2 className="mt-16 text-2xl font-semibold">디자인의 민주화</h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
          Splash는 AI와의 자연어 대화를 통해 누구나 전문가 수준의 로고를 만들 수 있도록 설계되었습니다.
          복잡한 레이어, 벡터 도구, 색상 이론을 몰라도 됩니다. 당신의 브랜드가 무엇인지 말해주기만 하면,
          AI가 시각적으로 표현해 드립니다.
        </p>

        <h2 className="mt-16 text-2xl font-semibold">어떻게 다른가요?</h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
          기존의 로고 생성기는 템플릿에 텍스트를 넣는 수준이었습니다. Splash는 다릅니다.
          AI가 브랜드의 맥락을 이해하고, 대화를 통해 디자인을 발전시킵니다.
          한 번의 생성으로 끝나는 것이 아니라, 피드백을 반영한 반복적 수정이 가능합니다.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <p className="text-3xl font-bold text-[var(--accent-green)]">AI</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Google Gemini 기반 이미지 생성</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <p className="text-3xl font-bold text-[var(--accent-green)]">대화형</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">자연어로 디자인 요구사항 전달</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <p className="text-3xl font-bold text-[var(--accent-green)]">반복</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">피드백 기반 수정과 버전 관리</p>
          </div>
        </div>

        <h2 className="mt-16 text-2xl font-semibold">우리의 비전</h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
          Splash는 로고에서 시작하지만, 궁극적으로는 모든 시각적 브랜딩을 AI와 함께 만들어가는
          크리에이티브 스튜디오를 지향합니다. 명함, 소셜 미디어 에셋, 브랜드 가이드라인까지 —
          AI가 당신의 브랜드를 일관되게 표현할 수 있도록 돕겠습니다.
        </p>
      </article>
    </div>
  )
}
