import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchGrant, updateGrant, assessGrant, deleteGrant, rescoreGrant, analyzeOutcome, generatePitch, generateComponent, generateEmailTemplates } from '../api.js'
import ScoreBadge from '../components/ScoreBadge.jsx'
import { DorothyBadge, UrgencyDot } from '../components/StatusBadge.jsx'

const OUTCOMES = ['', 'applied', 'won', 'declined', 'skipped', 'in_review']
const COMPONENTS = [
  { key: 'executive',     label: 'Executive Summary' },
  { key: 'impact',        label: 'Impact Statement' },
  { key: 'budget',        label: 'Budget Narrative' },
  { key: 'sustainability',label: 'Sustainability Plan' },
  { key: 'team',          label: 'Team & Qualifications' },
]
const TABS = ['Assessment', 'Application', 'Email Templates']

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="mb-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-200 text-sm">{value}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 inline-block" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Simple markdown renderer — handles headers, bold, bullets, paragraphs
function MarkdownBlock({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^### /.test(line)) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-gray-200 mt-4 mb-1">{line.slice(4)}</h3>
      )
    } else if (/^## /.test(line)) {
      elements.push(
        <h2 key={i} className="text-base font-semibold text-white mt-5 mb-2 border-b border-gray-800 pb-1">{line.slice(3)}</h2>
      )
    } else if (/^# /.test(line)) {
      elements.push(
        <h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
      )
    } else if (/^[-*] /.test(line)) {
      // collect consecutive bullets
      const bullets = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        bullets.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-sm text-gray-300">
          {bullets.map((b, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100">$1</strong>') }} />
          ))}
        </ul>
      )
      continue
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100">$1</strong>') }}
        />
      )
    }
    i++
  }
  return <div className="space-y-0.5">{elements}</div>
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="text-xs text-gray-500 hover:text-white transition-colors ml-2">
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

export default function GrantDetail() {
  const { id }                    = useParams()
  const navigate                  = useNavigate()
  const [grant, setGrant]         = useState(null)
  const [loadErr, setLoadErr]     = useState(null)
  const [tab, setTab]             = useState('Assessment')

  // Assessment state
  const [assessErr, setAssessErr] = useState(null)
  const [assessing, setAssessing] = useState(false)

  // Application state
  const [appErr, setAppErr]       = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genComponent, setGenComponent] = useState(null)  // which component is being generated
  const [componentResults, setComponentResults] = useState({})

  // Email templates state
  const [emailErr, setEmailErr]   = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState(null)
  const [openEmail, setOpenEmail] = useState(null)

  // Rescore state
  const [rescoring, setRescoring] = useState(false)

  // Outcome state
  const [saving, setSaving]       = useState(false)
  const [outcome, setOutcome]     = useState('')
  const [outcomeNote, setNote]    = useState('')
  const [outcomeAmt, setAmt]      = useState('')
  const [saved, setSaved]         = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed]   = useState(false)

  const load = async () => {
    try {
      const g = await fetchGrant(id)
      setGrant(g)
      setOutcome(g.outcome || '')
      setNote(g.outcome_note || '')
      setAmt(g.outcome_amount || '')
    } catch (e) { setLoadErr(e.message) }
  }

  useEffect(() => { load() }, [id])

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${grant.title}"? This cannot be undone.`)) return
    try {
      await deleteGrant(id)
      navigate('/pipeline')
    } catch (e) { alert('Delete failed: ' + e.message) }
  }

  const handleRescore = async () => {
    setRescoring(true)
    try { await rescoreGrant(id); await load() } catch {}
    setRescoring(false)
  }

  const handleAssess = async () => {
    setAssessing(true); setAssessErr(null)
    try { await assessGrant(id); await load() } catch (e) { setAssessErr(e.message) }
    setAssessing(false)
  }

  const handleGeneratePitch = async () => {
    setGenerating(true); setAppErr(null)
    try { await generatePitch(id); await load() } catch (e) { setAppErr(e.message) }
    setGenerating(false)
  }

  const handleGenerateComponent = async (component) => {
    setGenComponent(component); setAppErr(null)
    try {
      const res = await generateComponent(id, component)
      setComponentResults(prev => ({ ...prev, [component]: res.text }))
    } catch (e) { setAppErr(e.message) }
    setGenComponent(null)
  }

  const handleEmailTemplates = async () => {
    setEmailLoading(true); setEmailErr(null)
    try {
      const res = await generateEmailTemplates(id)
      setEmailTemplates(res.templates)
    } catch (e) { setEmailErr(e.message) }
    setEmailLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateGrant(id, {
        outcome:        outcome || null,
        outcome_note:   outcomeNote || null,
        outcome_amount: outcomeAmt ? parseInt(outcomeAmt) : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Auto-trigger lesson analysis on won/declined if application exists
      if ((outcome === 'won' || outcome === 'declined') && grant.application_text) {
        setAnalyzing(true); setAnalyzed(false)
        try {
          await analyzeOutcome(id)
          setAnalyzed(true)
          setTimeout(() => setAnalyzed(false), 6000)
        } catch {}
        setAnalyzing(false)
      }
    } catch {}
    setSaving(false)
  }

  if (loadErr) return <div className="p-8 text-red-400">Error: {loadErr}</div>
  if (!grant)  return <div className="p-8 text-gray-400">Loading...</div>

  const { title, sponsor_org, amount, deadline, days_left, focus_area,
          eligibility_summary, website, discovery_source, discovery_date,
          llc_score, dorothy_recommendation, dorothy_assessment_date,
          dorothy_report_text, oc_status, application_text, application_date } = grant

  return (
    <div className="p-6 max-w-6xl mx-auto">

      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm mb-4 transition-colors">
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex flex-col items-center gap-1">
          <ScoreBadge score={llc_score} />
          <button onClick={handleRescore} disabled={rescoring}
            className="text-[10px] text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors whitespace-nowrap">
            {rescoring ? 're-scoring…' : 're-score'}
          </button>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
            <span>{sponsor_org}</span>
            {amount && <span className="text-green-400">{amount}</span>}
            <span>Deadline: {deadline} · <UrgencyDot days={days_left} /></span>
            <DorothyBadge rec={dorothy_recommendation} />
          </div>
          {oc_status && <div className="text-xs text-gray-500 mt-1">{oc_status}</div>}
        </div>
        <button onClick={handleDelete}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-950/30">
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left col */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="font-semibold text-gray-200 mb-4">Grant Info</h2>
            <Field label="Focus Area"  value={focus_area} />
            <Field label="Eligibility" value={eligibility_summary} />
            <Field label="Source"      value={discovery_source} />
            <Field label="Discovered"  value={discovery_date} />
            {website && (
              <div className="mt-3">
                <a href={website} target="_blank" rel="noopener noreferrer"
                   className="text-brand-light text-sm hover:underline">
                  View Grant →
                </a>
              </div>
            )}
          </div>

          {/* Outcome form */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="font-semibold text-gray-200 mb-4">Log Outcome</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Outcome</label>
                <select value={outcome} onChange={e => setOutcome(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
                  {OUTCOMES.map(o => <option key={o} value={o}>{o || '(none)'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Amount ($)</label>
                <input type="number" value={outcomeAmt} onChange={e => setAmt(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Note</label>
                <textarea value={outcomeNote} onChange={e => setNote(e.target.value)} rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand" />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 rounded text-sm font-medium transition-colors">
                {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Outcome'}
              </button>
              {analyzing && (
                <p className="text-xs text-gray-500 text-center animate-pulse">
                  Joy is extracting lessons from this outcome…
                </p>
              )}
              {analyzed && (
                <p className="text-xs text-green-500 text-center">
                  ✓ Lessons saved to grant_lessons.md
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right col — tabbed panel */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">

            {/* Tab bar */}
            <div className="flex gap-1 mb-5 border-b border-gray-800 pb-3">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    tab === t ? 'bg-brand text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* ── Assessment tab ── */}
            {tab === 'Assessment' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-300">
                    Dorothy's Assessment
                    {dorothy_assessment_date && <span className="text-xs text-gray-500 ml-2">— {dorothy_assessment_date}</span>}
                  </div>
                  <button onClick={handleAssess} disabled={assessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs font-medium transition-colors">
                    {assessing ? <><Spinner /> Asking Dorothy…</> : 'Ask Dorothy'}
                  </button>
                </div>
                {assessErr && <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-800 rounded text-red-400 text-xs">Assessment failed: {assessErr}</div>}
                {assessing && (
                  <div className="mb-3 px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg flex items-center gap-2 text-gray-400 text-xs">
                    <Spinner /> Dorothy is reviewing this grant — about 1 minute…
                  </div>
                )}
                {dorothy_report_text
                  ? <div className="overflow-y-auto max-h-[580px] pr-1"><MarkdownBlock text={dorothy_report_text} /></div>
                  : !assessing && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                      <div className="text-4xl mb-3">🎯</div>
                      <div className="text-sm">No assessment yet.</div>
                      <div className="text-xs mt-1">Click "Ask Dorothy" for an on-demand assessment.</div>
                    </div>
                  )
                }
              </>
            )}

            {/* ── Application tab ── */}
            {tab === 'Application' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-300">
                    Application Draft
                    {application_date && <span className="text-xs text-gray-500 ml-2">— generated {application_date}</span>}
                  </div>
                  <button onClick={handleGeneratePitch} disabled={generating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-dark disabled:opacity-50 rounded text-xs font-medium transition-colors">
                    {generating ? <><Spinner /> Generating…</> : application_text ? 'Regenerate Full Draft' : 'Generate Full Draft'}
                  </button>
                </div>
                {appErr && <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-800 rounded text-red-400 text-xs">{appErr}</div>}
                {generating && (
                  <div className="mb-3 px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg flex items-center gap-2 text-gray-400 text-xs">
                    <Spinner /> Generating 8-section application draft — about 2 minutes…
                  </div>
                )}

                {application_text
                  ? <div className="overflow-y-auto max-h-[400px] mb-5 pr-1"><MarkdownBlock text={application_text} /></div>
                  : !generating && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 mb-5">
                      <div className="text-3xl mb-2">📝</div>
                      <div className="text-sm">No draft yet.</div>
                      <div className="text-xs mt-1">Click "Generate Full Draft" for a complete 8-section application.</div>
                    </div>
                  )
                }

                {/* Individual components */}
                <div className="border-t border-gray-800 pt-4">
                  <div className="text-xs text-gray-500 mb-3">Generate individual sections:</div>
                  <div className="flex flex-wrap gap-2">
                    {COMPONENTS.map(c => (
                      <button key={c.key}
                        onClick={() => handleGenerateComponent(c.key)}
                        disabled={genComponent !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-xs transition-colors">
                        {genComponent === c.key ? <><Spinner /> Generating…</> : c.label}
                      </button>
                    ))}
                  </div>
                  {Object.entries(componentResults).map(([key, text]) => {
                    const comp = COMPONENTS.find(c => c.key === key)
                    return (
                      <div key={key} className="mt-4 bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-300">{comp?.label}</span>
                          <CopyButton text={text} />
                        </div>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{text}</pre>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Email Templates tab ── */}
            {tab === 'Email Templates' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-300">Grant Email Templates</div>
                  <button onClick={handleEmailTemplates} disabled={emailLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs font-medium transition-colors">
                    {emailLoading ? <><Spinner /> Generating…</> : emailTemplates ? 'Regenerate' : 'Generate Templates'}
                  </button>
                </div>
                {emailErr && <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-800 rounded text-red-400 text-xs">{emailErr}</div>}
                {emailLoading && (
                  <div className="mb-3 px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg flex items-center gap-2 text-gray-400 text-xs">
                    <Spinner /> Generating 5 email templates — about 2 minutes…
                  </div>
                )}
                {!emailTemplates && !emailLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                    <div className="text-3xl mb-2">✉️</div>
                    <div className="text-sm">No templates yet.</div>
                    <div className="text-xs mt-1">Generates 5 emails: inquiry, follow-up, thank you, feedback request, acceptance.</div>
                  </div>
                )}
                {emailTemplates && (
                  <div className="space-y-3 overflow-y-auto max-h-[560px]">
                    {Object.entries(emailTemplates).map(([key, t]) => (
                      <div key={key} className="bg-gray-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setOpenEmail(openEmail === key ? null : key)}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors">
                          <span>{t.description}</span>
                          <span className="text-gray-500 text-xs">{openEmail === key ? '▲' : '▼'}</span>
                        </button>
                        {openEmail === key && (
                          <div className="px-4 pb-4">
                            <div className="flex justify-end mb-2"><CopyButton text={t.text} /></div>
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{t.text}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
