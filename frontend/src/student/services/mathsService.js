import axios from 'axios'
import { seedMathsWorlds } from './mathsSeedData'

// Dedicated instance WITHOUT the studentApi 401-redirect interceptor.
// The backend is the single source of truth: every question, answer,
// completed status, resume position, unlock and daily challenge is stored on
// the logged-in student's account. The localStorage mirror is gone - the
// world list still has a seed fallback so the (public) map renders offline,
// but there is NO offline gameplay.

import { API_BASE_URL } from '../../config/apiConfig'

const mathsApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

mathsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so pages can react instead of guess:
//   err.auth      -> session missing/expired   -> show Sign In
//   err.locked    -> world locked behind prev  -> show the message
//   err.notFound  -> no such world/question    -> show "not found"
//   err.network   -> backend unreachable       -> show "try again"
function mathError(error) {
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
  return (Array.isArray(seedMathsWorlds) ? seedMathsWorlds : []).map((w) => ({
    id: w.id,
    order: w.order,
    name: w.name,
    nameEn: w.nameEn,
    skills: w.skills || [],
    accent: w.accent,
    environment: w.theme ? w.theme.environment : w.environment,
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
// { solved, total, locked, completed } plus continueTopic / lastTopic.
export const getMathsWorlds = async () => {
  try {
    const res = await mathsApi({ method: 'get', url: '/maths/worlds', timeout: 6000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (root && Array.isArray(root.worlds)) {
      return {
        worlds: root.worlds,
        continueTopic: root.continueTopic || null,
        lastTopic: root.lastTopic || '',
      }
    }
    return { worlds: seedWorldView(), continueTopic: null, lastTopic: '' }
  } catch {
    // public browse: keep the map alive if the API is unreachable
    return { worlds: seedWorldView(), continueTopic: null, lastTopic: '' }
  }
}

// ── Next question for a world (resumes where the student left off) ─────────
export const getMathsQuestion = async (topic) => {
  try {
    const res = await mathsApi({ method: 'get', url: `/maths/${encodeURIComponent(topic)}`, timeout: 8000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return {
      world: root.world,
      question: root.question,
      progress: root.progress || { completed: 0, total: 0 },
      level: root.level || 'easy',
    }
  } catch (error) {
    throw mathError(error)
  }
}

// ── Today's challenge ──────────────────────────────────────────────────────
export const getMathsDaily = async () => {
  try {
    const res = await mathsApi({ method: 'get', url: '/maths/daily', timeout: 8000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return { question: root.question, solved: Boolean(root.solved), attempts: root.attempts || 0 }
  } catch (error) {
    throw mathError(error)
  }
}

// ── Record an answer ───────────────────────────────────────────────────────
export const answerMathsQuestion = async (topic, questionId, correct) => {
  try {
    const res = await mathsApi({
      method: 'post',
      url: '/maths/answer',
      data: { topic, questionId, correct },
      timeout: 8000,
    })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    return root || { solved: Boolean(correct), completed: false, progress: { completed: 0, total: 0 } }
  } catch (error) {
    throw mathError(error)
  }
}

export default {
  getMathsWorlds,
  getMathsQuestion,
  getMathsDaily,
  answerMathsQuestion,
}