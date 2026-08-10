import { useEffect, useState, useCallback } from 'react'

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 inline-block" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchGrants, createGrant, lookupGrant } from '../api.js'
import ScoreBadge from '../components/ScoreBadge.jsx'
import { DorothyBadge, OutcomeBadge, UrgencyDot } from '../components/StatusBadge.jsx'

const EMPTY_FORM = {
  title: '', sponsor_org: '', amount: '', deadline: '',
  focus_area: '', eligibility_summary: '', website: '', discovery_source: 'manual',
}

function AddGrantModal({ onClose, onSaved }) {
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [looking, setLooking] = useState(false)
  const [lookMsg, setLookMsg] = useState('')
  const [err, setErr]         = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLookup = async () => {
    if (!form.title.trim()) { setErr('Enter a grant title to auto-fill'); return }
    setLooking(true); setLookMsg('Searching…'); setErr('')
    try {
      const found = await lookupGrant(form.title, form.sponsor_org, form.amount)
      const filled = Object.keys(found).filter(k => found[k] && !form[k])
      setForm(f => ({ ...f, ...found }))
      setLookMsg(filled.length ? `Filled: ${filled.join(', ')}` : 'No new fields found')
    } catch (e) {
      setLookMsg('')
      setErr('Lookup failed: ' + (e.message || 'unknown error'))
    }
    setLooking(false)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) { setErr('Title is required'); return }
    setSaving(true); setErr('')
    try {
      const grant = await createGrant(form)
      onSaved(grant)
    } catch (e) {
      setErr(e.message || 'Save failed')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold text-lg">Add Grant Manually</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Title + auto-fill row */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Grant / Program Title *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Verizon Digital Ready"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand"
              />
              <button type="button" onClick={handleLookup} disabled={looking}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs font-medium text-gray-300 whitespace-nowrap transition-colors">
                {looking ? <><Spinner /> Searching…</> : 'Auto-fill'}
              </button>
            </div>
            {lookMsg && <div className="text-xs text-green-400 mt-1">{lookMsg}</div>}
          </div>

          {[
            ['sponsor_org',  'Funder / Organization',            'text'],
            ['amount',       'Amount (e.g. $25,000)',            'text'],
            ['deadline',     'Deadline (MM/DD/YYYY or Rolling)', 'text'],
            ['website',      'Website URL',                      'url' ],
            ['focus_area',   'Focus Area',                       'text'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-gray-400 text-xs block mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand"
              />
            </div>
          ))}

          <div>
            <label className="text-gray-400 text-xs block mb-1">Eligibility Summary</label>
            <textarea
              rows={3}
              value={form.eligibility_summary}
              onChange={e => set('eligibility_summary', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand resize-none"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs block mb-1">Discovery Source</label>
            <select
              value={form.discovery_source}
              onChange={e => set('discovery_source', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand">
              <option value="manual">manual</option>
              <option value="ai-weekly-corporate">ai-weekly-corporate</option>
              <option value="ai-weekly-foundation">ai-weekly-foundation</option>
              <option value="grants.gov-api">grants.gov-api</option>
              <option value="cagrants-portal">cagrants-portal</option>
            </select>
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand hover:bg-brand/80 text-white py-2 rounded text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Grant'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const SOURCE_SHORT = {
  'ai-weekly-corporate':  'AI Corp',
  'ai-weekly-foundation': 'AI Found',
  'grants.gov-api':       'Grants.gov',
  'cagrants-portal':      'CA Grants',
  'manual':               'Manual',
}
function shortSource(s) { return SOURCE_SHORT[s] || (s?.length > 12 ? s.slice(0, 12) + '…' : s) || '—' }

const ROW_ACCENT = {
  pursue:   'border-l-2 border-l-green-700',
  review:   'border-l-2 border-l-yellow-700',
  assessed: 'border-l-2 border-l-gray-700',
}

const STATUSES = [
  { key: '',        label: 'All' },
  { key: 'pursue',  label: 'Pursue' },
  { key: 'review',  label: 'Review' },
  { key: 'new',     label: 'Unassessed' },
  { key: 'won',     label: 'Won' },
  { key: 'assessed',label: 'Assessed' },
]

export default function Pipeline() {
  const [params, setParams]     = useSearchParams()
  const [grants, setGrants]     = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [offset, setOffset]     = useState(0)
  const [showAdd, setShowAdd]   = useState(false)
  const navigate                = useNavigate()

  const status = params.get('status') || ''
  const search = params.get('search') || ''
  const sort   = params.get('sort')   || 'days_left'
  const LIMIT  = 100

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    try {
      const res = await fetchGrants({ status: status || undefined, search: search || undefined, sort, limit: LIMIT, offset: off })
      setGrants(off === 0 ? res.grants : g => [...g, ...res.grants])
      setTotal(res.total)
      setOffset(off)
    } catch {}
    setLoading(false)
  }, [status, search, sort])

  useEffect(() => { load(0) }, [load])

  const setFilter = (key, val) => {
    const p = new URLSearchParams(params)
    if (val) p.set(key, val); else p.delete(key)
    setParams(p)
  }

  const handleGrantSaved = (grant) => {
    setShowAdd(false)
    // prepend new grant and reload
    load(0)
  }

  return (
    <div className="p-4 max-w-full">
      {showAdd && <AddGrantModal onClose={() => setShowAdd(false)} onSaved={handleGrantSaved} />}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex gap-1 glass rounded-xl p-1">
          {STATUSES.map(s => (
            <button key={s.key}
              onClick={() => setFilter('status', s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === s.key
                  ? 'bg-teal/20 text-teal-light border border-teal/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setFilter('search', e.target.value)}
          placeholder="Search title / funder…"
          className="ml-auto glass rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-600 w-56 focus:outline-none focus:border-teal/50 bg-transparent"
        />
        <select
          value={sort}
          onChange={e => setFilter('sort', e.target.value)}
          className="glass rounded-xl px-2 py-1.5 text-sm text-slate-300 bg-transparent focus:outline-none">
          <option value="days_left" className="bg-slate-900">Deadline</option>
          <option value="score"     className="bg-slate-900">Score</option>
          <option value="updated"   className="bg-slate-900">Updated</option>
          <option value="date"      className="bg-slate-900">Discovered</option>
        </select>
        <span className="label-caps ml-1">{total} grants</span>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: '1px solid rgba(167,139,250,0.3)',
            boxShadow: '0 0 16px rgba(124,58,237,0.25)',
          }}>
          + Add Grant
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto glass rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 label-caps w-[420px]">Grant</th>
              <th className="text-left px-4 py-3 label-caps">Funder</th>
              <th className="text-left px-4 py-3 label-caps w-24">Amount</th>
              <th className="text-center px-4 py-3 label-caps">Score</th>
              <th className="text-center px-4 py-3 label-caps">Days</th>
              <th className="text-left px-4 py-3 label-caps">Source</th>
              <th className="text-left px-4 py-3 label-caps">Dorothy</th>
              <th className="text-left px-4 py-3 label-caps">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {grants.map(g => (
              <tr key={g.id}
                  onClick={() => navigate(`/grants/${g.id}`)}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-all ${ROW_ACCENT[g.dorothy_recommendation] || ''}`}>
                <td className="px-4 py-3 w-[420px]">
                  <div className="font-medium text-slate-100 truncate max-w-[400px]" title={g.title}>{g.title}</div>
                  <div className="text-xs text-slate-600 font-mono mt-0.5">{g.deadline}</div>
                </td>
                <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate" title={g.sponsor_org}>{g.sponsor_org || '—'}</td>
                <td className="px-4 py-3 w-24 truncate text-xs font-mono"
                    style={{ color: g.amount ? '#d97706' : '#475569' }}>{g.amount || '—'}</td>
                <td className="px-4 py-3 text-center"><ScoreBadge score={g.llc_score} /></td>
                <td className="px-4 py-3 text-center"><UrgencyDot days={g.days_left} /></td>
                <td className="px-4 py-3 text-xs text-slate-600 font-mono" title={g.discovery_source}>{shortSource(g.discovery_source)}</td>
                <td className="px-4 py-3"><DorothyBadge rec={g.dorothy_recommendation} /></td>
                <td className="px-4 py-3"><OutcomeBadge outcome={g.outcome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-gray-500 text-sm">
            <Spinner /> Loading…
          </div>
        )}
        {!loading && grants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm text-gray-500">Nothing here.</div>
            <div className="text-xs text-gray-600 mt-1">Try a different filter or run a discovery cycle.</div>
          </div>
        )}
      </div>

      {/* Load more */}
      {grants.length < total && !loading && (
        <div className="text-center mt-4">
          <button
            onClick={() => load(offset + LIMIT)}
            className="px-4 py-2 glass rounded-xl text-sm text-slate-300 hover:text-white transition-all">
            Load more ({total - grants.length} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
