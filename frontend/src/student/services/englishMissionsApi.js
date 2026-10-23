import axios from 'axios'

// Class 8 English Space Explorer — the backend is the source of truth.
// Lessons, activities and progress come from the API; activity answers are
// validated server-side; the AI assessment set is generated server-side and
// the answer key is never returned to the browser until after submission.

import { API_BASE_URL } from '../../config/apiConfig'

const emApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

emApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so the pages can react instead of guess:
//   err.auth    -> session missing/expired -> Sign In CTA
//   err.notFound-> no such area/topic      -> "not found" state
//   err.locked  -> unlock gating violated  -> show why
//   err.ai      -> AI service failed       -> show retry message
//   err.network -> backend unreachable     -> show "try again"
function apiError(error) {
  const status = error && error.response && error.response.status
  const payload = error && error.response && error.response.data
  if (status === 401) {
    const e = new Error('signin')
    e.auth = true
    return e
  }
  if (status === 404) {
    const e = new Error(payload && payload.message ? payload.message : 'notfound')
    e.notFound = true
    return e
  }
  if (status === 403) {
    const e = new Error(payload && payload.message ? payload.message : 'locked')
    e.locked = true
    return e
  }
  if (status === 400 || status === 502) {
    const e = new Error(payload && payload.message ? payload.message : 'request')
    if (payload && payload.ai) e.ai = true
    if (status === 400) e.validation = true
    return e
  }
  const e = new Error('network')
  e.network = true
  if (payload && payload.message) e.message = payload.message
  return e
}

async function get(url) {
  try {
    const res = await emApi.get(url)
    return res.data
  } catch (err) {
    throw apiError(err)
  }
}

async function post(url, body, timeout) {
  try {
    const res = await emApi.post(url, body, timeout ? { timeout } : undefined)
    return res.data
  } catch (err) {
    throw apiError(err)
  }
}

export const englishMissionsApi = {
  // Module overview: 6 areas + per-topic state + continue-learning target
  listAreas: () => get('/english-missions/areas'),

  // One area with its topic journey
  getArea: (areaId) => get(`/english-missions/areas/${areaId}`),

  // Lesson + activities (answers stripped) + progress + assessment status
  getTopic: (topicId) => get(`/english-missions/topics/${topicId}`),

  // Validate activity answers server-side (returns per-item feedback)
  answerActivity: (topicId, activityId, answer) =>
    post(`/english-missions/topics/${topicId}/activities/${activityId}/answer`, { answer }),

  // Start the AI assessment (lock-gated; returns questions WITHOUT answers).
  // Generation is adaptive top-up (up to 4 LLM calls, 25s each) — allow ~2.5m.
  startAssessment: (topicId) =>
    post(`/english-missions/topics/${topicId}/assessment/start`, {}, 160000),

  // Submit answers -> server grades against the stored set
  submitAssessment: (assessmentId, answers) =>
    post(`/english-missions/assessments/${assessmentId}/submit`, { answers }),

  // Dashboard-style progress overview
  getProgress: () => get('/english-missions/progress'),

  // Rubric-based AI guidance on a writing practice draft (guidance, not a grade)
  writingFeedback: (topicId, text) =>
    post(`/english-missions/topics/${topicId}/writing/feedback`, { text }, 120000),
}