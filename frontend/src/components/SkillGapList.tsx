interface Props {
  text: string
  loading: boolean
}

function renderLine(line: string, i: number) {
  const trimmed = line.trim()
  if (!trimmed) return <div key={i} className="h-3" />

  // Markdown bold: **text** or __text__
  const boldified = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Section heading: ends with colon OR is all-caps / starts with ##
  const isHeading = /^#{1,3}\s/.test(trimmed) || (trimmed.endsWith(':') && trimmed.length < 60)
  if (isHeading) {
    const label = trimmed.replace(/^#{1,3}\s*/, '').replace(/:$/, '')
    return (
      <p key={i} className="font-semibold text-gray-800 mt-4 mb-1 text-sm">
        {label}
      </p>
    )
  }

  // Numbered list: "1. " or "1) "
  const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/)
  if (numbered) {
    return (
      <div key={i} className="flex gap-2 mb-2">
        <span className="text-indigo-500 font-semibold text-sm min-w-[1.2rem]">{numbered[1]}.</span>
        <span
          className="text-gray-700 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: numbered[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>
    )
  }

  // Bullet: "- " or "• "
  const bullet = trimmed.match(/^[-•*]\s+(.*)/)
  if (bullet) {
    return (
      <div key={i} className="flex gap-2 mb-1.5">
        <span className="text-indigo-400 mt-0.5">•</span>
        <span
          className="text-gray-700 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bullet[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>
    )
  }

  // Plain text
  return (
    <p
      key={i}
      className="text-gray-700 text-sm leading-relaxed mb-1"
      dangerouslySetInnerHTML={{ __html: boldified }}
    />
  )
}

export default function SkillGapList({ text, loading }: Props) {
  if (!text && loading) {
    return (
      <div className="bg-gray-50 rounded-xl p-5 min-h-[80px] flex items-center">
        <span className="animate-pulse text-gray-400 text-sm">Analyzing your CV…</span>
      </div>
    )
  }

  const lines = text.split('\n')

  return (
    <div className="bg-gray-50 rounded-xl p-5 text-left">
      {lines.map((line, i) => renderLine(line, i))}
      {loading && (
        <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse rounded-sm ml-1 align-middle" />
      )}
    </div>
  )
}
