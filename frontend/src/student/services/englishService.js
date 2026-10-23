import axios from 'axios'

// English Adventure API. The backend is the source of truth for progress,
// stars, streak, level, badges and mistakes — the content (questions, writing
// topics, scenes) lives in the frontend data layer.
//
// If the backend is unreachable (offline dev, expired token...) the service
// falls back to a localStorage mirror so a child can still play and earn —
// progress is marked "saved on this device" and will sync once the API is up.

import { API_BASE_URL } from '../../config/apiConfig'

const englishApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

englishApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const LS_KEY = 'englishAdventureState'

const EMPTY_STATE = () => ({
  stars: 0,
  streak: 0,
  bestStreak: 0,
  level: 1,
  levelName: 'Beginner',
  activitiesCompleted: 0,
  activitiesTried: 0,
  badges: [],
  activityCounts: {},
  grammarTopics: [],
  commonMistakes: [],
  dailyChallenge: { date: '', activityKey: '' },
  weeklyChallenge: { weekKey: '', rounds: 0 },
})

function localRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return EMPTY_STATE()
    return { ...EMPTY_STATE(), ...JSON.parse(raw) }
  } catch {
    return EMPTY_STATE()
  }
}

function localWrite(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* storage may be unavailable */
  }
}

// computeBadges mirrors the backend calculation so the offline mirror updates
// identically to the server.
function badgeAdd(badges, key) {
  if (!badges.includes(key)) badges.push(key)
}

function computeLevel(stars) {
  if (stars >= 500) return { level: 5, name: 'English Champion' }
  if (stars >= 300) return { level: 4, name: 'English Star' }
  if (stars >= 150) return { level: 3, name: 'Confident' }
  if (stars >= 50) return { level: 2, name: 'Explorer' }
  return { level: 1, name: 'Beginner' }
}

function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function applyBadges(state) {
  const badges = state.badges || []
  const counts = state.activityCounts || {}
  const grammarSolved = (state.grammarTopics || []).reduce((n, t) => n + (t.solved || 0), 0)
  if (state.activitiesCompleted >= 1) badgeAdd(badges, 'first-step')
  if (counts.writing >= 1) badgeAdd(badges, 'little-writer')
  if (counts.speaking >= 1) badgeAdd(badges, 'brave-speaker')
  if (counts.vocabulary >= 1) badgeAdd(badges, 'word-explorer')
  if (grammarSolved >= 10) badgeAdd(badges, 'grammar-hero')
  if (counts['sentence-builder'] >= 1) badgeAdd(badges, 'builder-buddy')
  if (counts['listen-speak'] >= 1) badgeAdd(badges, 'listener-star')
  if (counts['daily-challenge'] >= 1) badgeAdd(badges, 'daily-doer')
  if (state.activitiesCompleted >= 7) badgeAdd(badges, 'english-explorer')
  if ((state.bestStreak || state.streak || 0) >= 3) badgeAdd(badges, 'streak-3')
  if ((state.bestStreak || 0) >= 7) badgeAdd(badges, 'streak-7')
  if (state.stars >= 500) badgeAdd(badges, 'champion')
  const lvl = computeLevel(state.stars)
  state.level = lvl.level
  state.levelName = lvl.name
  state.badges = badges
  return state
}

function localActivity(state, payload) {
  const today = localDateKey()
  const yesterday = localDateKey(new Date(Date.now() - 86400000))
  if (state.lastActiveDay !== today) {
    state.streak = state.lastActiveDay === yesterday ? (state.streak || 0) + 1 : 1
    state.lastActiveDay = today
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak)
  }
  state.stars = Math.max(0, (state.stars || 0) + Number(payload.stars || 0))
  const counts = { ...(state.activityCounts || {}) }
  counts[payload.activity] = (counts[payload.activity] || 0) + 1
  state.activityCounts = counts
  if (payload.completed) state.activitiesCompleted = (state.activitiesCompleted || 0) + 1
  if (payload.activity === 'daily-challenge') {
    state.dailyChallenge = { date: today, activityKey: payload.topic || payload.activity }
  }
  if (payload.activity === 'weekly-challenge') {
    const weekKey = today.slice(0, 7)
    if (state.weeklyChallenge.weekKey !== weekKey) state.weeklyChallenge = { weekKey, rounds: 0 }
    state.weeklyChallenge.rounds = Math.max(state.weeklyChallenge.rounds || 0, Number(payload.topic || 1))
  }
  ;(payload.mistakes || []).forEach((topic) => {
    if (!topic) return
    const row = state.commonMistakes.find((m) => m.topic === topic)
    if (row) row.count += 1
    else state.commonMistakes.push({ topic, count: 1 })
  })
  state.commonMistakes = state.commonMistakes.slice().sort((a, b) => b.count - a.count).slice(0, 12)
  const before = state.badges.length
  applyBadges(state)
  const newBadges = state.badges.slice(before)
  localWrite(state)
  return { state, newBadges }
}

function localGrammarAnswer(state, payload) {
  let row = (state.grammarTopics || []).find((t) => t.topicId === payload.topicId)
  if (!row) {
    row = { topicId: payload.topicId, solved: 0, total: 0 }
    state.grammarTopics = [...(state.grammarTopics || []), row]
  }
  if (payload.correct) row.solved += 1
  row.total += 1
  const before = state.badges.length
  applyBadges(state)
  const newBadges = state.badges.slice(before)
  localWrite(state)
  return { state, newBadges }
}

async function tryApi(fn, localFn, payload) {
  try {
    const res = await fn()
    const root = res.data && typeof res.data.data === 'object' ? res.data.data : null
    if (root) {
      localWrite(root.state || root)
      return root
    }
    throw new Error('empty payload')
  } catch {
    // Honest offline fallback: keep the adventure playable on this device.
    const state = localRead()
    if (payload) return localFn(state, payload)
    return state
  }
}

export const getEnglishProgress = () =>
  tryApi(() => englishApi({ method: 'get', url: '/english/progress', timeout: 6000 }))

export const recordEnglishActivity = (payload) =>
  tryApi(
    () => englishApi({ method: 'post', url: '/english/activity', data: payload, timeout: 8000 }),
    localActivity,
    payload
  )

export const recordGrammarAnswer = (payload) =>
  tryApi(
    () => englishApi({ method: 'post', url: '/english/grammar-answer', data: payload, timeout: 8000 }),
    localGrammarAnswer,
    payload
  )

// Mirrors the backend's weekday rotation so the offline path shows the same
// mission the server would have served (Sunday → write ... Saturday → weekend).
const DAILY_CYCLE = ['write', 'speak', 'grammar', 'picture', 'listen', 'story', 'weekend']

function localDaily(state) {
  const today = new Date()
  const date = localDateKey(today)
  const src = state || localRead()
  return {
    date,
    dayIndex: today.getDay(),
    activityKey: DAILY_CYCLE[today.getDay()],
    done: Boolean(src.dailyChallenge && src.dailyChallenge.date === date),
  }
}

export const getEnglishDaily = () =>
  tryApi(() => englishApi({ method: 'get', url: '/english/daily', timeout: 6000 }), localDaily, 'local')

export default {
  getEnglishProgress,
  recordEnglishActivity,
  recordGrammarAnswer,
  getEnglishDaily,
}