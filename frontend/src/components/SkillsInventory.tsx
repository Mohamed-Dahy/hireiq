interface SkillItem {
  skill: string
  category: 'hard' | 'soft' | string
  level: 'beginner' | 'intermediate' | 'advanced' | string
}

interface Props {
  skills: SkillItem[]
}

const LEVEL_COLORS: Record<string, string> = {
  beginner:     'bg-blue-50 text-blue-700 border-blue-200',
  intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  advanced:     'bg-green-50 text-green-700 border-green-200',
}

const CATEGORY_DOT: Record<string, string> = {
  hard: 'bg-violet-500',
  soft: 'bg-pink-400',
}

export default function SkillsInventory({ skills }: Props) {
  if (!skills.length) return null

  const hard = skills.filter((s) => s.category === 'hard')
  const soft = skills.filter((s) => s.category === 'soft')

  const renderGroup = (items: SkillItem[], label: string) => (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => {
          const levelClass = LEVEL_COLORS[s.level] ?? 'bg-gray-50 text-gray-600 border-gray-200'
          const dotClass = CATEGORY_DOT[s.category] ?? 'bg-gray-400'
          return (
            <span
              key={s.skill}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${levelClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
              {s.skill}
              <span className="opacity-60 ml-0.5">{s.level}</span>
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Technical</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block"/>Soft skill</span>
      </div>
      {hard.length > 0 && renderGroup(hard, 'Technical Skills')}
      {soft.length > 0 && renderGroup(soft, 'Soft Skills')}
    </div>
  )
}
