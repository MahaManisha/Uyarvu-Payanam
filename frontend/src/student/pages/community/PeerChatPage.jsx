/**
 * PeerChatPage.jsx
 *
 * Real-time peer chat for college students.
 * Uses existing Socket.io infrastructure (join_student / user_<id> room).
 * Connects to new /api/peer-chat backend endpoints.
 *
 * Features:
 * - Discover other college students (search by name, subject, skills, year)
 * - Open/create direct conversations
 * - Real-time messaging via Socket.io (peer:message event)
 * - Typing indicators via Socket.io (peer:typing event)
 * - Study session invitations (study_invite message type)
 * - Find Study Partner quick action
 * - Unread message counts
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import axios from 'axios'
import { io as socketIo } from 'socket.io-client'
import {
  FiSearch, FiSend, FiUsers, FiMessageSquare, FiX, FiClock, FiTarget,
  FiZap, FiBookOpen, FiChevronRight, FiUser, FiCheck, FiCheckCircle,
  FiArrowLeft, FiPlus
} from 'react-icons/fi'

import { API_BASE_URL, SOCKET_BASE_URL } from '../../../config/apiConfig'

const API        = API_BASE_URL
const SOCKET_URL = SOCKET_BASE_URL
const getToken   = () => localStorage.getItem('studentToken')

// ── Quick action templates ───────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: '❓ Ask about a subject', text: 'Hey! Can you help me with something about' },
  { label: '🤝 Discuss a project',   text: "I'm working on a project and wanted to discuss" },
  { label: '💼 Interview practice',  text: "Want to do a quick mock interview / discuss interview questions?" },
  { label: '📚 Share resources',     text: "I found a great resource for studying — want to share?" },
  { label: '🧑‍🤝‍🧑 Find study partner', text: "Want to study together?" },
]

function timeAgo(dateStr) {
  const d    = new Date(dateStr)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)        return 'just now'
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

function getRawId(val) {
  if (!val) return ''
  if (typeof val === 'object') {
    return (val._id || val.id || '').toString()
  }
  return String(val)
}

// ── Study Invite Banner ───────────────────────────────────────────────────────
function StudyInviteBanner({ msg, myId, onRespond, isLatest }) {
  const isMe = getRawId(msg.senderId) === getRawId(myId)
  const rawStatus = String(msg.studyInvite?.status || 'PENDING').toUpperCase()
  const sessionId = msg.studyInvite?.sessionId
  const [accepting, setAccepting] = useState(false)

  const isEnded = rawStatus === 'ENDED' || rawStatus === 'CANCELLED'
  const isPending = rawStatus === 'PENDING' && !isEnded
  const isAccepted = (rawStatus === 'ACCEPTED' || rawStatus === 'QUIZ_CREATED' || rawStatus === 'IN_PROGRESS') && !isEnded
  const isDeclined = rawStatus === 'DECLINED' && !isEnded
  const isFailed = rawStatus === 'QUIZ_CREATION_FAILED' && !isEnded

  const senderName = typeof msg.senderId === 'object' ? (msg.senderId?.name || 'Peer') : 'Peer'

  return (
    <div style={{ background: 'linear-gradient(135deg,#7c3aed11,#6366f111)', border: '1px solid #a5b4fc', borderRadius: 14, padding: '14px 18px', margin: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <FiTarget size={16} color="#7c3aed" />
        <strong style={{ fontSize: 13, color: '#4f46e5' }}>Multiplayer Study Invite</strong>

        {/* Status Badge */}
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 10,
          color: isEnded ? '#64748b' : isAccepted ? '#059669' : isDeclined ? '#dc2626' : isFailed ? '#d97706' : '#6366f1',
          background: isEnded ? '#f1f5f9' : isAccepted ? '#ecfdf5' : isDeclined ? '#fef2f2' : isFailed ? '#fffbeb' : '#eef2ff'
        }}>
          {isEnded ? '🛑 Quiz Ended' : isAccepted ? '✓ Quiz Created' : isDeclined ? '✕ Declined' : isFailed ? '⚠ Creation Failed' : '⏳ Pending'}
        </span>
      </div>

      <div style={{ fontSize: 13, color: '#374151' }}>
        {!isMe && isPending && <div style={{ color: '#4f46e5', fontWeight: 700, marginBottom: 4 }}>{senderName} invited you to study:</div>}
        📚 <strong>{msg.studyInvite?.subject || 'Study Session'}</strong>
        {msg.studyInvite?.goal && <span style={{ color: '#6b7280' }}> — {msg.studyInvite.goal}</span>}
        <span style={{ color: '#9ca3af' }}> ({msg.studyInvite?.durationMinutes || 25} min)</span>
      </div>

      {/* SENDER VIEW */}
      {isMe && isPending && isLatest && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⏳</span> Waiting for study partner to accept…
        </div>
      )}

      {/* RECEIVER VIEW */}
      {!isMe && isPending && isLatest && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            disabled={accepting}
            onClick={async () => {
              setAccepting(true)
              await onRespond(msg._id, 'accepted')
            }}
            style={{
              padding: '8px 18px', borderRadius: 10, background: accepting ? '#94a3b8' : '#059669',
              color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: accepting ? 'wait' : 'pointer'
            }}
          >
            {accepting ? 'Creating your study game...' : '✓ Accept & Launch Quiz'}
          </button>
          <button
            disabled={accepting}
            onClick={() => onRespond(msg._id, 'declined')}
            style={{ padding: '8px 18px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 13, border: '1px solid #e2e8f0', cursor: 'pointer' }}
          >
            Decline
          </button>
        </div>
      )}

      {/* ACTION FOR ACCEPTED / QUIZ_CREATED SESSION (LATEST ACTIVE INVITE ONLY) */}
      {isAccepted && isLatest && (
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => onRespond(getRawId(msg._id), 'join', sessionId)}
            style={{ padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🎯 Join Multiplayer Quiz Room →
          </button>
          <button onClick={() => onRespond(getRawId(msg._id), 'end', sessionId)}
            style={{ padding: '8px 16px', borderRadius: 10, background: '#fee2e2', color: '#b91c1c', fontWeight: 800, fontSize: 13, border: '1px solid #fca5a5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🛑 End Quiz
          </button>
        </div>
      )}

      {/* PREVIOUS SUPERSEEDED SESSION VIEW */}
      {isAccepted && !isLatest && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', fontWeight: 600, fontStyle: 'italic' }}>
          ✓ Previous quiz session (superseded)
        </div>
      )}

      {/* ENDED SESSION VIEW */}
      {isEnded && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🛑</span> This study quiz session has been ended.
        </div>
      )}
    </div>
  )
}

export default function PeerChatPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { student } = useStudentAuth()
  const { theme }   = useCollegeTheme()
  const myId = student?._id || student?.id

  // ── State ─────────────────────────────────────────────────────────────────
  const [conversations,    setConversations]    = useState([])
  const [activeConvo,      setActiveConvo]      = useState(null) // { _id, peerId, peerName }
  const [messages,         setMessages]         = useState([])
  const [input,            setInput]            = useState('')
  const [sending,          setSending]          = useState(false)
  const [peerTyping,       setPeerTyping]       = useState(false)
  const [loadingConvos,    setLoadingConvos]    = useState(true)
  const [loadingMsgs,      setLoadingMsgs]      = useState(false)

  // Discover students
  const [showDiscover,     setShowDiscover]     = useState(false)
  const [discoverStudents, setDiscoverStudents] = useState([])
  const [discoverQuery,    setDiscoverQuery]    = useState('')
  const [loadingDiscover,  setLoadingDiscover]  = useState(false)

  // Study invite modal
  const [showInviteModal,  setShowInviteModal]  = useState(false)
  const [inviteSubject,    setInviteSubject]    = useState('')
  const [inviteGoal,       setInviteGoal]       = useState('')
  const [inviteDuration,   setInviteDuration]   = useState(25)

  const socketRef      = useRef(null)
  const messagesEndRef = useRef(null)
  const typingTimerRef = useRef(null)

  const headers = { Authorization: `Bearer ${getToken()}` }

  // ── Socket.io setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    const socket = socketIo(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_student', myId)
    })

    // Incoming message
    socket.on('peer:message', ({ conversationId, message }) => {
      if (activeConvoRef.current?._id === conversationId) {
        setMessages(prev => [...prev, message])
      }
      // Update conversation list unread / last message
      setConversations(prev => prev.map(c =>
        c._id === conversationId
          ? { ...c, lastMessage: message.content?.substring(0,80), lastMessageAt: message.createdAt, unreadCount: activeConvoRef.current?._id === conversationId ? 0 : (c.unreadCount || 0) + 1 }
          : c
      ))
    })

    // Typing indicator
    socket.on('peer:typing', ({ conversationId }) => {
      if (activeConvoRef.current?._id === conversationId) {
        setPeerTyping(true)
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setPeerTyping(false), 2500)
      }
    })

    // Study invite real-time socket handler
    const handleQuizCreated = (payload) => {
      console.log('[PEER CHAT] Received socket event study:quiz-created / study:accepted:', payload)
      const targetId = getRawId(payload.inviteId || payload.messageId)
      console.log(`[PEER CHAT] Target Invite ID: ${targetId} | SessionId: ${payload.sessionId}`)

      setMessages(prev => prev.map(m => {
        const isMatch = getRawId(m._id) === targetId ||
          (m.type === 'study_invite' && getRawId(m.conversationId) === getRawId(payload.conversationId) && (m.studyInvite?.status === 'pending' || m.studyInvite?.status === 'PENDING'))

        if (isMatch) {
          console.log('[PEER CHAT] Updating matching study invite message to status: QUIZ_CREATED')
          return {
            ...m,
            studyInvite: {
              ...m.studyInvite,
              status: 'QUIZ_CREATED',
              sessionId: payload.sessionId
            }
          }
        }
        return m
      }))
    }

    const handleQuizEnded = (payload) => {
      console.log('[PEER CHAT] Received socket event study:ended / quiz:ended:', payload)
      const targetInviteId = getRawId(payload.inviteId)
      const targetSessionId = payload.sessionId

      setMessages(prev => prev.map(m => {
        const isMatch = (targetInviteId && getRawId(m._id) === targetInviteId) ||
          (targetSessionId && m.studyInvite?.sessionId === targetSessionId)
        if (isMatch) {
          return {
            ...m,
            studyInvite: {
              ...m.studyInvite,
              status: 'ended'
            }
          }
        }
        return m
      }))
    }

    socket.on('study:accepted', handleQuizCreated)
    socket.on('study:quiz-created', handleQuizCreated)
    socket.on('quiz:session-created', handleQuizCreated)

    socket.on('study:ended', handleQuizEnded)
    socket.on('quiz:ended', handleQuizEnded)

    socket.on('study:declined', ({ conversationId, messageId }) => {
      console.log('[PEER CHAT] Received study:declined for messageId:', messageId)
      const targetId = getRawId(messageId)
      setMessages(prev => prev.map(m =>
        getRawId(m._id) === targetId ? { ...m, studyInvite: { ...m.studyInvite, status: 'DECLINED' } } : m
      ))
    })

    return () => { socket.disconnect() }
  }, [myId, navigate])

  // Ref to current active conversation (needed inside socket handler closures)
  const activeConvoRef = useRef(null)
  useEffect(() => { activeConvoRef.current = activeConvo }, [activeConvo])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peerTyping])

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConvos(true)
    try {
      const res = await axios.get(`${API}/peer-chat/conversations`, { headers })
      if (res.data?.success) setConversations(res.data.conversations)
    } catch {}
    setLoadingConvos(false)
  }, [])

  useEffect(() => { 
    loadConversations()
    searchStudents('')
    if (location.state?.conversationId) {
      openConvo({ _id: location.state.conversationId, peerName: location.state.teamTitle || 'Team Chat' })
    } else if (location.state?.peerId && location.state.peerId !== myId) {
      startChat(location.state.peerId, location.state.peerName || 'Peer')
    }
  }, [location.state?.peerId, location.state?.conversationId])

  // ── Open a conversation ───────────────────────────────────────────────────
  const openConvo = async (convo) => {
    setActiveConvo(convo)
    setMessages([])
    setLoadingMsgs(true)
    setShowDiscover(false)
    try {
      const res = await axios.get(`${API}/peer-chat/conversations/${convo._id}/messages`, { headers })
      if (res.data?.success) setMessages(res.data.messages)
      // Clear unread
      setConversations(prev => prev.map(c => c._id === convo._id ? { ...c, unreadCount: 0 } : c))
    } catch {}
    setLoadingMsgs(false)
  }

  // ── Discover students ────────────────────────────────────────────────────
  const searchStudents = useCallback(async (q) => {
    setLoadingDiscover(true)
    try {
      const res = await axios.get(`${API}/peer-chat/students`, { headers, params: { q } })
      if (res.data?.success) setDiscoverStudents(res.data.students || [])
    } catch {}
    setLoadingDiscover(false)
  }, [])

  useEffect(() => {
    if (!showDiscover && !discoverQuery) return
    const t = setTimeout(() => searchStudents(discoverQuery), 400)
    return () => clearTimeout(t)
  }, [discoverQuery, showDiscover])

  // Open conversation with a discovered student
  const startChat = async (peerId, peerName) => {
    try {
      const res = await axios.post(`${API}/peer-chat/conversations`, { peerId }, { headers })
      if (res.data?.success) {
        const convo = res.data.conversation
        setConversations(prev => {
          const exists = prev.find(c => c._id === convo._id)
          return exists ? prev : [convo, ...prev]
        })
        openConvo(convo)
      }
    } catch {}
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async (text, type = 'text') => {
    if (!text.trim() || !activeConvo) return
    setSending(true)
    try {
      const res = await axios.post(`${API}/peer-chat/conversations/${activeConvo._id}/messages`,
        { content: text.trim(), type }, { headers })
      if (res.data?.success) {
        setMessages(prev => [...prev, res.data.message])
        setInput('')
      }
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const emitTyping = () => {
    if (!socketRef.current || !activeConvo) return
    socketRef.current.emit('peer:typing', {
      conversationId: activeConvo._id,
      userId: myId,
      peerId: activeConvo.peerId
    })
  }

  // ── Send study invite ────────────────────────────────────────────────────
  const sendStudyInvite = async () => {
    if (!activeConvo) return
    try {
      const res = await axios.post(`${API}/peer-chat/conversations/${activeConvo._id}/study-invite`,
        { subject: inviteSubject, goal: inviteGoal, durationMinutes: inviteDuration },
        { headers }
      )
      if (res.data?.success) {
        setMessages(prev => [...prev, res.data.message])
        setShowInviteModal(false)
        setInviteSubject(''); setInviteGoal('')
      }
    } catch {}
  }

  // ── Respond to study invite ───────────────────────────────────────────────
  const respondToInvite = async (msgId, response, existingSessionId) => {
    if (response === 'join' && existingSessionId) {
      navigate(`/college/multiplayer-quiz/${existingSessionId}`)
      return
    }
    if (response === 'end') {
      if (!window.confirm('Are you sure you want to end this quiz session?')) return
      const rawMsgId = getRawId(msgId)
      const validSessionId = (existingSessionId && existingSessionId !== 'undefined' && existingSessionId !== 'null') ? existingSessionId : null
      const targetParamId = validSessionId || rawMsgId

      let success = false
      try {
        const res = await axios.post(`${API}/multiplayer-quiz/${targetParamId}/end`, {}, { headers })
        if (res.data?.success) success = true
      } catch (err) {
        console.warn('POST /multiplayer-quiz/end failed, trying PATCH /peer-chat/messages/invite-response...', err)
      }

      if (!success && rawMsgId) {
        try {
          await axios.patch(`${API}/peer-chat/messages/${rawMsgId}/invite-response`, { response: 'ended' }, { headers })
          success = true
        } catch (patchErr) {
          console.error('Fallback PATCH invite-response error:', patchErr)
        }
      }

      // Update UI state immediately
      setMessages(prev => prev.map(m => {
        const isMatch = (rawMsgId && getRawId(m._id) === rawMsgId) ||
          (validSessionId && m.studyInvite?.sessionId === validSessionId)
        if (isMatch) {
          return {
            ...m,
            studyInvite: {
              ...m.studyInvite,
              status: 'ended'
            }
          }
        }
        return m
      }))
      return
    }
    try {
      const res = await axios.patch(`${API}/peer-chat/messages/${msgId}/invite-response`,
        { response }, { headers })
      const sessionId = res.data?.message?.studyInvite?.sessionId
      if (response === 'accepted' && sessionId) {
        navigate(`/college/multiplayer-quiz/${sessionId}`)
        return
      }
      setMessages(prev => prev.map(m =>
        m._id === msgId ? { ...m, studyInvite: { ...m.studyInvite, status: response, sessionId: sessionId || m.studyInvite?.sessionId } } : m
      ))
    } catch (err) {
      console.error(err)
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0)

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', background: '#f8fafc', borderRadius: 20, overflow: 'hidden', border: '1px solid #e2e8f0', fontFamily: 'var(--s-font-body, Inter, sans-serif)' }}>

      {/* ── LEFT: Conversation List ── */}
      <div style={{ width: 300, background: '#fff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Peer Chat {totalUnread > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 10, marginLeft: 6 }}>{totalUnread}</span>}
            </h2>
            <button onClick={() => { setShowDiscover(v => !v); if (!showDiscover) searchStudents('') }}
              title="Find Students"
              style={{ background: '#f0f9ff', border: 'none', color: '#0284c7', cursor: 'pointer', borderRadius: 10, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800 }}>
              <FiPlus size={14} /> Find
            </button>
          </div>

          {/* Discover / search */}
          {showDiscover && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                <FiSearch size={14} color="#94a3b8" />
                <input type="text" placeholder="Search by name, subject, skills…"
                  value={discoverQuery} onChange={e => setDiscoverQuery(e.target.value)} autoFocus
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, flex: 1 }} />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {loadingDiscover
                  ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>Searching…</div>
                  : discoverStudents.length === 0
                    ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>No students found.</div>
                    : discoverStudents.map(s => (
                      <div key={s.userId} onClick={() => startChat(s.userId, s.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderRadius: 10, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                          {s.name?.[0] || 'S'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.field} • {s.currentYear}</div>
                        </div>
                      </div>
                    ))
                }
              </div>
              <div style={{ height: 1, background: '#f1f5f9', marginTop: 8 }} />
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvos
            ? <div style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            : conversations.length === 0
              ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <FiMessageSquare size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>No conversations yet</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>Click "Find" to start chatting</div>
                </div>
              )
              : conversations.map(c => (
                <div key={c._id}
                  onClick={() => openConvo(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', background: activeConvo?._id === c._id ? '#f0f9ff' : 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (activeConvo?._id !== c._id) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (activeConvo?._id !== c._id) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                    {c.peerName?.[0] || 'S'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.peerName}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginLeft: 8, flexShrink: 0 }}>{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || 'Start chatting…'}</div>
                  </div>
                  {c.unreadCount > 0 && (
                    <div style={{ background: '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>{c.unreadCount}</div>
                  )}
                </div>
              ))
          }
        </div>
      </div>

      {/* ── RIGHT: Chat window / Recommended Domain Peers ── */}
      {!activeConvo ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', background: '#f8fafc' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              <FiTarget size={14} /> Domain Match Network
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              Peers in Your Interested Domain
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Connect with fellow college students sharing your specialization to collaborate, study together, and exchange prep resources.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {discoverStudents.map(peer => (
              <div key={peer.userId} style={{
                background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>
                      {peer.name?.[0] || 'S'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{peer.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{peer.currentYear || 'College Student'}</div>
                    </div>
                  </div>

                  {peer.sameDomainMatch && (
                    <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      🎯 {peer.domain || 'Same Domain'}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, lineHeight: 1.4 }}>
                    📍 {peer.institution || 'National Engineering College'}
                  </div>

                  {peer.skills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {peer.skills.slice(0, 4).map(sk => (
                        <span key={sk} style={{ background: '#f1f5f9', color: '#334155', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                          ⚡ {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => startChat(peer.userId, peer.name)}
                  style={{
                    width: '100%', background: '#0284c7', color: '#fff', border: 'none',
                    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <FiMessageSquare size={15} /> Chat Now →
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Chat header */}
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setActiveConvo(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FiArrowLeft size={18} />
            </button>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
              {activeConvo.peerName?.[0] || 'S'}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{activeConvo.peerName}</div>
              {peerTyping && <div style={{ fontSize: 11, color: '#0284c7', fontStyle: 'italic' }}>typing…</div>}
            </div>
            {/* Study invite button */}
            <button onClick={() => {
              const acceptedInvite = [...messages].reverse().find(m => m.type === 'study_invite' && m.studyInvite?.status === 'accepted' && m.studyInvite?.sessionId)
              if (acceptedInvite?.studyInvite?.sessionId) {
                navigate(`/college/multiplayer-quiz/${acceptedInvite.studyInvite.sessionId}`)
              } else {
                setShowInviteModal(true)
              }
            }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              <FiTarget size={14} /> Study Together
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingMsgs
              ? <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Loading messages…</div>
              : messages.length === 0
                ? (
                  <div style={{ textAlign: 'center', marginTop: 60, color: '#94a3b8' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Start the conversation!</div>
                    <div style={{ fontSize: 12 }}>Use Quick Actions below to break the ice.</div>
                  </div>
                )
                : (() => {
                  const lastActiveInviteId = [...messages].reverse().find(m => {
                    if (m.type !== 'study_invite') return false
                    const st = String(m.studyInvite?.status || 'PENDING').toUpperCase()
                    const isEnded = st === 'ENDED' || st === 'CANCELLED'
                    const isDeclined = st === 'DECLINED'
                    const isFailed = st === 'QUIZ_CREATION_FAILED'
                    return !isEnded && !isDeclined && !isFailed
                  })?._id

                  return messages.map((msg, i) => {
                    const isMe = getRawId(msg.senderId) === getRawId(myId)
                    if (msg.type === 'study_invite') {
                      const isLatest = getRawId(msg._id) === getRawId(lastActiveInviteId)
                      return <StudyInviteBanner key={msg._id || i} msg={msg} myId={myId} onRespond={respondToInvite} isLatest={isLatest} />
                    }
                    return (
                      <div key={msg._id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '72%', padding: '10px 16px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMe ? '#0284c7' : '#fff', color: isMe ? '#fff' : '#0f172a',
                          fontSize: 13, fontWeight: 500, lineHeight: 1.5, border: isMe ? 'none' : '1px solid #f1f5f9',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                        }}>
                          {msg.content}
                          <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()
            }
            {peerTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f1f5f9', borderRadius: 18, padding: '8px 16px', fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>typing…</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div style={{ padding: '8px 24px 0', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => setInput(a.text)}
                style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <textarea
              rows={1}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={e => { setInput(e.target.value); emitTyping() }}
              onKeyDown={handleKeyDown}
              style={{ flex: 1, padding: '12px 16px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', maxHeight: 120, overflowY: 'auto', lineHeight: 1.5 }}
            />
            <button onClick={() => sendMessage(input)} disabled={sending || !input.trim()}
              style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? '#0284c7' : '#e2e8f0', color: input.trim() ? '#fff' : '#94a3b8', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
              <FiSend size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Study Invite Modal ── */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>📚 Invite to Study Session</h3>
              <button onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                <FiX size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Select Topic</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {['C++', 'SQL', 'DBMS', 'Java', 'Python', 'OOPS', 'OS', 'Computer Networks', 'Data Structures'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInviteSubject(t)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        background: inviteSubject.toUpperCase() === t.toUpperCase() ? '#7c3aed' : '#f1f5f9',
                        color: inviteSubject.toUpperCase() === t.toUpperCase() ? '#fff' : '#475569',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Or type custom topic (e.g. C++, SQL, Java)..." value={inviteSubject}
                  onChange={e => setInviteSubject(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Goal (optional)</label>
                <input type="text" placeholder='e.g. "Practice 10 SQL queries"' value={inviteGoal}
                  onChange={e => setInviteGoal(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Duration</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[25, 45, 60].map(d => (
                    <button key={d} type="button" onClick={() => setInviteDuration(d)}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', background: inviteDuration === d ? '#7c3aed' : '#f1f5f9', color: inviteDuration === d ? '#fff' : '#475569', border: 'none' }}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={sendStudyInvite}
              style={{ width: '100%', marginTop: 20, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FiTarget size={18} /> Send Study Invite
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
