import { ImageResponse } from "next/og"

export const alt = "Splash — AI 로고 디자인"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 100%)",
          color: "#ffffff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -1,
            display: "flex",
            alignItems: "center",
          }}
        >
          Sp<span style={{ color: "#4CAF50" }}>lash</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#888888" }}>
          AI 채팅으로 로고를 디자인하세요
        </div>
      </div>
    ),
    { ...size }
  )
}
