import { useState, useEffect } from 'react'
import { Clock, Zap } from 'lucide-react'
import type { QuickWin } from '../api'

interface Props {
  quickWins: QuickWin[]
  sessionId?: number
}

export default function QuickWinsCard({ quickWins, sessionId }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => {
    if (sessionId == null) return quickWins.map(() => false)
    try {
      return quickWins.map((_, i) =>
        localStorage.getItem(`qw_checked_${sessionId}_${i}`) === 'true'
      )
    } catch {
      return quickWins.map(() => false)
    }
  })

  useEffect(() => {
    if (sessionId == null) return
    checked.forEach((v, i) => {
      localStorage.setItem(`qw_checked_${sessionId}_${i}`, String(v))
    })
  }, [checked, sessionId])

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  const allDone = checked.every(Boolean) && checked.length > 0

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Zap size={16} strokeWidth={1.5} className="text-amber-500" />
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Quick Wins</h3>
      </div>

      {quickWins.map((w, i) => (
        <label
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <input
            type="checkbox"
            checked={checked[i] ?? false}
            onChange={() => toggle(i)}
            className="mt-0.5 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-violet-600 focus:ring-violet-500 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${checked[i] ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {w.action}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{w.why}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
            <Clock size={10} strokeWidth={1.5} />
            {w.time_required}
          </div>
        </label>
      ))}

      {allDone && (
        <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
          All done! 🎯
        </p>
      )}
    </div>
  )
}
