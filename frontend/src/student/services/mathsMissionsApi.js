import axios from 'axios'
import { getStudentId } from './mathsMissionsService'

// Class 8 Maths Missions — the backend is the source of truth. Questions are
// fetched from the API, answers are validated server-side, hints and
// explanations come from dedicated endpoints, and progress is stored per
// logged-in student. The localStorage mirror (mathsMissionsService) is only
// used as a fallback identity key and for the legacy mission map page.

import { API_BASE_URL } from '../../config/apiConfig'

// Dedicated instance WITHOUT the studentApi 401-redirect interceptor
// (matches mathsService.js / scienceService.js).
const missionsApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
})

missionsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so the mission pages can react instead of guess:
//   err.auth     -> session missing/expired -> show Sign In
//   err.notFound -> no such topic/mission   -> show "not found"
//   err.network  -> backend unreachable     -> show "try again"
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
  const e = new Error('network')
  e.network = true
  if (payload && payload.message) e.message = payload.message
  return e
}

// ── Topic + mission journey ────────────────────────────────────────────────
export async function getMathsTopic(topicId) {
  try {
    const { data } = await missionsApi.get(`/maths/missions/topic/${topicId}`)
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

// ── Mission session (concept → example → graded steps) ────────────────────
export async function getMathsMissionSession(topic, mission) {
  try {
    const { data } = await missionsApi.get('/maths/missions/questions', {
      params: { topic, mission },
    })
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

// ── Answer submission (validated + scored on the server) ─────────────────
export async function submitMathsAnswer(questionId, answer, hintsUsed = 0) {
  try {
    const { data } = await missionsApi.post(`/maths/missions/${questionId}/answer`, {
      studentId: getStudentId() || undefined,
      answer,
      hintsUsed,
    })
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

// ── Hints (server decides hint 1 then hint 2) ─────────────────────────────
export async function getMathsHint(questionId) {
  try {
    const { data } = await missionsApi.post(`/maths/missions/${questionId}/hint`, {
      studentId: getStudentId() || undefined,
    })
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

// ── Explanation endpoint ───────────────────────────────────────────────────
export async function getMathsExplanation(questionId) {
  try {
    const { data } = await missionsApi.get(`/maths/missions/${questionId}/explanation`)
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

// ── Progress overview + reset ──────────────────────────────────────────────
export async function getMathsProgress() {
  try {
    const { data } = await missionsApi.get('/maths/missions/progress')
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}

export async function resetMathsProgress() {
  try {
    const { data } = await missionsApi.post('/maths/missions/progress/reset')
    return data.data
  } catch (err) {
    throw apiError(err)
  }
}