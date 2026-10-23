import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCollegeProfile } from '../../context/CollegeProfileContext'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import FocusCameraDetector from '../../components/common/FocusCameraDetector'
import browserActivityProvider from '../../services/browserActivityProvider'
import axios from 'axios'
import {
  FiClock, FiPlay, FiPause, FiCheckCircle, FiAlertTriangle,
  FiEye, FiActivity, FiArrowLeft, FiMic, FiMicOff, FiInfo,
  FiUsers, FiTarget, FiZap, FiBarChart2, FiMaximize, FiShield,
  FiSmartphone, FiChevronDown, FiChevronUp, FiAward, FiBookOpen,
  FiLock, FiLayers
} from 'react-icons/fi'

import { API_BASE_URL } from '../../../config/apiConfig'

const API = API_BASE_URL
const getToken = () => localStorage.getItem('studentToken')

const DEFAULT_SCORING = {
  tabSwitchPenalty: 4,
  windowBlurPenalty: 3,
  fullscreenExitPenalty: 5,
  inactivityPenalty: 3,
  cameraAwayPenalty: 4,
  lookingAwayPenalty: 4,
  phonePenalty: 8,
  possiblePhonePenalty: 6
}

const FOCUS_CATEGORIES = [
  { value: 'subject', label: '📚 Subject Study' },
  { value: 'skill', label: '⚡ Skill Building' },
  { value: 'assignment', label: '📝 Assignment' },
  { value: 'interview_prep', label: '💼 Interview Prep' },
  { value: 'placement_prep', label: '🎯 Placement Prep' },
  { value: 'course', label: '🎓 Online Course' },
  { value: 'general', label: '📖 General Study' },
]

const DURATIONS = [15, 25, 45, 60]

const DETECTION_MODES = [
  {
    id: 'STANDARD',
    name: 'STANDARD',
    title: 'Standard Monitoring',
    desc: 'Browser tab switching, window blur, page visibility & input inactivity.'
  },
  {
    id: 'CAMERA',
    name: 'CAMERA',
    title: 'Camera Monitoring',
    desc: 'Standard monitoring + local camera face presence & looking-away detection.'
  },
  {
    id: 'FULL MONITORING',
    name: 'FULL MONITORING',
    title: 'Full Distraction Detection',
    desc: 'Standard + Camera + local phone visibility & head pose distraction detection.'
  }
]

function computeStatus(episodes, activeEpisode, cameraSignalState, sessionActive, sessionPaused, inactiveSeconds) {
  if (!sessionActive) return 'IDLE'
  if (sessionPaused) return 'PAUSED'
  if (activeEpisode) return 'DISTRACTED'
  if (cameraSignalState.phoneDetected) return 'DISTRACTED'
  if (cameraSignalState.headDirection === 'LOOKING_AWAY' || !cameraSignalState.facePresent || inactiveSeconds > 120) return 'POSSIBLE_DISTRACTION'
  return 'FOCUSED'
}

const STATUS_CONFIG = {
  FOCUSED: { color: '#059669', bg: '#ecfdf5', icon: '🟢', label: 'Focused', tip: 'Protected Focus Tab active. Keep studying!' },
  POSSIBLE_DISTRACTION: { color: '#d97706', bg: '#fffbeb', icon: '🟡', label: 'Possible Distraction', tip: 'Attention shift detected. Let’s refocus.' },
  DISTRACTED: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', label: 'Distracted', tip: 'Switched away from protected focus tab. Return to study.' },
  PAUSED: { color: '#6366f1', bg: '#eef2ff', icon: '⏸', label: 'Paused', tip: 'Focus session is currently paused.' },
  IDLE: { color: '#64748b', bg: '#f8fafc', icon: '⚪', label: 'Idle', tip: '' },
}

const fmt = secs => {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function IntelligentFocusPage() {
  const navigate = useNavigate()
  const { profile } = useCollegeProfile()
  const { theme } = useCollegeTheme()

  const userSubjects = profile?.subjects?.length
    ? profile.subjects
    : ['Data Structures', 'Operating Systems', 'DBMS', 'OOP', 'Computer Networks']

  // ── 1. Flow Stage State ──────────────────────────────────────────────────
  // Stages: 'SETUP' | 'CONTEXT_CONFIRM' | 'INITIALIZING' | 'ACTIVE' | 'COMPLETED'
  const [sessionStage, setSessionStage] = useState('SETUP')

  // Setup Fields
  const [subject, setSubject] = useState(userSubjects[0] || 'Data Structures')
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('Complete DBMS Unit 3 — 15 MCQs')
  const [category, setCategory] = useState('subject')
  const [duration, setDuration] = useState(25)
  const [customDur, setCustomDur] = useState('')
  const [detectionMode, setDetectionMode] = useState('FULL MONITORING')
  const [monSettings, setMonSettings] = useState({
    browserActivity: true,
    cameraEnabled: true,
    audioEnabled: false
  })

  // ── 2. Session Telemetry ─────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState(null)
  const [initStep, setInitStep] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  // Timer & Fullscreen
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Initial Score starts at 100
  const [focusScore, setFocusScore] = useState(100)
  const [distractionScore, setDistractionScore] = useState(0)

  // Distraction Episodes & Signals
  const [episodes, setEpisodes] = useState([])
  const [activeEpisode, setActiveEpisode] = useState(null)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [windowBlurCount, setWindowBlurCount] = useState(0)
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0)
  const [inactiveSeconds, setInactiveSeconds] = useState(0)
  const [awayEvents, setAwayEvents] = useState(0)
  const [lookingAwayEvents, setLookingAwayEvents] = useState(0)
  const [phoneEvents, setPhoneEvents] = useState(0)
  const [possiblePhoneEvents, setPossiblePhoneEvents] = useState(0)

  // Real-time camera signals
  const [cameraSignalState, setCameraSignalState] = useState({
    facePresent: true,
    headDirection: 'FORWARD',
    phoneDetected: false,
    possiblePhone: false,
    detectorAvailable: false
  })

  // Tab Fixing & Allowed Reference Tabs Option State
  const [allowTabSwitching, setAllowTabSwitching] = useState(false)
  const allowTabSwitchingRef = useRef(false)
  useEffect(() => {
    allowTabSwitchingRef.current = allowTabSwitching
  }, [allowTabSwitching])

  const [notes, setNotes] = useState('')
  const [showEndModal, setShowEndModal] = useState(false)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  const [warningBanner, setWarningBanner] = useState(null)

  // Refs for state correlation & timers
  const activeEpisodeRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const inactivityTimerRef = useRef(null)
  const toastTimerRef = useRef(null)

  const effectiveDuration = customDur ? parseInt(customDur) || 25 : duration

  const triggerWarning = useCallback((title, message, icon = '⚠') => {
    setWarningBanner({ title, message, icon })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setWarningBanner(null), 5000)
  }, [])

  // ── Distraction Episode Correlation Layer ─────────────────────────────────
  const startDistractionEpisode = useCallback((signalType, reason, severity = 'MEDIUM') => {
    if (sessionPaused || !sessionActive) return

    const now = Date.now()
    let ep = activeEpisodeRef.current

    // Event correlation: if episode started within 500ms (e.g. TAB_SWITCH + WINDOW_BLUR), correlate!
    if (ep && (now - new Date(ep.startedAt).getTime() < 1000)) {
      if (!ep.signals.includes(signalType)) {
        ep.signals.push(signalType)
      }
      return
    }

    // Create new DistractionEpisode
    ep = {
      episodeId: `ep_${now}`,
      sessionId,
      startedAt: new Date(now).toISOString(),
      endedAt: null,
      duration: 0,
      signals: [signalType],
      primarySignal: signalType,
      severity,
      confidence: 1.0,
      reason
    }

    activeEpisodeRef.current = ep
    setActiveEpisode(ep)

    if (signalType === 'TAB_SWITCH') setTabSwitchCount(p => p + 1)
    if (signalType === 'WINDOW_BLUR') setWindowBlurCount(p => p + 1)
    if (signalType === 'FULLSCREEN_EXIT') setFullscreenExitCount(p => p + 1)

    // Deduct focus score once per episode
    const penalty = signalType === 'TAB_SWITCH' ? DEFAULT_SCORING.tabSwitchPenalty :
                    signalType === 'WINDOW_BLUR' ? DEFAULT_SCORING.windowBlurPenalty :
                    signalType === 'FULLSCREEN_EXIT' ? DEFAULT_SCORING.fullscreenExitPenalty : 4

    setFocusScore(prev => Math.max(0, prev - penalty))
    setDistractionScore(prev => Math.min(100, prev + penalty))

    triggerWarning('🔴 Distracted', reason || 'You left the protected focus tab. Return to continue studying.')
  }, [sessionId, sessionActive, sessionPaused, triggerWarning])

  const endDistractionEpisode = useCallback(() => {
    const ep = activeEpisodeRef.current
    if (!ep) return

    const endedAt = Date.now()
    const dur = Math.round((endedAt - new Date(ep.startedAt).getTime()) / 1000)
    ep.endedAt = new Date(endedAt).toISOString()
    ep.duration = dur

    setEpisodes(prev => [...prev, ep])
    activeEpisodeRef.current = null
    setActiveEpisode(null)

    triggerWarning('🟢 Focused', `Welcome back to your protected focus tab after ${dur}s. Keep studying!`, '🟢')
  }, [triggerWarning])

  // ── Browser Activity Provider Binding ─────────────────────────────────────
  useEffect(() => {
    if (!sessionActive || sessionPaused || sessionCompleted) {
      browserActivityProvider.stop()
      return
    }

    browserActivityProvider.start()

    const unsubscribe = browserActivityProvider.onContextChange(evt => {
      if (evt.type === 'TAB_HIDDEN') {
        if (allowTabSwitchingRef.current) {
          triggerWarning('📌 Reference Tab Active', 'Tab switch allowed for reference material. No penalty recorded.', '📌')
          return
        }
        startDistractionEpisode('TAB_SWITCH', 'Switched away from protected focus tab', 'MEDIUM')
      } else if (evt.type === 'TAB_VISIBLE') {
        if (!allowTabSwitchingRef.current) {
          endDistractionEpisode()
        }
      } else if (evt.type === 'WINDOW_BLUR') {
        if (allowTabSwitchingRef.current) return
        startDistractionEpisode('WINDOW_BLUR', 'Browser window lost focus', 'LOW')
      } else if (evt.type === 'WINDOW_FOCUS') {
        if (!allowTabSwitchingRef.current) {
          endDistractionEpisode()
        }
      } else if (evt.type === 'FULLSCREEN_EXIT') {
        startDistractionEpisode('FULLSCREEN_EXIT', 'Exited focus mode fullscreen', 'MEDIUM')
      }
    })

    return () => {
      unsubscribe()
      browserActivityProvider.stop()
    }
  }, [sessionActive, sessionPaused, sessionCompleted, startDistractionEpisode, endDistractionEpisode, triggerWarning])

  // ── Inactivity Tracking (Reading Aware) ───────────────────────────────────
  useEffect(() => {
    if (!sessionActive || sessionPaused || sessionCompleted) return

    const handleActivity = () => { lastActivityRef.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointermove']
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }))

    inactivityTimerRef.current = setInterval(() => {
      const inactiveSecs = Math.round((Date.now() - lastActivityRef.current) / 1000)
      if (inactiveSecs >= 60) {
        const isReading = cameraSignalState.facePresent && cameraSignalState.headDirection === 'FORWARD'
        if (!isReading) {
          setInactiveSeconds(p => p + 1)
        }
      }
    }, 1000)

    return () => {
      clearInterval(inactivityTimerRef.current)
      events.forEach(e => document.removeEventListener(e, handleActivity))
    }
  }, [sessionActive, sessionPaused, sessionCompleted, cameraSignalState])

  // ── Handle Camera Distraction Events ──────────────────────────────────────
  const handleCameraEventTriggered = useCallback(evt => {
    if (sessionPaused || !sessionActive) return

    if (evt.eventType === 'FACE_MISSING') {
      setAwayEvents(p => p + 1)
      setFocusScore(p => Math.max(0, p - DEFAULT_SCORING.cameraAwayPenalty))
      triggerWarning('👀 Face Missing', 'No face detected in camera frame. Stay in front of camera.')
    } else if (evt.eventType === 'LOOKING_AWAY') {
      setLookingAwayEvents(p => p + 1)
      setFocusScore(p => Math.max(0, p - DEFAULT_SCORING.lookingAwayPenalty))
      triggerWarning('👀 Attention Alert', 'You appear to have looked away. Let’s get back to studying.')
    } else if (evt.eventType === 'PHONE_DETECTED') {
      setPhoneEvents(p => p + 1)
      setFocusScore(p => Math.max(0, p - DEFAULT_SCORING.phonePenalty))
      triggerWarning('📱 Possible Phone Distraction', 'A phone appears visible in camera frame. Keep phone away.', '📱')
    } else if (evt.eventType === 'POSSIBLE_PHONE_USAGE') {
      setPossiblePhoneEvents(p => p + 1)
      setFocusScore(p => Math.max(0, p - DEFAULT_SCORING.possiblePhonePenalty))
    }
  }, [sessionActive, sessionPaused, triggerWarning])

  // ── Flow Step Handlers ────────────────────────────────────────────────────
  const proceedToContextConfirmation = () => {
    setSessionStage('CONTEXT_CONFIRM')
  }

  const activateFocusMode = async () => {
    setSessionStage('INITIALIZING')
    setInitStep('Focus session is starting...')
    await new Promise(r => setTimeout(r, 400))

    setInitStep('Protecting Uyarvu Payanam focus tab context...')
    await new Promise(r => setTimeout(r, 400))

    setInitStep('Initializing activity & tab activity monitoring...')
    await new Promise(r => setTimeout(r, 400))

    // Backend Session Creation
    try {
      const res = await axios.post(`${API}/focus/sessions`, {
        subject,
        topic,
        goal,
        category,
        plannedDuration: effectiveDuration,
        detectionMode,
        monitoringSettings: monSettings,
        scoringConfig: DEFAULT_SCORING
      }, { headers: { Authorization: `Bearer ${getToken()}` } })

      if (res.data?.success && res.data.session) {
        setSessionId(res.data.session._id)
      }
    } catch (e) {
      console.warn('Backend start error:', e.message)
    }

    // Initialize telemetry
    setSecondsRemaining(effectiveDuration * 60)
    setElapsedSeconds(0)
    setFocusScore(100)
    setDistractionScore(0)
    setEpisodes([])
    setActiveEpisode(null)
    setTabSwitchCount(0); setWindowBlurCount(0); setFullscreenExitCount(0)
    setInactiveSeconds(0); setAwayEvents(0); setLookingAwayEvents(0)
    setPhoneEvents(0); setPossiblePhoneEvents(0)
    lastActivityRef.current = Date.now()

    setSessionActive(true)
    setSessionPaused(false)
    setSessionCompleted(false)
    setSessionStage('ACTIVE')
  }

  // Fullscreen toggle helper
  const requestFullscreen = () => {
    browserActivityProvider.suspend()
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(() => {}).finally(() => {
        setTimeout(() => browserActivityProvider.resume(), 1000)
      })
    }
  }

  // Timer Tick
  useEffect(() => {
    if (!sessionActive || sessionPaused || sessionCompleted) return
    const timer = setInterval(() => {
      setSecondsRemaining(p => {
        if (p <= 1) {
          clearInterval(timer)
          handleSessionComplete()
          return 0
        }
        return p - 1
      })
      setElapsedSeconds(p => p + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionActive, sessionPaused, sessionCompleted])

  // Pause / Resume
  const togglePause = async () => {
    browserActivityProvider.suspend()
    const pausing = !sessionPaused
    setSessionPaused(pausing)

    if (pausing) {
      if (activeEpisodeRef.current) endDistractionEpisode()
    }

    if (sessionId) {
      const endpoint = pausing ? `/focus/sessions/${sessionId}/pause` : `/focus/sessions/${sessionId}/resume`
      await axios.post(`${API}${endpoint}`, {}, { headers: { Authorization: `Bearer ${getToken()}` } }).catch(() => {})
    }

    setTimeout(() => browserActivityProvider.resume(), 500)
  }

  // Session Completion
  const handleSessionComplete = async () => {
    setSessionActive(false)
    setSessionCompleted(true)
    setSessionStage('COMPLETED')

    browserActivityProvider.stop()

    if (sessionId) {
      await axios.post(`${API}/focus/sessions/${sessionId}/complete`, {
        actualDuration: elapsedSeconds,
        tabSwitchCount,
        windowBlurCount,
        fullscreenExitCount,
        inactiveSeconds,
        awayEvents,
        lookingAwayEvents,
        phoneEvents,
        possiblePhoneEvents,
        notes,
        goalStatus: 'completed'
      }, { headers: { Authorization: `Bearer ${getToken()}` } }).catch(() => {})
    }
  }

  const confirmEndSession = async () => {
    setShowEndModal(false)
    await handleSessionComplete()
  }

  const resetSession = () => {
    setSessionStage('SETUP')
    setSessionActive(false)
    setSessionPaused(false)
    setSessionCompleted(false)
    setFocusScore(100)
    setDistractionScore(0)
    setEpisodes([])
    setActiveEpisode(null)
  }

  const currentStatus = computeStatus(episodes, activeEpisode, cameraSignalState, sessionActive, sessionPaused, inactiveSeconds)
  const statusCfg = STATUS_CONFIG[currentStatus]
  const progressPct = effectiveDuration > 0 ? Math.min(100, ((effectiveDuration * 60 - secondsRemaining) / (effectiveDuration * 60)) * 100) : 0
  const scoreColor = focusScore > 80 ? '#059669' : focusScore > 60 ? '#d97706' : '#dc2626'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--s-font-body, Inter, sans-serif)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button type="button" onClick={() => navigate('/college/dashboard')}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            <FiArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Intelligent Focus Mode
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', maxWidth: 620 }}>
            Protected study tab context monitoring with local computer vision attention detection.
          </p>
        </div>

        {sessionActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button type="button" onClick={requestFullscreen}
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiMaximize size={15} /> Enter Focus Mode
            </button>
            <div style={{ background: statusCfg.bg, color: statusCfg.color, padding: '8px 16px', borderRadius: 20, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${statusCfg.color}33` }}>
              <span>{statusCfg.icon}</span> {statusCfg.label}
            </div>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      {warningBanner && (
        <div style={{ background: warningBanner.icon === '🟢' ? '#ecfdf5' : '#fffbeb', color: warningBanner.icon === '🟢' ? '#065f46' : '#b45309', border: `1px solid ${warningBanner.icon === '🟢' ? '#a7f3d0' : '#fde68a'}`, padding: '14px 20px', borderRadius: 14, marginBottom: 20, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: 20 }}>{warningBanner.icon}</span>
          <div>
            <div style={{ fontWeight: 800 }}>{warningBanner.title}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{warningBanner.message}</div>
          </div>
        </div>
      )}

      {/* ── STEP 1: SETUP SCREEN ────────────────────────────────────────────── */}
      {sessionStage === 'SETUP' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Form */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: 24 }}>CHOOSE YOUR STUDY CONTEXT</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Subject / Module *</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
                  {userSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                  {FOCUS_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Specific Topic (optional)</label>
              <input type="text" placeholder="e.g. Binary Trees, OS Scheduling Algorithms"
                value={topic} onChange={e => setTopic(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Your Goal for This Session *</label>
              <input type="text" placeholder='e.g. "Complete DBMS Unit 3 — 15 MCQs"'
                value={goal} onChange={e => setGoal(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Duration</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => { setDuration(d); setCustomDur(''); setSecondsRemaining(d * 60) }}
                    style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', border: duration === d && !customDur ? 'none' : '1px solid #e2e8f0', background: duration === d && !customDur ? '#0284c7' : '#f1f5f9', color: duration === d && !customDur ? '#fff' : '#475569', transition: 'all 0.15s' }}>
                    {d} min
                  </button>
                ))}
                <input type="number" min="5" max="180" placeholder="Custom"
                  value={customDur} onChange={e => { setCustomDur(e.target.value); setDuration(0) }}
                  style={{ width: 90, padding: '10px 12px', borderRadius: 12, border: `1px solid ${customDur ? '#0284c7' : '#e2e8f0'}`, fontSize: 14, fontWeight: 700, outline: 'none' }} />
              </div>
            </div>

            {/* Monitoring Mode */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>CHOOSE MONITORING MODE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {DETECTION_MODES.map(m => (
                  <div key={m.id} onClick={() => {
                    setDetectionMode(m.id)
                    setMonSettings(p => ({ ...p, cameraEnabled: m.id !== 'STANDARD' }))
                  }}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: detectionMode === m.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: detectionMode === m.id ? '#f0f9ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: detectionMode === m.id ? '#0284c7' : '#0f172a', marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Switching & Reference Material Exemption Settings */}
            <div style={{ marginBottom: 28, background: allowTabSwitching ? '#f0fdf4' : '#f8fafc', padding: 16, borderRadius: 16, border: allowTabSwitching ? '1px solid #86efac' : '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiLayers color={allowTabSwitching ? '#16a34a' : '#0284c7'} /> 📌 TAB FIXING & STUDY TAB EXEMPTION
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
                    {allowTabSwitching
                      ? '🔓 Reference Tabs Exempt: Switching to textbook, notes or study tabs will NOT be recorded as tab switching.'
                      : '🔒 Strict Protection: Leaving or switching away from this tab will deduct focus score.'}
                  </div>
                </div>
                <button type="button" onClick={() => setAllowTabSwitching(!allowTabSwitching)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: allowTabSwitching ? '#16a34a' : '#e2e8f0',
                    color: allowTabSwitching ? '#fff' : '#334155',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}>
                  {allowTabSwitching ? '📌 Reference Tabs Exempt (ON)' : '🔒 Enable Reference Tab Exemption'}
                </button>
              </div>
            </div>

            <button type="button" onClick={proceedToContextConfirmation}
              style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', fontWeight: 900, fontSize: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 14px rgba(2,132,199,0.35)' }}>
              <FiPlay size={20} /> BEGIN FOCUS SESSION ({effectiveDuration} min)
            </button>
          </div>

          {/* Privacy Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#0f172a', borderRadius: 20, padding: 24, color: '#fff' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiShield color="#38bdf8" /> 🔒 PRIVACY PROTECTED
              </h3>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
                • Camera processing happens 100% locally in browser RAM.<br />
                • No raw video frames or images are saved or uploaded.<br />
                • No facial recognition or biometric database.<br />
                • Only derived focus telemetry and event counts are stored.
              </div>

              <div style={{ padding: 12, background: 'rgba(2,132,199,0.15)', borderRadius: 12, border: '1px solid rgba(2,132,199,0.3)', fontSize: 11, color: '#e0f2fe', lineHeight: 1.4 }}>
                <strong>Desktop Web Notice:</strong><br />
                "Phone / distraction detection" infers phone usage from posture & camera frame. Direct device-level app tracking requires a native mobile app.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: CONTEXT CONFIRMATION SCREEN ───────────────────────────── */}
      {sessionStage === 'CONTEXT_CONFIRM' && (
        <div style={{ maxWidth: 640, margin: '40px auto', background: '#fff', borderRadius: 24, padding: 40, border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <FiLock size={28} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>PROTECT YOUR STUDY SESSION</h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 28 }}>
            "You can keep this Uyarvu Payanam Focus tab open while studying.<br />
            {allowTabSwitching
              ? '📌 Reference Tab Exemption is active — tab switches to study materials will not be penalized.'
              : 'Leaving or switching away from this tab will be recorded as a distraction.'}
          </p>

          <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>STUDY CONTEXT SUMMARY</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Subject: {subject}</div>
            {topic && <div style={{ fontSize: 13, color: '#334155' }}>Topic: {topic}</div>}
            <div style={{ fontSize: 13, color: '#334155' }}>Goal: {goal}</div>
            <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 700, marginTop: 4 }}>
              Duration: {effectiveDuration} minutes | Mode: {detectionMode}
            </div>
            <div style={{ fontSize: 12, color: allowTabSwitching ? '#16a34a' : '#64748b', fontWeight: 700, marginTop: 4 }}>
              Tab Switch Protection: {allowTabSwitching ? '📌 Reference Tabs Exempt' : '🔒 Strict Focus Tab Monitoring'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <button type="button" onClick={() => setSessionStage('SETUP')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, background: '#f1f5f9', color: '#475569', fontWeight: 800, border: '1px solid #cbd5e1', cursor: 'pointer' }}>
              Edit Setup
            </button>
            <button type="button" onClick={activateFocusMode}
              style={{ flex: 2, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2,132,199,0.35)' }}>
              ACTIVATE FOCUS MODE
            </button>
          </div>
        </div>
      )}

      {/* ── INITIALIZING SPINNER ───────────────────────────────────────────── */}
      {sessionStage === 'INITIALIZING' && (
        <div style={{ background: '#0f172a', borderRadius: 20, padding: 60, textAlign: 'center', color: '#fff' }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', border: '4px solid #0284c7', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
          <h3 style={{ fontSize: 20, fontWeight: 800 }}>{initStep}</h3>
        </div>
      )}

      {/* ── STEP 3: ACTIVE SESSION ─────────────────────────────────────────── */}
      {sessionStage === 'ACTIVE' && sessionActive && (
        <div>
          {/* Camera Detector Component */}
          {monSettings.cameraEnabled && (
            <FocusCameraDetector
              active={sessionActive && !sessionPaused}
              autoStart={true}
              detectionMode={detectionMode}
              onEventTriggered={handleCameraEventTriggered}
              onSignalStateChange={setCameraSignalState}
            />
          )}

          {/* Progress Bar */}
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#0284c7,#0ea5e9)', borderRadius: 3, transition: 'width 1s linear' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            {/* Main Timer Display */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                PROTECTED FOCUS SESSION • {subject}
              </div>
              {topic && <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 700, marginBottom: 4 }}>{topic}</div>}
              {goal && <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 8 }}>🎯 Goal: {goal}</div>}

              {/* Tab Switch Exemption Badge Banner */}
              {allowTabSwitching && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 12, background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 800, marginBottom: 12, border: '1px solid #86efac' }}>
                  <FiLayers size={13} /> 📌 Reference Tabs Exempt — Navigating to study tabs will NOT trigger tab switch penalties.
                </div>
              )}

              {/* Clock */}
              <div style={{ fontSize: 84, fontWeight: 900, fontFamily: 'monospace', color: secondsRemaining < 120 ? '#dc2626' : '#0f172a', margin: '8px 0', lineHeight: 1 }}>
                {fmt(secondsRemaining)}
              </div>

              {/* Status Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontWeight: 800, fontSize: 14, border: `1px solid ${statusCfg.color}40`, marginBottom: 24 }}>
                {statusCfg.icon} {statusCfg.label} — {statusCfg.tip}
              </div>

              {/* Action Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                <button type="button" onClick={togglePause}
                  style={{ padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: sessionPaused ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sessionPaused ? <><FiPlay size={16} /> Resume</> : <><FiPause size={16} /> Pause</>}
                </button>

                {/* Tab Switch Exemption Real-Time Toggle */}
                <button type="button" onClick={() => setAllowTabSwitching(!allowTabSwitching)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: allowTabSwitching ? '#ecfdf5' : '#f0f9ff',
                    color: allowTabSwitching ? '#059669' : '#0284c7',
                    border: allowTabSwitching ? '1px solid #a7f3d0' : '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}>
                  {allowTabSwitching ? <><FiCheckCircle size={15} /> 📌 Reference Tabs Exempt</> : <><FiLock size={15} /> 🔒 Strict Tab Protection</>}
                </button>

                <button type="button" onClick={() => setShowEndModal(true)}
                  style={{ padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  End Session
                </button>
              </div>

              {/* Notes Scratchpad */}
              <div style={{ textAlign: 'left', borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>SESSION SCRATCHPAD</label>
                <textarea rows={2} placeholder="Jot down quick notes or formulas without leaving focus tab..."
                  value={notes} onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Telemetry Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Score Meter */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 6 }}>FOCUS SCORE</div>
                <div style={{ fontSize: 54, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{focusScore}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>out of 100</div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${focusScore}%`, background: scoreColor, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>

              {/* Session Signals (Accurate 3-State Display) */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiActivity size={14} color="#0284c7" /> Session Signals
                </h3>
                {[
                  {
                    name: 'Browser Tab',
                    status: allowTabSwitching ? 'Reference Tabs Exempt' : (!document.hidden ? 'Focused' : 'Distracted'),
                    state: allowTabSwitching ? 'OK' : (!document.hidden ? 'OK' : 'WARN')
                  },
                  {
                    name: 'Camera',
                    status: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable ? '— Disabled' : cameraSignalState.facePresent ? 'Face Detected' : 'No Face',
                    state: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable ? 'OFF' : cameraSignalState.facePresent ? 'OK' : 'WARN'
                  },
                  {
                    name: 'Attention',
                    status: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable ? '— Disabled' : cameraSignalState.headDirection === 'FORWARD' ? 'Forward' : 'Looking Away',
                    state: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable ? 'OFF' : cameraSignalState.headDirection === 'FORWARD' ? 'OK' : 'WARN'
                  },
                  {
                    name: 'Phone',
                    status: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable || detectionMode !== 'FULL MONITORING' ? '— Detection unavailable' : cameraSignalState.phoneDetected ? 'Phone Detected' : 'Not Detected',
                    state: !monSettings.cameraEnabled || !cameraSignalState.detectorAvailable || detectionMode !== 'FULL MONITORING' ? 'OFF' : cameraSignalState.phoneDetected ? 'WARN' : 'OK'
                  },
                  {
                    name: 'Activity',
                    status: inactiveSeconds < 60 ? 'Active' : 'Inactive',
                    state: inactiveSeconds < 60 ? 'OK' : 'WARN'
                  },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 12 }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontWeight: 800, color: s.state === 'OK' ? '#059669' : s.state === 'WARN' ? '#dc2626' : '#94a3b8' }}>
                      {s.state === 'OK' ? '✓ ' : s.state === 'WARN' ? '⚠ ' : ''}{s.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Distractions Breakdown */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>Distractions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>TAB SWITCHES</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: tabSwitchCount > 2 ? '#dc2626' : '#0f172a' }}>{tabSwitchCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>EPISODES</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: episodes.length > 2 ? '#dc2626' : '#0f172a' }}>{episodes.length}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>LOOKING AWAY</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: lookingAwayEvents > 0 ? '#dc2626' : '#0f172a' }}>{lookingAwayEvents}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>PHONE</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: phoneEvents > 0 ? '#dc2626' : '#0f172a' }}>{phoneEvents}</div>
                  </div>
                </div>

                <button type="button" onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                  style={{ width: '100%', marginTop: 12, background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 800, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {showDetailsPanel ? <FiChevronUp /> : <FiChevronDown />}
                  {showDetailsPanel ? 'Hide Details' : 'View Detection Details'}
                </button>

                {showDetailsPanel && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                    Window Blurs: {windowBlurCount}<br />
                    Fullscreen Exits: {fullscreenExitCount}<br />
                    Camera Away: {awayEvents}<br />
                    Possible Phone: {possiblePhoneEvents}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: RESULT PAGE ────────────────────────────────────────────── */}
      {sessionStage === 'COMPLETED' && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 40, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FiAward size={32} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>FOCUS SESSION COMPLETE</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
              Studied <strong>{subject}</strong>{topic ? ` — ${topic}` : ''} for <strong>{Math.round(elapsedSeconds / 60)} minutes</strong>.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>FOCUS SCORE</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor, marginTop: 6 }}>{focusScore}/100</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>FOCUSED TIME</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>{Math.round((elapsedSeconds - inactiveSeconds) / 60)} min</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>DISTRACTION EPISODES</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: episodes.length > 2 ? '#dc2626' : '#059669', marginTop: 6 }}>{episodes.length}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>TAB SWITCHES</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: tabSwitchCount > 2 ? '#dc2626' : '#059669', marginTop: 6 }}>{tabSwitchCount}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={resetSession}
              style={{ padding: '14px 28px', borderRadius: 12, background: '#0284c7', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer' }}>
              START NEW SESSION
            </button>
            <Link to="/college/study-tools/practice"
              style={{ padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
              START PRACTICE
            </Link>
            <Link to="/college/focus/analytics"
              style={{ padding: '14px 28px', borderRadius: 12, background: '#f1f5f9', color: '#334155', fontWeight: 800, fontSize: 14, border: '1px solid #e2e8f0', cursor: 'pointer', textDecoration: 'none' }}>
              VIEW ANALYTICS
            </Link>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showEndModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 420, borderRadius: 20, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FiAlertTriangle size={26} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>End this focus session?</h3>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
              Your session stats, focus score, and distraction episodes will be saved.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowEndModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 800, border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                Continue Session
              </button>
              <button type="button" onClick={confirmEndSession}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: '#dc2626', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, background: '#f8fafc', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }
