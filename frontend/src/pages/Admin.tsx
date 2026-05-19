import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Shield, Users, FileText, Briefcase, RefreshCw, Unlock, Trash2 } from 'lucide-react'
import MetricCard from '../components/MetricCard'
import { getAdminMetrics, getAdminUsers, setUserTier, toggleUserAdmin, unlockUser, adminDeleteUser } from '../api'
import type { AdminMetrics, AdminUserItem } from '../api'

const TIERS = ['free', 'pro', 'enterprise']

export default function Admin() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'users'>('overview')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchMetrics = () => {
    setLoading(true)
    getAdminMetrics()
      .then(r => setMetrics(r.data))
      .catch(() => setError('Failed to load metrics'))
      .finally(() => setLoading(false))
  }

  const fetchUsers = () => {
    setUsersLoading(true)
    getAdminUsers(0, 100)
      .then(r => setUsers(r.data.users))
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }

  useEffect(() => {
    fetchMetrics()
    fetchUsers()
  }, [])

  const handleTier = async (userId: number, tier: string) => {
    setActionLoading(userId)
    try {
      await setUserTier(userId, tier)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u))
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAdmin = async (userId: number, current: boolean) => {
    setActionLoading(userId)
    try {
      await toggleUserAdmin(userId, !current)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !current } : u))
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnlock = async (userId: number) => {
    setActionLoading(userId)
    try {
      await unlockUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, locked_until: null } : u))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId: number, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    setActionLoading(userId)
    try {
      await adminDeleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield size={20} strokeWidth={1.5} className="text-primary-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Admin Dashboard</h1>
        </div>
        <button
          onClick={() => { fetchMetrics(); fetchUsers() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} strokeWidth={1.75} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        {(['overview', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer capitalize ${
              tab === t
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          {error && (
            <div className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : metrics ? (
            <>
              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <MetricCard label="Total Users" value={metrics.users.total} sub={`+${metrics.users.new_this_week} this week`} accent />
                <MetricCard label="Free Users" value={metrics.users.free} />
                <MetricCard label="Paid Users" value={metrics.users.paid} />
                <MetricCard label="CV Sessions" value={metrics.cv_sessions.total} sub={`+${metrics.cv_sessions.this_week} this week`} />
                <MetricCard label="Avg Match Score" value={metrics.cv_sessions.avg_match_score != null ? `${metrics.cv_sessions.avg_match_score}%` : '—'} />
                <MetricCard label="Interviews" value={metrics.interviews.total} />
                <MetricCard label="Jobs Tracked" value={metrics.jobs.total} sub={`${metrics.jobs.active} active`} />
                <MetricCard label="Roadmaps" value={metrics.roadmaps.total} sub={`+${metrics.roadmaps.this_week} this week`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <MetricCard label="Referrals" value={metrics.referrals.total} sub={`${metrics.referrals.conversion_rate}% conversion`} />
                <MetricCard label="Converted Referrals" value={metrics.referrals.converted} />
                <MetricCard label="Bank Questions" value={metrics.interview_bank.total_questions} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Signup trend */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <Users size={14} strokeWidth={1.75} className="text-zinc-400" />
                    User Signups (last 30 days)
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={metrics.users.signup_trend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-zinc-900)', border: 'none', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#a1a1aa' }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Session trend */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <FileText size={14} strokeWidth={1.75} className="text-zinc-400" />
                    CV Sessions (last 30 days)
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={metrics.cv_sessions.trend}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-zinc-900)', border: 'none', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#a1a1aa' }}
                        itemStyle={{ color: '#14b8a6' }}
                      />
                      <Bar dataKey="count" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tier distribution + Job status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">Tier Distribution</p>
                  <div className="flex flex-col gap-2">
                    {metrics.users.tier_distribution.map(item => (
                      <div key={item.tier} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 w-16 capitalize">{item.tier}</span>
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-primary-500"
                            style={{ width: metrics.users.total ? `${(item.count / metrics.users.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 w-8 text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <Briefcase size={14} strokeWidth={1.75} className="text-zinc-400" />
                    Jobs by Status
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(metrics.jobs.by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 capitalize">{status.replace('_', ' ')}</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {usersLoading ? (
            <div className="p-6 text-sm text-zinc-400 dark:text-zinc-500">Loading users…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">User</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Tier</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Sessions</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Joined</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            {user.username}
                            {user.is_admin && (
                              <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">ADMIN</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 dark:text-zinc-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.tier}
                          disabled={actionLoading === user.id}
                          onChange={e => handleTier(user.id, e.target.value)}
                          className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{user.session_count}</td>
                      <td className="px-4 py-3">
                        {user.locked_until ? (
                          <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">LOCKED</span>
                        ) : user.email_verified ? (
                          <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">UNVERIFIED</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {user.locked_until && (
                            <button
                              onClick={() => handleUnlock(user.id)}
                              disabled={actionLoading === user.id}
                              title="Unlock account"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Unlock size={13} strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                            disabled={actionLoading === user.id}
                            title={user.is_admin ? 'Remove admin' : 'Make admin'}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                              user.is_admin
                                ? 'text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950'
                                : 'text-zinc-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950'
                            }`}
                          >
                            <Shield size={13} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.email)}
                            disabled={actionLoading === user.id}
                            title="Delete user"
                            className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 size={13} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="px-4 py-6 text-sm text-zinc-400 dark:text-zinc-500 text-center">No users found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
