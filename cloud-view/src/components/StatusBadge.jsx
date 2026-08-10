const BADGE = {
  pursue:   'bg-pursue/20     text-pursue-light border border-pursue/40',
  review:   'bg-yellow-900/60 text-yellow-300   border border-yellow-700',
  assessed: 'bg-slate-800/80  text-slate-400    border border-slate-700',
  won:      'bg-emerald-900/60 text-emerald-300  border border-emerald-700',
  applied:  'bg-blue-900/60   text-blue-300     border border-blue-700',
  declined: 'bg-red-900/60    text-red-300      border border-red-700',
  skipped:  'bg-slate-800/80  text-slate-500    border border-slate-700',
  in_review:'bg-purple-900/60 text-purple-300   border border-purple-700',
}

export function DorothyBadge({ rec }) {
  if (!rec) return <span className="text-slate-600 text-xs italic">unassessed</span>
  const cls = BADGE[rec] || 'bg-slate-800 text-slate-300 border border-slate-700'
  const glowStyle = rec === 'pursue' ? { boxShadow: '0 0 10px rgba(217,119,6,0.35)' } : {}
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}
          style={glowStyle}>
      {rec}
    </span>
  )
}

export function OutcomeBadge({ outcome }) {
  if (!outcome) return null
  const cls = BADGE[outcome] || 'bg-slate-800 text-slate-300 border border-slate-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {outcome}
    </span>
  )
}

export function UrgencyDot({ days }) {
  if (days == null) return null
  if (days === -1)  return <span className="text-slate-500 text-xs">rolling</span>

  const { dot, text } =
    days <= 7  ? { dot: 'bg-red-500',    text: 'text-red-400'    } :
    days <= 14 ? { dot: 'bg-orange-500', text: 'text-orange-400' } :
    days <= 30 ? { dot: 'bg-yellow-500', text: 'text-yellow-400' } :
                 { dot: 'bg-emerald-500', text: 'text-emerald-400' }

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {days}d
    </span>
  )
}
