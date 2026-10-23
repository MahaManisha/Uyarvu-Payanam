import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import axios from 'axios'
import { io as socketIo } from 'socket.io-client'
import {
  FiZap, FiClock, FiCheckCircle, FiXCircle, FiAward, FiMessageSquare,
  FiArrowLeft, FiPlay, FiCheck, FiX, FiRefreshCw, FiBookOpen, FiSend,
  FiSliders, FiUser, FiHelpCircle, FiChevronRight, FiShield,
  FiTarget, FiTrendingUp
} from 'react-icons/fi'
import { SCard, SBtn, SBadge, SLoader } from '../../components/ui'

import { API_BASE_URL, SOCKET_BASE_URL } from '../../../config/apiConfig'

const API = API_BASE_URL
const SOCKET_URL = SOCKET_BASE_URL
const getToken = () => localStorage.getItem('studentToken')

export default function MultiplayerQuizPage() {
  const { sessionId } = useParams()
  const { student } = useStudentAuth()
  const { theme } = useCollegeTheme()
  const navigate = useNavigate()
  const myId = student?._id || student?.id

  // ── Session & Gameplay State ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [evalResult, setEvalResult] = useState(null) // Round result object from quiz:question-result
  const [lastSubmitFeedback, setLastSubmitFeedback] = useState(null)

  // ── Timers ──
  const [countdownNum, setCountdownNum] = useState(null)
  const [sessionTimeLeft, setSessionTimeLeft] = useState(1500)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(45)

  // ── Final Results & Review ──
  const [resultsData, setResultsData] = useState(null)
  const [reviewData, setReviewData] = useState(null)
  const [showReview, setShowReview] = useState(false)

  // ── Chat Panel ──
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')

  // ── Next Question Ready Controls ──
  const [nextQuestionReady, setNextQuestionReady] = useState(false)
  const [partnerNextQuestionReady, setPartnerNextQuestionReady] = useState(false)

  const socketRef = useRef(null)
  const chatEndRef = useRef(null)
  const headers = { Authorization: `Bearer ${getToken()}` }

  // ── Fetch Session Data ──
  const fetchSession = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/multiplayer-quiz/${sessionId}`, { headers })
      if (res.data?.success) {
        setSession(res.data.session)
        console.log(`[QUIZ UI] Loaded topic: ${res.data.session.topicLabel || res.data.session.topic}`)
        setCurrentQuestion(res.data.currentQuestion)
        setHasAnswered(res.data.hasAnsweredCurrent || false)

        if (res.data.currentQuestionResult) {
          console.log('[QUIZ UI] Current question round result loaded')
          setEvalResult(res.data.currentQuestionResult)
        }

        const readyUsers = res.data.session.nextQuestionReadyUsers || []
        const isMeReady = readyUsers.some(id => id.toString() === myId?.toString())
        const isOppReady = readyUsers.some(id => id.toString() !== myId?.toString())
        setNextQuestionReady(isMeReady)
        setPartnerNextQuestionReady(isOppReady)

        if (res.data.session.status === 'COMPLETED') {
          fetchResults()
        }
      } else {
        setError('Quiz session not found or unauthorized.')
      }
    } catch (err) {
      console.error('Fetch session error:', err)
      setError('Failed to load multiplayer quiz session.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, myId])

  const fetchResults = async () => {
    try {
      const res = await axios.get(`${API}/multiplayer-quiz/${sessionId}/results`, { headers })
      if (res.data?.success) {
        setResultsData(res.data)
      }
    } catch (err) {
      console.error('Fetch results error:', err)
    }
  }

  const fetchReview = async () => {
    try {
      const res = await axios.get(`${API}/multiplayer-quiz/${sessionId}/review`, { headers })
      if (res.data?.success) {
        setReviewData(res.data)
        setShowReview(true)
      }
    } catch (err) {
      console.error('Fetch review error:', err)
    }
  }

  // ── Socket.IO Connection ──
  useEffect(() => {
    if (!myId || !sessionId) return

    fetchSession()

    const socket = socketIo(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket

    const joinQuizRoom = () => {
      console.log(`[QUIZ CLIENT] Joining room quiz:${sessionId} for user ${myId}`)
      socket.emit('join_student', myId)
      socket.emit('quiz:join', { sessionId, userId: myId })
    }

    if (socket.connected) {
      joinQuizRoom()
    }
    socket.on('connect', joinQuizRoom)

    // Event Handlers
    socket.on('quiz:player-joined', () => {
      fetchSession()
    })

    socket.on('quiz:player-ready', ({ participants }) => {
      setSession(prev => prev ? { ...prev, participants } : prev)
    })

    socket.on('quiz:countdown', ({ seconds }) => {
      setSession(prev => prev ? { ...prev, status: 'COUNTDOWN' } : prev)
      setCountdownNum(seconds || 3)
      let c = seconds || 3
      const timer = setInterval(() => {
        c -= 1
        if (c > 0) {
          setCountdownNum(c)
        } else {
          clearInterval(timer)
          setCountdownNum('🚀 GO!')
          setTimeout(() => setCountdownNum(null), 1000)
        }
      }, 1000)
    })

    socket.on('quiz:started', ({ question, questionNumber }) => {
      console.log(`[QUIZ CLIENT] Quiz started! Rendering Question ${questionNumber || 1}`)
      setSession(prev => prev ? { ...prev, status: 'LIVE', currentQuestionIndex: 0 } : prev)
      setCurrentQuestion(question)
      setHasAnswered(false)
      setSelectedOption(null)
      setEvalResult(null)
      setLastSubmitFeedback(null)
      setNextQuestionReady(false)
      setPartnerNextQuestionReady(false)
      setQuestionTimeLeft(45)
    })

    socket.on('quiz:player-progress', ({ userId: pUserId, score, streak, status, answeredCount }) => {
      setSession(prev => {
        if (!prev) return prev
        const updated = prev.participants.map(p =>
          p.userId.toString() === pUserId.toString()
            ? { ...p, score, streak: streak !== undefined ? streak : p.streak, status, answeredCount }
            : p
        )
        return { ...prev, participants: updated }
      })
    })

    socket.on('quiz:question-result', (resData) => {
      console.log('[QUIZ CLIENT] Received question-result:', resData)
      setEvalResult(resData)
      if (resData.participants) {
        setSession(prev => prev ? { ...prev, participants: resData.participants } : prev)
      }
      const readyUsers = resData.nextQuestionReadyUsers || []
      setNextQuestionReady(readyUsers.some(id => id.toString() === myId?.toString()))
      setPartnerNextQuestionReady(readyUsers.some(id => id.toString() !== myId?.toString()))
    })

    socket.on('quiz:next-question-ready-update', ({ userId: rUserId, readyUsers }) => {
      console.log(`[QUIZ CLIENT] Received next-question-ready-update from ${rUserId}`)
      if (readyUsers) {
        setNextQuestionReady(readyUsers.some(id => id.toString() === myId?.toString()))
        setPartnerNextQuestionReady(readyUsers.some(id => id.toString() !== myId?.toString()))
      } else if (rUserId?.toString() === myId?.toString()) {
        setNextQuestionReady(true)
      } else {
        setPartnerNextQuestionReady(true)
      }
    })

    socket.on('quiz:next-question', (payload) => {
      console.log('[QUIZ CLIENT] Received next-question:', payload)
      const qNum = payload.questionNumber || ((payload.currentQuestionIndex ?? 0) + 1)
      setSession(prev => prev ? {
        ...prev,
        status: 'LIVE',
        currentQuestionIndex: qNum - 1,
        totalQuestions: payload.totalQuestions || prev.totalQuestions,
        participants: payload.participants || prev.participants
      } : prev)
      setCurrentQuestion(payload.question)
      setHasAnswered(false)
      setSelectedOption(null)
      setEvalResult(null)
      setLastSubmitFeedback(null)
      setNextQuestionReady(false)
      setPartnerNextQuestionReady(false)
      setQuestionTimeLeft(45)
    })

    socket.on('quiz:completed', (resData) => {
      console.log('[QUIZ CLIENT] Quiz Completed:', resData)
      setSession(prev => prev ? { ...prev, status: 'COMPLETED' } : prev)
      fetchResults()
    })

    socket.on('quiz:ended', ({ message }) => {
      alert(message || 'The quiz session was ended.')
      navigate('/college/peer-chat')
    })

    socket.on('quiz:chat-message', (msg) => {
      setChatMessages(prev => [...prev, msg])
    })

    return () => {
      socket.emit('quiz:leave', { sessionId, userId: myId })
      socket.disconnect()
    }
  }, [sessionId, myId, fetchSession])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, showChat])

  // Countdown timer for session and per-question limit
  useEffect(() => {
    if (session?.status !== 'LIVE') return
    const timer = setInterval(() => {
      setSessionTimeLeft(prev => Math.max(0, prev - 1))
      setQuestionTimeLeft(prev => {
        const nextVal = Math.max(0, prev - 1)
        if (nextVal === 0 && prev > 0) {
          console.log('[QUIZ CLIENT] Timer expired! Enforcing question timeout...')
          if (socketRef.current) {
            socketRef.current.emit('quiz:timeout', { sessionId })
          }
          axios.post(`${API}/multiplayer-quiz/${sessionId}/timeout`, {}, { headers }).catch(() => {})
        }
        return nextVal
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [session?.status, sessionId])

  // ── Gameplay Actions ──
  const handleSetReady = async () => {
    try {
      const res = await axios.post(`${API}/multiplayer-quiz/${sessionId}/ready`, {}, { headers })
      if (res.data?.success) {
        setSession(res.data.session)
      }
    } catch (err) {
      console.error('Set ready error:', err)
    }
  }

  const handleSelectAnswer = async (optId) => {
    if (hasAnswered || (session?.status !== 'LIVE' && session?.status !== 'WAITING_FOR_NEXT') || !currentQuestion) return
    setSelectedOption(optId)
    setHasAnswered(true)

    // Calculate quick feedback badge
    const elapsedSec = 45 - questionTimeLeft
    if (elapsedSec <= 5) {
      setLastSubmitFeedback('⚡ LIGHTNING ANSWER!')
    } else {
      setLastSubmitFeedback('✓ Answer submitted!')
    }

    try {
      const res = await axios.post(`${API}/multiplayer-quiz/${sessionId}/answer`, {
        questionId: currentQuestion.questionId,
        questionIndex: session.currentQuestionIndex,
        selectedOption: optId,
        responseTime: elapsedSec * 1000
      }, { headers })

      if (res.data?.evaluated) {
        const ev = res.data.evaluated
        if (ev.isCorrect && elapsedSec <= 5) {
          setLastSubmitFeedback('⚡🎯 LIGHTNING PERFECT!')
        } else if (ev.isCorrect) {
          setLastSubmitFeedback('🎯 PERFECT!')
        }
      }
    } catch (err) {
      console.error('Submit answer error:', err)
    }
  }

  const handleNextQuestionReady = async () => {
    if (nextQuestionReady) return
    setNextQuestionReady(true)

    if (socketRef.current) {
      socketRef.current.emit('quiz:next-question-ready', {
        sessionId,
        userId: myId,
        questionId: currentQuestion?.questionId
      })
    }

    try {
      await axios.post(`${API}/multiplayer-quiz/${sessionId}/next-ready`, {
        questionId: currentQuestion?.questionId
      }, { headers })
    } catch (err) {
      console.error('Next question ready error:', err)
    }
  }

  const handleSendChat = () => {
    if (!chatInput.trim() || !socketRef.current) return
    socketRef.current.emit('quiz:chat', {
      sessionId,
      userId: myId,
      senderName: student?.name || 'Student',
      message: chatInput.trim()
    })
    setChatInput('')
  }

  const handleEndQuiz = async () => {
    if (!window.confirm('Are you sure you want to end this multiplayer quiz session for both players?')) return
    try {
      await axios.post(`${API}/multiplayer-quiz/${sessionId}/end`, {}, { headers })
      navigate('/college/peer-chat')
    } catch (err) {
      console.error('End quiz error:', err)
      alert('Failed to end quiz session.')
    }
  }

  if (loading) {
    return (
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <SLoader />
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--s-text3)' }}>
          🎮 Connecting to Synchronized Multiplayer Battle Arena...
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center' }}>
        <SCard style={{ padding: 36, borderRadius: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 10px' }}>Quiz Session Unavailable</h2>
          <p style={{ fontSize: 14, color: 'var(--s-text3)', margin: '0 0 20px' }}>{error || 'Could not load quiz session.'}</p>
          <SBtn variant="primary" onClick={() => navigate('/college/peer-chat')}>Return to Peer Chat</SBtn>
        </SCard>
      </div>
    )
  }

  const me = session.participants?.find(p => p.userId.toString() === myId?.toString())
  const opponent = session.participants?.find(p => p.userId.toString() !== myId?.toString())

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // ── RENDER LOBBY / WAITING ROOM ──
  if (session.status === 'WAITING' || session.status === 'READY' || countdownNum !== null) {
    const isMeReady = me?.status === 'READY'
    const isOpponentReady = opponent?.status === 'READY'

    return (
      <div style={{ maxWidth: 680, margin: '40px auto', textAlign: 'center' }} className="s-anim-up">
        {/* COUNTDOWN OVERLAY */}
        {countdownNum !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', color: '#fff', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 100, fontWeight: 900, color: '#38bdf8', textShadow: '0 0 30px rgba(56,189,248,0.5)', animation: 'pop 0.5s ease' }}>
              {countdownNum}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#93c5fd', marginTop: 16 }}>
              ⚔️ Synchronizing Battle with {opponent?.name || 'Opponent'}...
            </div>
          </div>
        )}

        <SCard style={{ padding: 40, borderRadius: 28, border: '2px solid #818cf8', boxShadow: '0 16px 40px rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎮</div>
          <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '6px 16px', borderRadius: 16, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Multiplayer Study Battle
          </span>

          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--s-text)', margin: '14px 0 6px' }}>
            {session.topicLabel || session.topic}
          </h1>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-primary)', marginBottom: 24 }}>
            Topic: {session.topicLabel || session.topic} • {session.totalQuestions} Questions • {Math.round(session.durationSeconds / 60)} Mins
          </div>

          {/* PLAYERS LOBBY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            <div style={{ background: isMeReady ? '#ecfdf5' : '#f8fafc', border: isMeReady ? '2px solid #059669' : '1px solid #cbd5e1', padding: 24, borderRadius: 22, transition: 'all 0.3s' }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>👑</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)' }}>You ({me?.name || 'Student'})</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: isMeReady ? '#059669' : '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isMeReady ? <><FiCheckCircle size={16} /> READY TO BATTLE</> : '● Click Ready when prepared'}
              </div>
            </div>

            <div style={{ background: isOpponentReady ? '#ecfdf5' : '#f8fafc', border: isOpponentReady ? '2px solid #059669' : '1px solid #cbd5e1', padding: 24, borderRadius: 22, transition: 'all 0.3s' }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>👤</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)' }}>{opponent?.name || 'Study Partner'}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: isOpponentReady ? '#059669' : '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isOpponentReady ? <><FiCheckCircle size={16} /> READY TO BATTLE</> : '⏳ Waiting for partner...'}
              </div>
            </div>
          </div>

          {!isMeReady ? (
            <SBtn variant="primary" onClick={handleSetReady} style={{ width: '100%', padding: '16px 28px', borderRadius: 18, fontSize: 16, fontWeight: 900, background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', boxShadow: '0 6px 20px rgba(79,70,229,0.3)' }}>
              <FiCheck size={20} style={{ marginRight: 8 }} /> Click to Set Ready
            </SBtn>
          ) : (
            <div style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '16px 24px', borderRadius: 18, fontSize: 15, fontWeight: 800 }}>
              ✓ You are ready! Synchronizing game start...
            </div>
          )}

          <button type="button" onClick={handleEndQuiz} style={{ width: '100%', marginTop: 16, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '12px 20px', borderRadius: 16, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            🛑 End Quiz Session
          </button>
        </SCard>
      </div>
    )
  }

  // ── RENDER REVIEW MODE ──
  if (showReview && reviewData) {
    return (
      <div style={{ maxWidth: 880, margin: '20px auto' }} className="s-anim-up">
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setShowReview(false)} style={{ background: 'none', border: 'none', color: 'var(--s-primary)', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiArrowLeft size={16} /> Back to Leaderboard
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>
            📖 Quiz Answer Review — {reviewData.topic}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviewData.reviewItems?.map(item => (
            <SCard key={item.questionIndex} style={{ padding: 24, borderRadius: 20, borderLeft: item.isCorrect ? '5px solid #059669' : '5px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: item.isCorrect ? '#059669' : '#dc2626' }}>
                  {item.isCorrect ? '✓ CORRECT' : '✕ INCORRECT'} • Question {item.questionIndex}
                </span>
                <span style={{ fontSize: 13, color: 'var(--s-text3)', fontWeight: 800 }}>Your Selected: {item.userAnswer}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', marginBottom: 12 }}>
                {item.questionText}
              </div>

              <div style={{ background: '#ecfdf5', color: '#047857', padding: 12, borderRadius: 14, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                💡 <strong>Correct Answer ({item.correctAnswer}):</strong> {item.options?.find(o => o.id === item.correctAnswer)?.text || item.correctAnswer}
              </div>

              <div style={{ fontSize: 13, color: 'var(--s-text2)', fontStyle: 'italic', lineHeight: 1.5 }}>
                Explanation: {item.explanation}
              </div>
            </SCard>
          ))}
        </div>
      </div>
    )
  }

  // ── RENDER COMPLETED RESULTS SCREEN ──
  if (session.status === 'COMPLETED' && resultsData) {
    const winnerId = resultsData.winnerId
    const isTie = resultsData.isTie
    const isWinner = winnerId?.toString() === myId?.toString()
    const myResult = resultsData.results?.find(r => r.userId?.toString() === myId?.toString())
    const oppResult = resultsData.results?.find(r => r.userId?.toString() !== myId?.toString())

    return (
      <div style={{ maxWidth: 880, margin: '30px auto' }} className="s-anim-up">
        <SCard style={{ padding: 40, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
          <span style={{ background: '#d1fae5', color: '#047857', padding: '6px 18px', borderRadius: 16, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MULTIPLAYER STUDY BATTLE COMPLETE
          </span>

          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--s-text)', margin: '12px 0 6px' }}>
            {resultsData.topicLabel || resultsData.topic || session.topic}
          </h1>

          {/* WINNER BANNER */}
          <div style={{ background: isTie ? '#fef3c7' : isWinner ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: isTie ? '#92400e' : '#fff', padding: '16px 28px', borderRadius: 20, margin: '20px auto 32px', maxWidth: 500, fontWeight: 900, fontSize: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            {isTie ? '⚔️ TIED BATTLE!' : isWinner ? `🏆 WINNER: ${myResult?.name?.toUpperCase()} (+${myResult?.totalScore || 0} XP)` : `👑 WINNER: ${oppResult?.name?.toUpperCase()} (+${oppResult?.totalScore || 0} XP)`}
          </div>

          {/* PERFORMANCE COMPARISON CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
            {/* MY PERFORMANCE */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#fff', padding: 26, borderRadius: 24, textTransform: 'none', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>👑 YOU ({myResult?.name})</span>
                {isWinner && <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>WINNER</span>}
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>
                {myResult?.totalScore || 0} <span style={{ fontSize: 16, color: '#93c5fd' }}>XP</span>
              </div>

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🎯 Accuracy:</span> <strong>{myResult?.accuracy || 0}%</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>✓ Correct Answers:</span> <strong>{myResult?.correctAnswers || 0} / {session.totalQuestions}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>⚡ Average Speed:</span> <strong>{myResult?.averageResponseTime || 0} sec</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🔥 Best Streak:</span> <strong>{myResult?.bestStreak || 0}</strong></div>
              </div>

              {/* BADGES */}
              {myResult?.badges?.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {myResult.badges.map((b, i) => (
                    <span key={i} style={{ background: 'rgba(56,189,248,0.2)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.4)', padding: '4px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800 }}>
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* OPPONENT PERFORMANCE */}
            <div style={{ background: '#f8fafc', color: 'var(--s-text)', padding: 26, borderRadius: 24, border: '1px solid #cbd5e1', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>👤 {oppResult?.name || 'Opponent'}</span>
                {!isWinner && !isTie && <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>WINNER</span>}
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--s-text)' }}>
                {oppResult?.totalScore || 0} <span style={{ fontSize: 16, color: '#64748b' }}>XP</span>
              </div>

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--s-text2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🎯 Accuracy:</span> <strong>{oppResult?.accuracy || 0}%</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>✓ Correct Answers:</span> <strong>{oppResult?.correctAnswers || 0} / {session.totalQuestions}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>⚡ Average Speed:</span> <strong>{oppResult?.averageResponseTime || 0} sec</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🔥 Best Streak:</span> <strong>{oppResult?.bestStreak || 0}</strong></div>
              </div>

              {/* BADGES */}
              {oppResult?.badges?.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {oppResult.badges.map((b, i) => (
                    <span key={i} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800 }}>
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <SBtn variant="primary" onClick={fetchReview} style={{ padding: '14px 28px', borderRadius: 16, fontSize: 15, fontWeight: 900 }}>
              <FiBookOpen size={18} style={{ marginRight: 8 }} /> Review Question Breakdown
            </SBtn>
            <Link to="/college/study-tools/practice" style={{ textDecoration: 'none' }}>
              <button type="button" style={{ background: '#ede9fe', color: '#6d28d9', border: 'none', padding: '14px 28px', borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiZap size={18} /> Practice Weak Areas
              </button>
            </Link>
            <button type="button" onClick={() => navigate('/college/peer-chat')} style={{ background: 'var(--s-surface2)', border: '1px solid var(--s-border)', color: 'var(--s-text)', padding: '14px 28px', borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
              Return to Peer Chat
            </button>
          </div>
        </SCard>
      </div>
    )
  }

  // ── RENDER REAL-TIME BATTLE GAMEPLAY ──
  const myScore = me?.score || 0
  const oppScore = opponent?.score || 0
  const myStreak = me?.streak || 0
  const oppStreak = opponent?.streak || 0

  const isAhead = myScore > oppScore
  const isTied = myScore === oppScore

  const progressPercent = Math.round(((session.currentQuestionIndex + (evalResult ? 1 : 0)) / session.totalQuestions) * 100)

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', display: 'flex', gap: 20 }} className="s-anim-up">
      {/* MAIN BATTLE ARENA */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 🎮 HEADER BAR */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#fff', padding: '20px 26px', borderRadius: 24, marginBottom: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                🎮 MULTIPLAYER STUDY BATTLE
              </span>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: '2px 0 0', color: '#fff' }}>
                {session.topicLabel || session.topic}
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 14, fontSize: 13, fontWeight: 800, color: '#93c5fd' }}>
                Question {session.currentQuestionIndex + 1} / {session.totalQuestions}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 14, fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
                ⏱ {formatTime(sessionTimeLeft)}
              </div>
              <button type="button" onClick={() => setShowChat(v => !v)} style={{ background: '#4338ca', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                💬 Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
              </button>
              <button type="button" onClick={handleEndQuiz} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                🛑 End
              </button>
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div style={{ background: 'rgba(255,255,255,0.15)', height: 8, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* ⚔️ LIVE PLAYER SCORE CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* YOU CARD */}
          <div style={{ background: '#fff', border: isAhead ? '2px solid #3b82f6' : '1px solid #cbd5e1', borderRadius: 20, padding: 18, boxShadow: isAhead ? '0 4px 16px rgba(59,130,246,0.15)' : 'none', position: 'relative' }}>
            {isAhead && !isTied && (
              <span style={{ position: 'absolute', top: -10, right: 16, background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 10px', borderRadius: 10 }}>
                🚀 YOU TOOK THE LEAD!
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>👑 YOU ({me?.name})</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--s-primary)' }}>{myScore} <span style={{ fontSize: 13, color: '#64748b' }}>XP</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {myStreak > 0 && (
                  <div style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 900 }}>
                    🔥 {myStreak} Streak
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OPPONENT CARD */}
          <div style={{ background: '#fff', border: !isAhead && !isTied ? '2px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: 20, padding: 18, position: 'relative' }}>
            {!isAhead && !isTied && (
              <span style={{ position: 'absolute', top: -10, right: 16, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 10px', borderRadius: 10 }}>
                👑 IN THE LEAD
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>👤 {opponent?.name || 'Opponent'}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--s-text)' }}>{oppScore} <span style={{ fontSize: 13, color: '#64748b' }}>XP</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {oppStreak > 0 && (
                  <div style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 900 }}>
                    🔥 {oppStreak} Streak
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ❓ QUESTION CARD */}
        {currentQuestion && (
          <SCard style={{ padding: 32, borderRadius: 26, marginBottom: 20 }}>

            {/* PER-QUESTION TIMING COUNTDOWN */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>
                {currentQuestion.difficulty ? `${currentQuestion.difficulty} QUESTION` : 'MEDIUM QUESTION'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: questionTimeLeft <= 10 ? '#dc2626' : '#64748b' }}>
                ⏱ {questionTimeLeft} sec remaining
              </span>
            </div>

            <div style={{ background: '#f1f5f9', height: 6, borderRadius: 99, marginBottom: 24, overflow: 'hidden' }}>
              <div style={{ width: `${(questionTimeLeft / 45) * 100}%`, height: '100%', background: questionTimeLeft <= 10 ? '#dc2626' : 'var(--s-primary)', transition: 'width 1s linear' }} />
            </div>

            {/* QUESTION TEXT */}
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--s-text)', marginBottom: 26, lineHeight: 1.5 }}>
              Q{session.currentQuestionIndex + 1}. {currentQuestion.questionText}
            </div>

            {/* OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {currentQuestion.options?.map((opt) => {
                const isSelected = selectedOption === opt.id
                const isCorrectOpt = evalResult?.correctOption === opt.id
                const isWrongOpt = evalResult && isSelected && !isCorrectOpt

                let bg = '#fff'
                let border = '1px solid var(--s-border)'
                let textCol = 'var(--s-text)'

                if (evalResult) {
                  if (isCorrectOpt) {
                    bg = '#d1fae5'; border = '2px solid #059669'; textCol = '#047857'
                  } else if (isWrongOpt) {
                    bg = '#fee2e2'; border = '2px solid #dc2626'; textCol = '#b91c1c'
                  }
                } else if (isSelected) {
                  bg = '#eff6ff'; border = '2px solid var(--s-primary)'; textCol = 'var(--s-primary)'
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={hasAnswered}
                    onClick={() => handleSelectAnswer(opt.id)}
                    style={{
                      padding: '16px 22px', borderRadius: 18, textAlign: 'left',
                      background: bg, border, color: textCol,
                      fontSize: 15, fontWeight: 800, cursor: hasAnswered ? 'default' : 'pointer',
                      transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <span><strong>{opt.id}.</strong> {opt.text}</span>
                    {evalResult && isCorrectOpt && <FiCheckCircle color="#059669" size={22} />}
                    {evalResult && isWrongOpt && <FiXCircle color="#dc2626" size={22} />}
                  </button>
                )
              })}
            </div>

            {/* INSTANT ANSWER SUBMITTED FEEDBACK BADGE */}
            {hasAnswered && !evalResult && (
              <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: 14, borderRadius: 16, fontSize: 14, fontWeight: 800, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <FiCheckCircle size={18} color="#059669" />
                <span>{lastSubmitFeedback || '✓ Answer submitted!'} Waiting for {opponent?.name || 'partner'}...</span>
              </div>
            )}

            {/* SYNCHRONIZED ROUND RESULT PANEL */}
            {evalResult && (
              <div style={{ background: '#f8fafc', padding: 24, borderRadius: 22, border: '2px solid #6366f1', marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#4338ca', background: '#e0e7ff', padding: '6px 14px', borderRadius: 14, textTransform: 'uppercase' }}>
                    🎯 QUESTION {session.currentQuestionIndex + 1} COMPLETE
                  </span>
                  {partnerNextQuestionReady && !nextQuestionReady && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '4px 14px', borderRadius: 12 }}>
                      ✓ {opponent?.name || 'Partner'} is ready!
                    </span>
                  )}
                </div>

                {/* MY DETAILED SCORE BREAKDOWN */}
                {(() => {
                  const myRes = evalResult.results?.find(r => r.userId?.toString() === myId?.toString())
                  const oppRes = evalResult.results?.find(r => r.userId?.toString() !== myId?.toString())

                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                        {/* MY SCORE CARD */}
                        <div style={{ background: myRes?.isCorrect ? '#ecfdf5' : '#fef2f2', border: myRes?.isCorrect ? '2px solid #059669' : '2px solid #dc2626', padding: 16, borderRadius: 16 }}>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>Your Answer: <strong>{myRes?.selectedOption || selectedOption || 'N/A'}</strong></div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: myRes?.isCorrect ? '#059669' : '#dc2626', margin: '4px 0 8px' }}>
                            {myRes?.isCorrect ? `✓ Correct (+${myRes?.totalPoints || 100} XP)` : '✕ Incorrect (+0 XP)'}
                          </div>

                          {/* SCORE BREAKDOWN DETAILS */}
                          {myRes?.isCorrect && (
                            <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span>Base: +{myRes.basePoints || 100}</span>
                              {myRes.speedBonus > 0 && <span>• Speed: +{myRes.speedBonus}⚡</span>}
                              {myRes.difficultyBonus > 0 && <span>• Diff: +{myRes.difficultyBonus}</span>}
                              {myRes.streakBonus > 0 && <span>• Streak: +{myRes.streakBonus}🔥</span>}
                            </div>
                          )}
                        </div>

                        {/* OPPONENT SCORE CARD */}
                        <div style={{ background: oppRes?.isCorrect ? '#ecfdf5' : '#fef2f2', border: oppRes?.isCorrect ? '2px solid #059669' : '2px solid #dc2626', padding: 16, borderRadius: 16 }}>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{opponent?.name || 'Partner'} Answer: <strong>{oppRes?.selectedOption || 'N/A'}</strong></div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: oppRes?.isCorrect ? '#059669' : '#dc2626', margin: '4px 0 8px' }}>
                            {oppRes?.isCorrect ? `✓ Correct (+${oppRes?.totalPoints || 100} XP)` : '✕ Incorrect (+0 XP)'}
                          </div>

                          {oppRes?.isCorrect && (
                            <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span>Base: +{oppRes.basePoints || 100}</span>
                              {oppRes.speedBonus > 0 && <span>• Speed: +{oppRes.speedBonus}⚡</span>}
                              {oppRes.difficultyBonus > 0 && <span>• Diff: +{oppRes.difficultyBonus}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CORRECT OPTION & EXPLANATION */}
                      <div style={{ background: '#ecfdf5', color: '#047857', padding: 16, borderRadius: 16, fontSize: 14, fontWeight: 800, marginBottom: 20 }}>
                        <div>✓ Correct Answer: <strong>{evalResult.correctOption}</strong> — {currentQuestion?.options?.find(o => o.id === evalResult.correctOption)?.text || ''}</div>
                        {evalResult.explanation && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginTop: 6, fontStyle: 'italic' }}>
                            💡 Explanation: {evalResult.explanation}
                          </div>
                        )}
                      </div>

                      {/* NEXT QUESTION BUTTON CONTROL */}
                      <div style={{ textAlign: 'center', marginTop: 14 }}>
                        {nextQuestionReady ? (
                          <div style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '16px 28px', borderRadius: 18, fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <FiCheckCircle size={20} color="#2563eb" />
                            ✓ Ready for next question — Waiting for {opponent?.name || 'partner'}...
                          </div>
                        ) : (
                          <SBtn
                            variant="primary"
                            onClick={handleNextQuestionReady}
                            style={{ padding: '16px 40px', borderRadius: 18, fontSize: 16, fontWeight: 900, cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', boxShadow: '0 6px 20px rgba(79,70,229,0.35)' }}
                          >
                            {session.currentQuestionIndex + 1 >= session.totalQuestions ? 'VIEW FINAL RESULTS →' : 'NEXT QUESTION →'}
                          </SBtn>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </SCard>
        )}
      </div>

      {/* SIDE STUDY CHAT PANEL */}
      {showChat && (
        <div style={{ width: 290, background: '#fff', borderRadius: 24, border: '1px solid var(--s-border)', padding: 18, display: 'flex', flexDirection: 'column', flexShrink: 0, height: 540 }} className="s-anim-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--s-text)' }}>💬 In-Quiz Battle Chat</span>
            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={18} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ background: m.userId === myId ? '#eff6ff' : '#f8fafc', border: m.userId === myId ? '1px solid #bfdbfe' : '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 12, fontSize: 13 }}>
                <strong style={{ color: 'var(--s-primary)' }}>{m.senderName}: </strong>
                <span>{m.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="Chat with partner..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendChat() }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--s-border)', fontSize: 13 }}
            />
            <button onClick={handleSendChat} style={{ background: 'var(--s-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>
              <FiSend size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
