interface RoadmapItem {
  topic: string
  priority: 'high' | 'medium' | 'low' | string
  estimated_hours: number
  resources: string[]
}

interface Props {
  roadmap: RoadmapItem[]
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   'border-violet-400 bg-violet-50',
  medium: 'border-amber-300 bg-amber-50',
  low:    'border-gray-200 bg-gray-50',
}

const NODE_COLOR: Record<string, string> = {
  high:   'bg-violet-500',
  medium: 'bg-amber-400',
  low:    'bg-gray-400',
}

export default function StudyRoadmap({ roadmap }: Props) {
  if (!roadmap.length) return null

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-4">
        {roadmap.map((item, i) => {
          const dotClass = NODE_COLOR[item.priority] ?? 'bg-gray-400'
          const cardClass = PRIORITY_COLOR[item.priority] ?? 'border-gray-200 bg-gray-50'

          return (
            <div key={i} className="relative">
              {/* Timeline dot */}
              <span className={`absolute -left-[18px] top-4 w-3 h-3 rounded-full ${dotClass} ring-2 ring-white`} />

              <div className={`border rounded-xl p-4 space-y-2 ${cardClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{item.topic}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    ~{item.estimated_hours}h
                  </span>
                </div>

                {item.resources.length > 0 && (
                  <ul className="space-y-0.5">
                    {item.resources.map((r, j) => (
                      <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="mt-0.5 text-purple-400">›</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
