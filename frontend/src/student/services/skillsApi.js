import axios from 'axios'

// Class 8 Skill Adventure — the backend is the source of truth. Activity
// answer keys never reach the browser; the server grades every answer, enforces
// level unlocks, records milestones and drives the LD-NBSE recommendation.

import { API_BASE_URL } from '../../config/apiConfig'

const skillsApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

skillsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Uniform error envelope so pages can react instead of guess:
//   err.auth      -> session missing/expired
//   err.notFound  -> no such category/activity/attempt
//   err.locked    -> level still locked
//   err.incomplete-> finish every part first
//   err.hintLimit -> no hints left
//   err.network   -> backend unreachable
function unpack(err) {
  const e = new Error('skills-api-error')
  e.network = !err.response
  e.auth = err.response?.status === 401
  const data = err.response?.data || {}
  e.status = err.response?.status
  e.code = data.code || null
  e.message = data.message || (e.network ? 'Network problem — check your connection.' : 'Something went wrong. Try again.')
  e.rateLimited = !!data.rateLimited
  return e
}

export const getDashboard = () => skillsApi.get('/class8-skills/dashboard').then((r) => r.data).catch((e) => { throw unpack(e) })
export const getCategories = () => skillsApi.get('/class8-skills/categories').then((r) => r.data).catch((e) => { throw unpack(e) })
export const getCategory = (skillId) => skillsApi.get(`/class8-skills/categories/${skillId}`).then((r) => r.data).catch((e) => { throw unpack(e) })
export const getActivity = (skillId, activityId) =>
  skillsApi.get(`/class8-skills/categories/${skillId}/activities/${activityId}`).then((r) => r.data).catch((e) => { throw unpack(e) })
export const startAttempt = (payload) => skillsApi.post('/class8-skills/attempts', payload).then((r) => r.data).catch((e) => { throw unpack(e) })
export const askHint = (attemptId, taskIndex) => skillsApi.post(`/class8-skills/attempts/${attemptId}/hint`, { taskIndex }).then((r) => r.data).catch((e) => { throw unpack(e) })
export const answerTask = (attemptId, taskIndex, given) =>
  skillsApi.post(`/class8-skills/attempts/${attemptId}/answer`, { taskIndex, given }).then((r) => r.data).catch((e) => { throw unpack(e) })
export const completeAttempt = (attemptId, payload) =>
  skillsApi.post(`/class8-skills/attempts/${attemptId}/complete`, payload).then((r) => r.data).catch((e) => { throw unpack(e) })
export const abandonAttempt = (attemptId) => skillsApi.post(`/class8-skills/attempts/${attemptId}/abandon`).then((r) => r.data).catch((e) => { throw unpack(e) })
export const getRecommendations = () => skillsApi.get('/class8-skills/recommendations').then((r) => r.data).catch((e) => { throw unpack(e) })
export const getHistory = () => skillsApi.get('/class8-skills/history').then((r) => r.data).catch((e) => { throw unpack(e) })
export const getMilestones = () => skillsApi.get('/class8-skills/milestones').then((r) => r.data).catch((e) => { throw unpack(e) })

export default {
  getDashboard,
  getCategories,
  getCategory,
  getActivity,
  startAttempt,
  askHint,
  answerTask,
  completeAttempt,
  abandonAttempt,
  getRecommendations,
  getHistory,
  getMilestones,
}