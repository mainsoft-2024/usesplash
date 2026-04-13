"use client"

type SpinnerProps = {
  size?: number
  color?: string
  className?: string
}

export function PulseSpinner({ size = 16, color = "#4CAF50", className }: SpinnerProps) {
  const barWidth = Math.max(2, Math.round(size / 5))
  const barHeight = Math.max(6, Math.round(size / 2.5))

  return (
    <div
      className={className}
      style={{ display: "inline-flex", gap: Math.max(2, Math.round(size / 8)), alignItems: "center", height: barHeight }}
      aria-label="loading"
    >
      <style>{`
        @keyframes splash-pulse-bar {
          0% { opacity: 1; }
          50% { opacity: 0.2; }
          100% { opacity: 1; }
        }
      `}</style>
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: 999,
            backgroundColor: color,
            animation: `splash-pulse-bar 1s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function MetroSpinner({ size = 42, color = "#4CAF50", className }: SpinnerProps) {
  const dot = Math.max(4, Math.round(size / 6))
  const orbit = Math.max(8, Math.round(size / 2.5))

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      aria-label="loading"
    >
      <style>{`
        @keyframes splash-metro-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {[0, 0.2, 0.4, 0.6].map((delay, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: dot,
            height: dot,
            borderRadius: "9999px",
            backgroundColor: color,
            transformOrigin: `center ${orbit}px`,
            animation: `splash-metro-rotate 1.2s linear infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function WaveSpinner({ size = 24, color = "#4CAF50", className }: SpinnerProps) {
  const barWidth = Math.max(2, Math.round(size / 8))
  const barHeight = Math.max(10, Math.round(size / 1.4))
  const gap = Math.max(2, Math.round(size / 10))

  return (
    <div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap, height: barHeight }}
      aria-label="loading"
    >
      <style>{`
        @keyframes splash-wave-bar {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: 999,
            backgroundColor: color,
            transformOrigin: "center bottom",
            animation: `splash-wave-bar 1s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function LoadingScreen({ text = "로딩 중..." }: { text?: string }) {
  return (
    <div className="h-screen w-full bg-[#0e0e0e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <MetroSpinner size={44} color="#4CAF50" />
        {text ? <p className="text-sm text-[#666]">{text}</p> : null}
      </div>
    </div>
  )
}
