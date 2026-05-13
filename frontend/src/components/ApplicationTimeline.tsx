import type { ActivityResponse } from '../api'

const EVENT_ICONS: Record<string, string> = {
  status_change:       '→',
  email_sent:          '✉',
  call_made:           '📞',
  interview_scheduled: '📅',
  note_added:          '📝',
  follow_up_sent:      '🔄',
  offer_received:      '💰',
}

interface Props {
  activities: ActivityResponse[]
}

export default function ApplicationTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <p className="text-xs text-zinc-400 text-center py-6">No activity logged yet</p>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((a, i) => (
        <div key={a.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-sm shrink-0">
              {EVENT_ICONS[a.event_type] ?? '•'}
            </div>
            {i < activities.length - 1 && (
              <div className="w-px flex-1 bg-zinc-100 dark:bg-zinc-800 mt-1" />
            )}
          </div>
          <div className="pb-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                {a.event_type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-zinc-400">{a.event_date}</span>
            </div>
            {a.notes && <p className="text-xs text-zinc-500 mt-0.5">{a.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
