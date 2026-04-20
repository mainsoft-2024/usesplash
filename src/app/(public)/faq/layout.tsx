import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "Splash 이용에 대한 자주 묻는 질문과 답변. 요금제, 로고 생성, 계정 관련 궁금증을 해결하세요.",
  alternates: { canonical: "https://usesplash.vercel.app/faq" },
  openGraph: {
    title: "자주 묻는 질문 | Splash",
    description: "Splash 이용에 대한 자주 묻는 질문과 답변.",
    url: "https://usesplash.vercel.app/faq",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Splash는 무엇인가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Splash는 AI와의 대화를 통해 로고를 생성하고 수정할 수 있는 디자인 플랫폼입니다.",
      },
    },
    {
      "@type": "Question",
      name: "어떤 AI 기술을 사용하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Google Gemini 기반의 이미지 생성 AI와 대화형 AI를 결합하여 사용합니다.",
      },
    },
    {
      "@type": "Question",
      name: "무료 플랜으로 무엇을 할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "무료 플랜에서는 3개의 프로젝트를 만들고, 하루 10회의 로고 생성이 가능합니다.",
      },
    },
    {
      "@type": "Question",
      name: "Pro 플랜으로 업그레이드하면 무엇이 달라지나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "무제한 프로젝트, 하루 100회 생성, 고해상도 출력 등의 프리미엄 기능을 이용할 수 있습니다. SVG 변환·배경 제거는 출시 예정입니다.",
      },
    },
    {
      "@type": "Question",
      name: "한 번에 몇 개의 시안을 받을 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "한 번의 요청으로 최대 5개의 시안을 동시에 생성할 수 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "생성된 로고를 수정할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네, 자연어로 수정 요청을 할 수 있습니다. 수정본은 버전으로 관리됩니다.",
      },
    },
  ],
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  )
}