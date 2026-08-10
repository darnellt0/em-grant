import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDashboard, runPipeline, READ_ONLY } from '../api.js'
import { DorothyBadge } from '../components/StatusBadge.jsx'
import ScoreBadge from '../components/ScoreBadge.jsx'

function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Trapezoid funnel stage
function FunnelStage({ label, value, total, gradient, onClick, delay = 0 }) {
  const maxVal  = total || 1
  const pct     = Math.max(Math.round((value / maxVal) * 100), value > 0 ? 10 : 5)
  const convPct = total > 0 ? Math.round((value / total) * 100) : 0
  const isPursue = label === 'Pursue'

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 ${onClick ? 'cursor-pointer group' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs text-slate-400 tabular-nums font-medium">{value ?? 0}</span>
      <div
        className="funnel-bar w-full rounded-sm transition-opacity group-hover:opacity-80"
        style={{
          height:     `${Math.max(pct * 1.2, 6)}px`,
          background: gradient,
          minHeight:  '6px',
          boxShadow:  isPursue ? '0 0 16px rgba(224,205,103,0.45)' : 'none',
        }}
      />
      <span className="label-caps text-center leading-tight">{label}</span>
      {total > 0 && value !== total && (
        <span className="text-[10px] text-slate-600 tabular-nums">{convPct}%</span>
      )}
    </div>
  )
}

function EmptyState({ icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="text-3xl mb-3 opacity-40">{icon}</div>
      <div className="text-sm text-slate-500">{message}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]       = useState(null)
  const [running, setRunning] = useState(false)
  const [err, setErr]         = useState(null)
  const navigate              = useNavigate()

  const load = () => fetchDashboard().then(setData).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  const handleRun = async () => {
    setRunning(true)
    try { await runPipeline() } catch {}
    setTimeout(load, 2000)
    setTimeout(() => setRunning(false), 5000)
  }

  if (err) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center glass rounded-2xl p-8">
        <div className="text-4xl mb-3 opacity-50">⚠</div>
        <div className="text-red-400 text-sm">{err}</div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Spinner className="w-8 h-8" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )

  const { stats, urgency, by_source, recent_pursue, last_run, pipeline_history } = data
  const assessed = (stats.total || 0) - (stats.new || 0)

  const FUNNEL = [
    { label: 'Discovered', value: stats.total,   gradient: 'linear-gradient(180deg, #3b82f6, #6366f1)' },
    { label: 'Assessed',   value: assessed,       gradient: 'linear-gradient(180deg, #6366f1, #8b5cf6)' },
    { label: 'Pursue',     value: stats.pursue,   gradient: 'linear-gradient(180deg, #E0CD67, #d4af37)',
      onClick: () => navigate('/pipeline?status=pursue') },
    { label: 'Applied',    value: stats.applied,  gradient: 'linear-gradient(180deg, #d97706, #ea580c)',
      onClick: () => navigate('/pipeline?status=applied') },
    { label: 'Won',        value: stats.won,      gradient: 'linear-gradient(180deg, #059669, #10b981)',
      onClick: () => navigate('/pipeline?status=won') },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Hero row ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="label-caps mb-1">
            {stats.pursue > 0 ? 'Active Pursuits' : 'Grant Intelligence'}
          </p>
          {stats.pursue > 0 ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-display gradient-text-pursue"
                      style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1 }}>
                  {stats.pursue}
                </span>
                <span className="text-slate-400 text-base font-medium">grants to pursue</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                from {stats.total} discovered · {stats.new} unassessed
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-display gradient-text"
                      style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1 }}>
                  {stats.total ?? 0}
                </span>
                <span className="text-slate-400 text-base font-medium">discovered</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {stats.new} unassessed · run pipeline to get Dorothy's picks
              </p>
            </>
          )}
          {last_run && (
            <p className="text-xs text-slate-600 mt-1 font-mono">
              Last run {last_run.run_date} · {last_run.source}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {urgency.critical > 0 && (
            <div
              onClick={() => navigate('/pipeline?status=pursue')}
              className="glass rounded-xl px-4 py-2.5 cursor-pointer hover:border-red-500/30 transition-all"
              style={{ boxShadow: '0 0 20px rgba(239,68,68,0.15)' }}
            >
              <div className="text-2xl font-bold tabular-nums text-red-400 leading-none">{urgency.critical}</div>
              <div className="label-caps text-red-500/70 mt-1">≤14 days</div>
            </div>
          )}
          {urgency.upcoming > 0 && (
            <div className="glass rounded-xl px-4 py-2.5">
              <div className="text-2xl font-bold tabular-nums text-amber-400 leading-none">{urgency.upcoming}</div>
              <div className="label-caps text-amber-500/70 mt-1">15–30 days</div>
            </div>
          )}
          {!READ_ONLY && (
            <button
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: running ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                border: '1px solid rgba(167,139,250,0.3)',
                boxShadow: running ? 'none' : '0 0 20px rgba(124,58,237,0.3)',
              }}
            >
              {running ? <><Spinner className="w-4 h-4" /> Running…</> : '⚡ Run Pipeline'}
            </button>
          )}
        </div>
      </div>

      {/* ── Pipeline funnel ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Pipeline Funnel</h2>
          <div className="gold-rule" />
          <div className="flex gap-5 text-xs text-slate-500">
            <span>Assessment rate:
              <span className="text-slate-300 font-medium ml-1">
                {stats.total ? Math.round((assessed / stats.total) * 100) : 0}%
              </span>
            </span>
            <span>Pursue rate:
              <span className="text-slate-300 font-medium ml-1">
                {stats.total ? Math.round(((stats.pursue || 0) / stats.total) * 100) : 0}%
              </span>
            </span>
            {(stats.pursue || 0) > 0 && (
              <span>Win rate:
                <span className="text-emerald-400 font-medium ml-1">
                  {Math.round(((stats.won || 0) / stats.pursue) * 100)}%
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 items-end" style={{ minHeight: '160px' }}>
          {FUNNEL.map((s, i) => (
            <FunnelStage key={s.label} {...s} total={stats.total} delay={i * 70} />
          ))}
        </div>
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Recent pursue */}
        <div
          className="glass rounded-2xl p-5 transition-all"
          style={recent_pursue.length > 0 ? {
            borderColor: 'rgba(217,119,6,0.35)',
            boxShadow: '0 0 28px rgba(217,119,6,0.12), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          } : {}}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Pursue Recommendations</h2>
            <div className="gold-rule" />
            {recent_pursue.length > 0 && (
              <button
                onClick={() => navigate('/pipeline?status=pursue')}
                className="text-xs text-pursue-light hover:text-white transition-colors"
              >
                View all →
              </button>
            )}
          </div>

          {recent_pursue.length === 0
            ? <EmptyState icon="⚡" message="Dorothy hasn't weighed in yet." sub="Run the pipeline to surface what's worth pursuing." />
            : <div className="space-y-1">
                {recent_pursue.map(g => (
                  <div
                    key={g.id}
                    onClick={() => navigate(`/grants/${g.id}`)}
                    className="flex items-start gap-3 cursor-pointer hover:bg-white/5 rounded-xl p-2.5 -mx-2 transition-all"
                  >
                    <ScoreBadge score={g.llc_score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate" title={g.title}>
                        <span className="w-1.5 h-1.5 rounded-full bg-pursue shrink-0" />
                        <span className="text-sm font-medium text-slate-100 truncate">{g.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5 ml-3" title={g.sponsor_org}>
                        {g.sponsor_org}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 font-mono ml-3">
                        {g.deadline} · {g.days_left === -1 ? 'rolling' : `${g.days_left}d left`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Sources + history */}
        <div className="flex flex-col gap-6">

          {/* Sources */}
          <div className="glass rounded-2xl p-5">
            <h2 style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Sources</h2>
            <div className="gold-rule" />
            {by_source.length === 0
              ? <EmptyState icon="📡" message="No grants discovered yet." />
              : <div className="space-y-3">
                  {(() => {
                    const max = Math.max(...by_source.map(s => s.count), 1)
                    return by_source.map((s, i) => {
                      const pct = Math.round((s.count / max) * 100)
                      const colors = ['#7c3aed', '#6366f1', '#3b82f6', '#0891b2', '#0d9488']
                      return (
                        <div key={s.source}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400 font-mono truncate max-w-[160px]" title={s.source}>
                              {s.source}
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums ml-2">{s.count}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full kpi-bar-fill"
                              style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                            />
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
            }
          </div>

          {/* Pipeline history */}
          <div className="glass rounded-2xl p-5">
            <h2 style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Pipeline History</h2>
            <div className="gold-rule" />
            {pipeline_history.length === 0
              ? <EmptyState icon="📋" message="No runs yet." sub='Click "Run Pipeline" to start.' />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Date', 'Source', 'Found', 'New', 'Pursue'].map(h => (
                        <th key={h} className={`py-1.5 label-caps text-left ${h !== 'Date' && h !== 'Source' ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline_history.map((r, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <td className="py-1.5 text-slate-500 tabular-nums font-mono">{r.run_date}</td>
                        <td className="py-1.5 text-slate-300 max-w-[80px] truncate" title={r.source}>{r.source}</td>
                        <td className="py-1.5 text-right text-slate-400 tabular-nums">{r.grants_found ?? '—'}</td>
                        <td className="py-1.5 text-right text-emerald-400 tabular-nums">{r.grants_new ?? '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.pursue_count > 0
                            ? <span className="text-pursue-light font-semibold">{r.pursue_count}</span>
                            : <span className="text-slate-600">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
