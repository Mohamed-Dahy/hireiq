import { TrendingUp, Zap, Building2 } from 'lucide-react'
import type { CareerInsight } from '../api'

interface Props {
  insight: CareerInsight
}

const DEMAND_COLORS: Record<string, string> = {
  high: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  low: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
}

export default function CareerInsightCard({ insight }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} strokeWidth={1.5} className="text-primary-500" />
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Market Intelligence</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
          <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-1">Local</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{insight.salary_range_local}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
          <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-1">Remote</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{insight.salary_range_remote}</p>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${DEMAND_COLORS[insight.market_demand] ?? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
        <span>Market Demand: {insight.market_demand.charAt(0).toUpperCase() + insight.market_demand.slice(1)}</span>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={12} strokeWidth={1.5} className="text-zinc-400" />
          <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">Hot Skills</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {insight.hot_skills.map((s) => (
            <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 size={12} strokeWidth={1.5} className="text-zinc-400" />
          <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">Top Companies</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {insight.top_companies.map((c) => (
            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
