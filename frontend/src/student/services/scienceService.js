import axios from 'axios'
import { SEED_WORLDS } from '../data/scienceWorldThemes'

// Dedicated instance WITHOUT the studentApi 401-redirect interceptor.
// The backend is the single source of truth: every world answer, completion,
// unlock, experiment run and the daily challenge is stored on the logged-in
// student's account. The world list has a seed fallback so the (public)
// Science Adventure hub renders offline — but there is NO offline gameplay.

import { API_BASE_URL } from '../../config/apiConfig'

const scienceApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

scienceApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so pages can react instead of guess:
//   err.auth      -> session missing/expired   -> show Sign In
//   err.locked    -> world locked behind prev  -> show the message
//   err.notFound  -> no such world/question    -> show "not found"
//   err.network   -> backend unreachable       -> show "try again"
function scienceError(error) {
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
    experiment: null,
    experimentDone: false,
    locked: false,
    solved: 0,
    total: 0,
    completed: false,
  }))
}

// ── Public world list ──────────────────────────────────────────────────────
export const getScienceWorlds = async () => {
  try {
    const res = await scienceApi({ method: 'get', url: '/science/worlds', timeout: 6000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (root && Array.isArray(root.worlds)) {
      return {
        worlds: root.worlds,
        continueWorld: root.continueWorld || null,
        lastWorld: root.lastWorld || '',
        stage: root.stage || 'explore',
      }
    }
    return { worlds: seedWorldView(), continueWorld: null, lastWorld: '', stage: 'explore' }
  } catch {
    // public browse: keep the hub alive if the API is unreachable
    return { worlds: seedWorldView(), continueWorld: null, lastWorld: '', stage: 'explore' }
  }
}

// ── Full world bundle (world + discoveries + experiment preview + question) ─
export const getScienceWorld = async (world) => {
  try {
    const res = await scienceApi({ method: 'get', url: `/science/${encodeURIComponent(world)}`, timeout: 10000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question || !root.world) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return {
      world: root.world,
      question: root.question,
      progress: root.progress || { completed: 0, total: 0 },
      level: root.level || 'easy',
      resumeStage: root.resumeStage || 'explore',
      experimentDone: Boolean(root.experimentDone),
    }
  } catch (error) {
    throw scienceError(error)
  }
}

// ── Today's Daily Science Challenge ────────────────────────────────────────
export const getScienceDaily = async () => {
  try {
    const res = await scienceApi({ method: 'get', url: '/science/daily', timeout: 10000 })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (!root || !root.question) {
      const e = new Error('notfound')
      e.notFound = true
      throw e
    }
    return { question: root.question, solved: Boolean(root.solved), attempts: root.attempts || 0 }
  } catch (error) {
    throw scienceError(error)
  }
}

// ── Validate + record the Daily Science Challenge ──────────────────────────
export const completeScienceDaily = async (questionId, pick) => {
  try {
    const res = await scienceApi({
      method: 'post',
      url: '/science/daily/complete',
      data: { questionId, pick },
      timeout: 8000,
    })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    return root || { correct: false, solved: false, hint: '', explanation: '', answer: null }
  } catch (error) {
    throw scienceError(error)
  }
}

// ── Record an answer (server validates) ────────────────────────────────────
export const answerScienceQuestion = async (world, questionId, pick) => {
  try {
    const res = await scienceApi({
      method: 'post',
      url: '/science/answer',
      data: { world, questionId, pick },
      timeout: 8000,
    })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    return (
      root || {
        correct: false,
        solved: false,
        completed: false,
        progress: { completed: 0, total: 0 },
        hint: '',
        explanation: '',
        answer: null,
      }
    )
  } catch (error) {
    throw scienceError(error)
  }
}

// ── Run an experiment prediction (server reveals outcomes) ────────────────
export const runScienceExperiment = async (world, pick) => {
  try {
    const res = await scienceApi({
      method: 'post',
      url: `/science/experiments/${encodeURIComponent(world)}/result`,
      data: { pick },
      timeout: 10000,
    })
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    return root || { correct: 0, total: 0, results: {}, observe: '', reveal: '', guide: '', followUp: '', alreadyRun: false }
  } catch (error) {
    throw scienceError(error)
  }
}

// ── Stage pointer (explore -> experiment -> play) for resume ───────────────
export const setScienceStage = async (world, stage) => {
  try {
    const res = await scienceApi({
      method: 'post',
      url: '/science/progress',
      data: { world, stage },
      timeout: 6000,
    })
    return res.data && res.data.data ? res.data.data : { world, stage }
  } catch (error) {
    throw scienceError(error)
  }
}

export const getScienceProgress = async () => {
  try {
    const res = await scienceApi({ method: 'get', url: '/science/progress', timeout: 6000 })
    return (res.data && res.data.data) || { continueWorld: null, lastWorld: '', stage: 'explore', resumeStage: 'explore' }
  } catch (error) {
    throw scienceError(error)
  }
}

export default {
  getScienceWorlds,
  getScienceWorld,
  getScienceDaily,
  completeScienceDaily,
  answerScienceQuestion,
  runScienceExperiment,
  setScienceStage,
  getScienceProgress,
}