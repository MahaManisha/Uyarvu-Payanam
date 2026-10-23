import axios from 'axios'
import { seedAdhikarams, findSeedAdhikaram } from './adhikaramSeedData'

// Dedicated instance WITHOUT the 401-redirect interceptor used by studentApi:
// if the student is not logged in (demo/browse mode) we gracefully fall back
// to the seeded mirror instead of hard-redirecting to /student/signin.
import { API_BASE_URL } from '../../config/apiConfig'

const adhikaramApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
})

adhikaramApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let liveMode = true
export const isAdhikaramLive = () => liveMode

async function call(path, fallback) {
  try {
    const res = await adhikaramApi({ method: 'get', url: path, timeout: 6000 })
    liveMode = true
    return res.data?.adhikarams ?? res.data?.adhikaram ?? fallback
  } catch {
    liveMode = false
    return fallback
  }
}

// ── Adhikaram Cartoon Theme System ──────────────────────────
// The backend list endpoint returns summary fields (id/number/names/section/
// accent/environment). The picker also needs intro + theme.palette, so we
// enrich each item from the seed mirror whenever those are missing.
function enrichList(list) {
  return (list || []).map((item) => {
    if (item.theme && item.intro) return item
    const full = findSeedAdhikaram(item.id)
    if (!full) return item
    return { ...item, intro: item.intro || full.intro, theme: item.theme || full.theme }
  })
}

export const getAdhikaramList = async () => {
  const list = await call('/tamil/adhikarams', seedAdhikarams)
  return Array.isArray(list) ? enrichList(list) : list
}

export const getAdhikaram = (id) => call(`/tamil/adhikarams/${encodeURIComponent(id)}`, findSeedAdhikaram(id))

export default {
  getAdhikaramList,
  getAdhikaram,
  isAdhikaramLive,
}