interface GapItem {
  skill: string
  importance: 'high' | 'medium' | 'low' | string
  reason: string
  resource: string
}

interface Props {
  gaps: GapItem[]
}

const IMPORTANCE_CONFIG: Record<string, { bar: string; badge: string; label: string }> = {
  high:   { bar: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-200',     label: 'High' },
  medium: { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Medium' },
  low:    { bar: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Low' },
}

const BAR_WIDTH: Record<string, string> = {
  high:   'w-full',
  medium: 'w-2/3',
  low:    'w-1/3',
}

export default function SkillGapChart({ gaps }: Props) {
  if (!gaps.length) return null

  return (
    <div className="space-y-3">
      {gaps.map((gap, i) => {
        const cfg = IMPORTANCE_CONFIG[gap.importance] ?? IMPORTANCE_CONFIG.low
        const barW = BAR_WIDTH[gap.importance] ?? 'w-1/3'
        return (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800">{gap.skill}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                {cfg.label} priority
              </span>
            </div>

            {/* Importance bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.bar} ${barW}`} />
            </div>

            <p className="text-xs text-gray-500">{gap.reason}</p>

            {gap.resource && (
              <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 shrink-0">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {gap.resource}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
