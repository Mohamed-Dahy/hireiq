interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function MetricCard({ label, value, sub, accent }: MetricCardProps) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 ${accent ? 'border-primary-200 dark:border-primary-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}
