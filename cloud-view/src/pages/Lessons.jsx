import { useEffect, useState } from 'react'
import { fetchLessons, saveLessons } from '../api.js'

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function Lessons() {
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    fetchLessons()
      .then(text => { setContent(text); setOriginal(text) })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      await saveLessons(content)
      setOriginal(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  const isDirty = content !== original

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Grant Lessons</h1>
          <p className="text-xs text-gray-500 mt-1">
            Curated patterns + auto-appended win/decline analyses. Joy and Dorothy read this on every run.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && !saving && (
            <span className="text-xs text-yellow-500">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-2 bg-brand hover:bg-brand/80 disabled:opacity-40 text-white rounded text-sm font-medium transition-colors">
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-800 rounded text-red-400 text-sm">
          {err}
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-1">
        {loading
          ? <div className="flex items-center justify-center gap-2 p-6 text-gray-500 text-sm"><Spinner /> Loading…</div>
          : <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              className="w-full h-[calc(100vh-220px)] bg-transparent text-gray-200 text-sm font-mono p-4 resize-none focus:outline-none leading-relaxed"
            />
        }
      </div>

      <p className="text-xs text-gray-600 mt-2">
        File: ~/.openclaw/workspace/vault/grants/grant_lessons.md
        · Auto-updated after each won/declined outcome analysis
      </p>
    </div>
  )
}
