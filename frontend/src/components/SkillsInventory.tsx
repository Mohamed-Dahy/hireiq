interface SkillItem {
  skill: string
  category: 'hard' | 'soft' | string
  level: 'beginner' | 'intermediate' | 'advanced' | string
}

interface Props {
  skills: SkillItem[]
}

const LEVEL_COLORS: Record<string, string> = {
  beginner:     'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  intermediate: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  advanced:     'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
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
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => {
          const levelClass = LEVEL_COLORS[s.level] ?? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
          const dotClass = CATEGORY_DOT[s.category] ?? 'bg-zinc-400'
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
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Technical</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block"/>Soft skill</span>
      </div>
      {hard.length > 0 && renderGroup(hard, 'Technical Skills')}
      {soft.length > 0 && renderGroup(soft, 'Soft Skills')}
    </div>
  )
}
