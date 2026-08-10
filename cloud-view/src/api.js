// api.js — cloud-view edition. Read endpoints proxy to the grant-view-api
// Supabase Edge Function (which reads the app_* mirror tables). Write and
// AI actions are disabled: this is the Phase A read-only view; the live app
// at grants.elevatedmovements.com (laptop) owns all mutations.

const BASE  = import.meta.env.VITE_API_BASE
  || 'https://idebrliatulbriuitmuy.supabase.co/functions/v1/grant-view-api'
const ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const TOKEN = import.meta.env.VITE_VIEW_TOKEN || ''

export const READ_ONLY = true
export const LIVE_APP_URL = 'https://grants.elevatedmovements.com'

const HEADERS = {
  'Authorization': `Bearer ${ANON}`,
  'apikey': ANON,
  'x-view-token': TOKEN,
}

export async function apiFetch(path, { asText = false } = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: HEADERS })
  if (!r.ok) {
    let detail = await r.text()
    try { detail = JSON.parse(detail).detail || detail } catch { /* keep text */ }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return asText ? r.text() : r.json()
}

function readOnly() {
  const msg = `Read-only cloud view — open the live app (${LIVE_APP_URL}) to make changes.`
  window.alert(msg)
  throw new Error(msg)
}

// ── Reads ────────────────────────────────────────────────────────────
export function fetchDashboard()       { return apiFetch('/dashboard') }
export function fetchGrant(id)         { return apiFetch(`/grants/${id}`) }
export function fetchPipelineStatus()  { return apiFetch('/pipeline/status') }
export function fetchPipelineHistory() { return apiFetch('/pipeline/history') }
export function fetchLessons()         { return apiFetch('/lessons', { asText: true }) }
export function fetchMeta()            { return apiFetch('/meta') }

export function fetchGrants(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v != null && q.set(k, v))
  return apiFetch(`/grants?${q}`)
}

// ── Writes / AI — disabled in the cloud view ─────────────────────────
export function createGrant()             { return readOnly() }
export function updateGrant()             { return readOnly() }
export function deleteGrant()             { return readOnly() }
export function rescoreGrant()            { return readOnly() }
export function lookupGrant()             { return readOnly() }
export function assessGrant()             { return readOnly() }
export function runPipeline()             { return readOnly() }
export function analyzeOutcome()          { return readOnly() }
export function generatePitch()           { return readOnly() }
export function generateComponent()       { return readOnly() }
export function generateEmailTemplates()  { return readOnly() }
export function saveLessons()             { return readOnly() }
