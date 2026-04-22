import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface Props {
  score: number
}

export default function ScoreGauge({ score }: Props) {
  const reduced = useReducedMotion()
  const [displayed, setDisplayed] = useState(reduced ? score : 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const filled = (displayed / 100) * circumference
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  // Animate the number counting up
  useEffect(() => {
    if (reduced) return
    let frame: number
    const start = performance.now()
    const duration = 900

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayed(Math.round(eased * score))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score, reduced])

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        {/* Fill — CSS transition handles smooth draw */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: reduced ? 'none' : 'stroke-dasharray 0.05s linear' }}
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central"
          fontSize="22" fontWeight="700" fill={color}>
          {displayed}%
        </text>
      </svg>
      <p className="text-sm text-gray-500 font-medium">Match Score</p>
    </div>
  )
}
