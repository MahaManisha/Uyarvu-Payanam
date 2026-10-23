import axios from 'axios'
import {
  seedCareerWorlds,
  seedWorldByKey,
  seedQuizQuestions,
  seedGames,
  seedWeeklyChallenge,
  seedExpedition,
  seedSpotlight,
  seedNudges,
  seedVideos,
  seedEvents,
  seedStreak,
  seedSeasonalEvents,
  seedBadgesShelf,
  seedCertificates,
  seedSkillProfile,
  seedDiscoverQuestions,
  seedDiscoverProgress,
} from './class5SeedData'

import { API_BASE_URL } from '../../config/apiConfig'

// Dedicated instance WITHOUT the 401-redirect interceptor used by studentApi:
// if the student is not logged in (demo/browse mode) we gracefully fall back
// to the seeded mock data instead of hard-redirecting to /student/signin.
const c5Api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
})

c5Api.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const getStudent = () => {
  try {
    return JSON.parse(localStorage.getItem('studentData') || 'null')
  } catch {
    return null
  }
}

let liveMode = true
export const isClass5Live = () => liveMode

async function call(path, fallback, opts = {}) {
  try {
    const res = await c5Api({ method: opts.method || 'get', url: path, data: opts.body, timeout: 6000 })
    liveMode = true
    return res.data?.data ?? fallback
  } catch {
    liveMode = false
    return fallback
  }
}

// ── Discover Me ─────────────────────────────────────────────
export const getCareerWorlds = () => call('/class5/career-worlds', seedCareerWorlds)

export const getQuizQuestions = () => call('/class5/quiz/questions', seedQuizQuestions)

export function scoreQuizLocally(answers, questions) {
  const qs = Array.isArray(questions) && questions.length ? questions : seedQuizQuestions
  const counts = {}
  const axes = { logic: 0, creativity: 0, empathy: 0, leadership: 0, focus: 0 }
  for (const a of answers || []) {
    const q = qs.find((x) => x.id === a.questionId) || qs[a.questionIndex]
    const opt = q?.options?.find((o) => o.index === a.answerIndex || o.index === a.optionIndex)
    if (opt) {
      if (opt.worldKey) counts[opt.worldKey] = (counts[opt.worldKey] || 0) + 1
      if (opt.axes) for (const k in opt.axes) axes[k] = (axes[k] || 0) + opt.axes[k]
    }
  }
  let topKey = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  if (!topKey) {
    topKey = Object.keys(axes).sort((a, b) => axes[b] - axes[a])[0]
    const keyMap = { logic: 'code-wizard', creativity: 'story-weaver', empathy: 'community-doctor', leadership: 'green-builder', focus: 'space-engineer' }
    topKey = keyMap[topKey] || 'ocean-explorer'
  }
  const world = seedWorldByKey[topKey] || seedCareerWorlds[0]
  const radar = {
    logic: 55 + Math.min(40, axes.logic * 5),
    creativity: 55 + Math.min(40, axes.creativity * 5),
    empathy: 55 + Math.min(40, axes.empathy * 5),
    leadership: 55 + Math.min(40, axes.leadership * 5),
    focus: 55 + Math.min(40, axes.focus * 5),
  }
  return { resultWorld: world, topWorld: world, counts, axes, radar }
}

export async function submitQuiz(answers) {
  const student = getStudent()
  const fallbackDefault = seedCareerWorlds[0]
  const local = scoreQuizLocally(answers)
  const fallback = {
    resultWorld: local.resultWorld,
    topWorld: local.topWorld,
    radar: local.radar,
    updatedProfile: { skills: local.radar, updatedAt: new Date().toISOString(), lastWorld: { key: local.topWorld.key, name: local.topWorld.name } },
  }
  if (!student) return fallback
  const data = await call('/class5/quiz/submit', fallback, { method: 'post', body: { answers } })
  const resultWorld = data.resultWorld || data.topWorld || fallbackDefault
  const skills = data.skills || (data.updatedProfile && data.updatedProfile.skills) || local.radar
  return {
    ...data,
    resultWorld,
    topWorld: data.topWorld || resultWorld,
    radar: skills,
    updatedProfile: data.updatedProfile || { skills, updatedAt: new Date().toISOString(), lastWorld: { key: resultWorld.key, name: resultWorld.name } },
  }
}

export const getSkillProfile = () => call('/class5/skill-profile', seedSkillProfile)

// ── Discover Me · quest cards (JSON question bank) ──────────────
export const getDiscoverProgress = () => call('/class5/discover/progress', seedDiscoverProgress)

export const getDiscoverQuestions = (worldId, count = 3) => {
  const seed = seedDiscoverQuestions
    .filter((q) => q.worldId === worldId)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
  return call(
    `/class5/discover/questions?worldId=${encodeURIComponent(worldId)}&count=${count}`,
    {
      world: seedCareerWorlds.find((w) => w.key === worldId) || seedCareerWorlds[0],
      progress: seedDiscoverProgress.worlds.find((w) => w.worldId === worldId),
      questions: seed,
    }
  )
}

export function completeDiscoverQuestion(questionId, solved) {
  const fallback = { progress: null, xpEarned: solved ? 6 : 0 }
  const student = getStudent()
  if (!student) return Promise.resolve(fallback)
  return call(
    '/class5/discover/questions/complete',
    fallback,
    { method: 'post', body: { questionId, solved } }
  )
}

// ── Skill Quests ────────────────────────────────────────────
export const getCurrentChallenge = () => {
  const seed = { ...seedWeeklyChallenge, submitted: false, submission: null }
  return call('/class5/challenges/current', seed)
}

export function submitChallengeLocally(challengeId, response, responseIndex) {
  const local = { ...seedWeeklyChallenge, submitted: true, submission: { response, responseIndex, submittedAt: new Date().toISOString() } }
  return local
}

export async function submitChallenge(challengeId, { response, responseIndex }) {
  const student = getStudent()
  if (!student) return submitChallengeLocally(challengeId, response, responseIndex)
  return call(
    '/class5/challenges/current/submit',
    submitChallengeLocally(challengeId, response, responseIndex),
    { method: 'post', body: { response, responseIndex } }
  )
}

export const getGames = () => call('/class5/games', seedGames)

export const getGame = (keyOrId) => {
  const seed = seedGames.find((g) => g.key === keyOrId || g.id === keyOrId) || seedGames[0]
  return call(keyOrId ? `/class5/games/${encodeURIComponent(keyOrId)}` : '/class5/games', seed)
}

export async function submitGameAttempt(gameId, { pct }) {
  const student = getStudent()
  if (!student) return { success: true, xpEarned: Math.round((pct / 100) * 25), badgeAwarded: false, pct }
  // Backend: POST /api/class5/games/:id/attempt (game id = _id OR key). The
  // previous '/class5/games/attempt' never matched a route, so every attempt
  // silently fell back to local seed data and no XP/attempt was ever saved.
  return call(
    `/class5/games/${encodeURIComponent(gameId)}/attempt`,
    { success: true, xpEarned: Math.round((pct / 100) * 25), badgeAwarded: false, pct },
    { method: 'post', body: { pct } }
  )
}

// ── Squad ───────────────────────────────────────────────────
export const getExpedition = () => call('/class5/expeditions/current', seedExpedition)

export async function contributeToExpedition(expeditionId, { xp }) {
  const student = getStudent()
  if (!student) return { success: true, approved: true, contributedXp: xp }
  return call(
    '/class5/expeditions/current/contribute',
    { success: true, approved: true, contributedXp: xp },
    { method: 'post', body: { expeditionId, xp } }
  )
}

export const getSpotlight = () => call('/class5/spotlight/current', seedSpotlight)

export const getNudges = () => {
  const student = getStudent()
  return call(student ? '/class5/nudges' : '/class5/nudges', seedNudges)
}

// ── Real World ──────────────────────────────────────────────
export const getVideos = (worldId) => {
  const list = worldId ? seedVideos.filter((v) => v.careerWorldKey === worldId || v.world.name === worldId) : seedVideos
  return call(worldId ? `/class5/videos?worldId=${encodeURIComponent(worldId)}` : '/class5/videos', list)
}

export const getEvents = () => call('/class5/events/upcoming', seedEvents)

export async function attendEvent(eventId) {
  const student = getStudent()
  if (!student) {
    return { success: true, badgeAwarded: false, badge: null }
  }
  return call(
    '/class5/events/attend',
    { success: true, badgeAwarded: false, badge: null },
    { method: 'post', body: { eventId } }
  )
}

export const getSeasonalEvents = () => call('/class5/seasonal-events', seedSeasonalEvents)

export async function generateFutureMap({ worldKey, exploredWorldKeys, skills }) {
  const student = getStudent()
  if (!student) return { success: true, downloadUrl: null, title: 'My Future Map', generatedAt: new Date().toISOString() }
  return call(
    '/class5/future-map/generate',
    { success: true, downloadUrl: null, title: 'My Future Map', generatedAt: new Date().toISOString() },
    { method: 'post', body: { worldKey, exploredWorldKeys, skills } }
  )
}

// ── Trophy Room ─────────────────────────────────────────────
export const getStreak = () => call('/class5/streak', seedStreak)

export const getBadges = () => call('/class5/badges', seedBadgesShelf)

export const getCertificates = () => call('/class5/certificates', seedCertificates)

export const getCertificatePdfUrl = (certId) =>
  `${API_BASE_URL}/class5/certificates/${encodeURIComponent(certId)}/pdf`

export async function generateBadgeCertificate(badgeKey) {
  const student = getStudent()
  if (!student) return { success: true, downloadUrl: null }
  return call(
    '/class5/badges/certificate/generate',
    { success: true, downloadUrl: null },
    { method: 'post', body: { badgeKey } }
  )
}

export const getParentSnapshot = () => call('/class5/parent/career-snapshot', {
  profile: seedSkillProfile,
  streak: seedStreak,
  games: seedGames.length,
  challenges: 1,
  badges: seedBadgesShelf.earnedCount,
  topWorld: seedSkillProfile.lastWorld,
})

// Scoped: current student id for optimistic UI overlays.
export const getCurrentStudent = getStudent

export default {
  getCareerWorlds,
  getQuizQuestions,
  scoreQuizLocally,
  submitQuiz,
  getSkillProfile,
  getDiscoverProgress,
  getDiscoverQuestions,
  completeDiscoverQuestion,
  getCurrentChallenge,
  submitChallenge,
  getGames,
  getGame,
  submitGameAttempt,
  getExpedition,
  contributeToExpedition,
  getSpotlight,
  getNudges,
  getVideos,
  getEvents,
  attendEvent,
  getSeasonalEvents,
  generateFutureMap,
  getStreak,
  getBadges,
  getCertificates,
  getCertificatePdfUrl,
  generateBadgeCertificate,
  getParentSnapshot,
  getCurrentStudent,
}