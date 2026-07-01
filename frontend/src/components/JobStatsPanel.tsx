import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { JobStatsResponse } from '../api'

interface Props {
  stats: JobStatsResponse
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  )
}

const FUNNEL_STAGES = ['saved', 'applied', 'phone_screen', 'technical', 'final_round', 'offer', 'accepted']

export default function JobStatsPanel({ stats }: Props) {
  const pct = (v: number) => `${Math.round(v * 100)}%`

  const funnelData = FUNNEL_STAGES.map(s => ({
    stage: s.replace('_', ' '),
    count: stats.by_status[s] ?? 0,
  }))

  const sourceData = Object.entries(stats.by_source).map(([source, count]) => ({ source, count }))

  return (
    <div className="space-y-6">
      {stats.stale_count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
          ⚠ {stats.stale_count} stale application{stats.stale_count !== 1 ? 's' : ''} — no activity in 14+ days
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Active Applications" value={String(stats.total_active)} />
        <MetricCard label="Response Rate" value={pct(stats.response_rate)} sub="applied → screened" />
        <MetricCard label="Interview Rate" value={pct(stats.interview_rate)} sub="applied → technical" />
        <MetricCard label="Offer Rate" value={pct(stats.offer_rate)} sub="applied → offer" />
      </div>

      {funnelData.some(d => d.count > 0) && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Application Funnel</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={funnelData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sourceData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">By Source</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={sourceData} layout="vertical" margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
