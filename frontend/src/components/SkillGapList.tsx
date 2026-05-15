interface Props {
  text: string
  loading: boolean
}

function renderLine(line: string, i: number) {
  const trimmed = line.trim()
  if (!trimmed) return <div key={i} className="h-3" />

  const boldified = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  const isHeading = /^#{1,3}\s/.test(trimmed) || (trimmed.endsWith(':') && trimmed.length < 60)
  if (isHeading) {
    const label = trimmed.replace(/^#{1,3}\s*/, '').replace(/:$/, '')
    return (
      <p key={i} className="font-medium text-zinc-900 dark:text-zinc-100 mt-4 mb-1 text-sm">
        {label}
      </p>
    )
  }

  const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/)
  if (numbered) {
    return (
      <div key={i} className="flex gap-2 mb-2">
        <span className="text-primary-500 font-medium text-sm min-w-[1.2rem]">{numbered[1]}.</span>
        <span
          className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: numbered[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>
    )
  }

  const bullet = trimmed.match(/^[-•*]\s+(.*)/)
  if (bullet) {
    return (
      <div key={i} className="flex gap-2 mb-1.5">
        <span className="text-primary-400 mt-0.5">•</span>
        <span
          className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bullet[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>
    )
  }

  return (
    <p
      key={i}
      className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed mb-1"
      dangerouslySetInnerHTML={{ __html: boldified }}
    />
  )
}

export default function SkillGapList({ text, loading }: Props) {
  if (!text && loading) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-5 min-h-[80px] flex items-center">
        <span className="animate-pulse text-zinc-400 text-sm">Analyzing your CV…</span>
      </div>
    )
  }

  const lines = text.split('\n')

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-5 text-left">
      {lines.map((line, i) => renderLine(line, i))}
      {loading && (
        <span className="inline-block w-1.5 h-4 bg-primary-400 animate-pulse rounded-sm ml-1 align-middle" />
      )}
    </div>
  )
}
