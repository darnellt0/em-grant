import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard  from './pages/Dashboard.jsx'
import Pipeline   from './pages/Pipeline.jsx'
import GrantDetail from './pages/GrantDetail.jsx'
import Lessons    from './pages/Lessons.jsx'
import { fetchMeta, LIVE_APP_URL } from './api.js'

function syncAge(syncedAt) {
  if (!syncedAt) return null
  const t = Date.parse(syncedAt.replace(' UTC', 'Z').replace(' ', 'T'))
  if (Number.isNaN(t)) return syncedAt
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 90) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 36) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function Nav() {
  const [meta, setMeta] = useState(null)
  useEffect(() => { fetchMeta().then(setMeta).catch(() => {}) }, [])
  const age = syncAge(meta?.synced_at)

  const cls = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
      isActive
        ? 'bg-teal/20 text-teal-light border border-teal/30'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`
  return (
    <nav className="sticky top-0 z-40 flex items-center gap-1 px-6 py-3 border-b border-white/[0.06]"
         style={{ background: 'rgba(54,1,63,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-2.5 mr-8">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
             style={{ background: 'rgba(23,97,97,0.3)', border: '1px solid rgba(30,138,138,0.4)' }}>
          <span className="text-teal-light text-sm leading-none">⚡</span>
        </div>
        <span className="font-semibold text-white text-sm tracking-wide">EM Grants</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(224,205,103,0.12)', color: '#e0cd67', border: '1px solid rgba(224,205,103,0.3)' }}>
          Cloud View · Read-only
        </span>
      </div>
      <NavLink to="/"         end className={cls}>Dashboard</NavLink>
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
      <NavLink to="/lessons"  className={cls}>Lessons</NavLink>
      <div className="ml-auto flex items-center gap-3">
        {age && (
          <span className="text-[11px] text-slate-500 font-mono" title={meta?.synced_at}>
            data synced {age}
          </span>
        )}
        <a href={LIVE_APP_URL} target="_blank" rel="noreferrer"
           className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
           style={{ background: 'rgba(23,97,97,0.25)', color: '#5eead4', border: '1px solid rgba(30,138,138,0.4)' }}>
          Open live app ↗
        </a>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Nav />
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/pipeline"    element={<Pipeline />} />
          <Route path="/grants/:id"  element={<GrantDetail />} />
          <Route path="/lessons"     element={<Lessons />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
