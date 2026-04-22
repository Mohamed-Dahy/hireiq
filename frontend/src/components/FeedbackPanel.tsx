interface ScoreBarProps {
  label: string
  value: number  // 0–10
}

function ScoreBar({ label, value }: ScoreBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{value}/10</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  transcript: string
  clarity: number
  relevance: number
  depth: number
  eyeContact: number  // 0–100 %
}

export default function FeedbackPanel({ transcript, clarity, relevance, depth, eyeContact }: Props) {
  return (
    <div className="space-y-4 text-left">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Transcript</p>
        <p className="text-sm text-gray-700">{transcript || '—'}</p>
      </div>
      <ScoreBar label="Clarity" value={clarity} />
      <ScoreBar label="Relevance" value={relevance} />
      <ScoreBar label="Depth" value={depth} />
      {eyeContact >= 0 && (
        <div className="flex justify-between text-sm text-gray-600">
          <span>Eye Contact</span>
          <span className="font-medium">{eyeContact}%</span>
        </div>
      )}
    </div>
  )
}
