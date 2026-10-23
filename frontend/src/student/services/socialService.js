import axios from 'axios'
import { SEED_WORLDS } from '../data/socialWorldThemes'

// Dedicated instance WITHOUT the studentApi 401-redirect interceptor.
// The backend is the single source of truth: every world answer, completion,
// unlock and the daily Explorer challenge is stored on the logged-in student's
// account. The world list has a seed fallback so the (public) World Explorer
// hub renders offline — but there is NO offline gameplay.

import { API_BASE_URL } from '../../config/apiConfig'

const socialApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

socialApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so pages can react instead of guess:
//   err.auth      -> session missing/expired   -> show Sign In
//   err.locked    -> world locked behind prev  -> show the message
//   err.notFound  -> no such world/question    -> show "not found"
//   err.network   -> backend unreachable       -> show "try again"
function socialError(error) {
  const status = error && error.response && error.response.status
  const payload = error && error.response && error.response.data
  if (status === 401) {
    const e = new Error('signin')
    e.auth = true
    return e
  }
  if (status === 403 && payload && payload.locked) {
    const e = new Error(payload.message || 'locked')
    e.locked = true
    e.message = payload.message || 'This world unlocks after you finish the one before it.'
    return e
  }
  if (status === 404) {
    const e = new Error('notfound')
    e.notFound = true
    return e
  }
  const e = new Error('network')
  e.network = true
  return e
}

function seedWorldView() {
  return (Array.isArray(SEED_WORLDS) ? SEED_WORLDS : []).map((w) => ({
    id: w.id,
    order: w.order,
    name: w.name,
    nameEn: w.nameEn,
    skills: w.skills || [],
    accent: w.accent,
    environment: w.environment,
    guideLine: w.guideLine || '',
    intro: w.intro,
    theme: { ...(w.theme || {}) },
    locked: false,
    solved: 0,
    total: 0,
    completed: false,
  }))
}

// ── Public world list ──────────────────────────────────────────────────────
// With a student token the backend annotates each world with that student's
// { solved, total, locked, completed } plus continueWorld / lastWorld.
export const getSocialWorlds = async () => {
  try {
    const res = await socialApi({ method: 'get', url: '/social/worlds', timeout: 6000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (root && Array.isArray(root.worlds)) {
      return {
        worlds: root.worlds,
        continueWorld: root.continueWorld || null,
        lastWorld: root.lastWorld || '',
      }
    }
    return { worlds: seedWorldView(), continueWorld: null, lastWorld: '' }
  } catch {
    // public browse: keep the hub alive if the API is unreachable
    return { worlds: seedWorldView(), continueWorld: null, lastWorld: '' }
  }
}

// ── Next question for a world (resumes where the student left off) ─────────
export const getSocialQuestion = async (world) => {
  try {
    const res = await socialApi({ method: 'get', url: `/social/${encodeURIComponent(world)}`, timeout: 8000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return {
      world: root.world,
      question: root.question,
      progress: root.progress || { solved: 0, total: 0 },
      level: root.level || 'easy',
    }
  } catch (error) {
    throw socialError(error)
  }
}

// ── Today's Explorer challenge ─────────────────────────────────────────────
export const getSocialDaily = async () => {
  try {
    const res = await socialApi({ method: 'get', url: '/social/daily', timeout: 8000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return { question: root.question, solved: Boolean(root.solved), attempts: root.attempts || 0 }
  } catch (error) {
    throw socialError(error)
  }
}

// ── Record an answer ───────────────────────────────────────────────────────
export const answerSocialQuestion = async (world, questionId, correct) => {
  try {
    const res = await socialApi({
      method: 'post',
      url: '/social/answer',
      data: { world, questionId, correct },
      timeout: 8000,
    })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    return root || { solved: Boolean(correct), completed: false, progress: { solved: 0, total: 0 } }
  } catch (error) {
    throw socialError(error)
  }
}

export default {
  getSocialWorlds,
  getSocialQuestion,
  getSocialDaily,
  answerSocialQuestion,
}