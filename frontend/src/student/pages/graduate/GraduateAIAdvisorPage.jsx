import React, { useState, useRef, useEffect } from 'react'
import {
  FiMessageSquare, FiSend, FiUser, FiZap,
  FiCopy, FiCheck, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import graduateService from '../../../services/graduateService'
import { getEffectiveAcademicHierarchy } from '../../services/graduatePersonalizationEngine'
import { normalizeAdvisorMarkdown } from './advisorMarkdown'
import './graduateAiAdvisor.css'

const MAX_MESSAGE_CHARS = 2000
const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// Custom renderers for the AI reply. Tables are wrapped so a wide table scrolls
// inside the bubble instead of stretching the chat page; links open safely in a
// new tab. `node` is react-markdown's internal AST field and must not be spread
// onto a DOM element, so it is removed without creating an unused binding.
function AdvisorTable(props) {
  const rest = { ...props }
  delete rest.node
  return (
    <div className="advisor-table-wrap">
      <table {...rest} />
    </div>
  )
}

function AdvisorLink(props) {
  const rest = { ...props }
  delete rest.node
  return <a {...rest} target="_blank" rel="noopener noreferrer" />
}

const markdownComponents = { table: AdvisorTable, a: AdvisorLink }

export default function GraduateAIAdvisorPage() {
  const [profile, setProfile] = useState({})
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: `Hello! I am your dedicated **AI Graduate Career Advisor**. 

I have full context of your academic qualification, technical skills, and career goals. Whether you are aiming to:
• Pivot to high-demand technical or analytics roles
• Decide between GATE, CAT, UPSC, or private sector employment
• Evaluate M.Tech in India vs MS Abroad
• Polish your resume and crack off-campus technical interviews

Ask me any specific career question below!`,
      timestamp: nowStamp()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const chatBottomRef = useRef(null)

  useEffect(() => {
    graduateService.getProfile().then(res => {
      if (res.success && res.profile) setProfile(res.profile)
    }).catch(e => {})
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const academic = getEffectiveAcademicHierarchy(profile)

  // Build the recent conversation turns sent to the backend. The scripted
  // greeting and any failed turns are excluded; the backend re-validates and
  // bounds this again before sending it to the model.
  const buildHistory = (list) =>
    list
      .slice(1)
      .filter((m) => (m.sender === 'user' || m.sender === 'assistant') && !m.isError)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
      .slice(-10)

  // Single place that talks to the backend. `userText` is the exact question to
  // answer; `history` is the preceding conversation context.
  const requestReply = async (userText, history) => {
    setLoading(true)
    try {
      const res = await graduateService.chatAdvisor({ message: userText, history })
      const reply = res && (res.reply || res.message) ? String(res.reply || res.message).trim() : ''
      if (!reply) throw new Error('EMPTY_REPLY')
      setMessages((prev) => [...prev, { sender: 'assistant', text: reply, timestamp: nowStamp() }])
    } catch (err) {
      const data = err?.response?.data
      const text = data && data.configured === false
        ? (data.message || 'The AI Advisor is not connected yet. An administrator needs to configure the AI provider.')
        : (data && data.message) || 'I could not reach the AI service. Please check your connection and try again.'
      setMessages((prev) => [...prev, {
        sender: 'assistant',
        text,
        isError: true,
        retryText: userText,
        timestamp: nowStamp()
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const history = buildHistory(messages)
    setMessages((prev) => [...prev, { sender: 'user', text, timestamp: nowStamp() }])
    setInput('')
    await requestReply(text, history)
  }

  // Retry the failed question without duplicating the user's bubble.
  const handleRetry = async (retryText) => {
    if (loading || !retryText) return
    const errIdx = messages.findIndex((m) => m.isError && m.retryText === retryText)
    const history = buildHistory(errIdx >= 0 ? messages.slice(0, errIdx) : messages)
    if (errIdx >= 0) setMessages((prev) => prev.filter((_, i) => i !== errIdx))
    await requestReply(retryText, history)
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 600 }}>
      {/* Header */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px 16px 0 0',
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiZap size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>AI Graduate Career Advisor</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Profile Context: {academic.fullHierarchyText}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', minWidth: 0, padding: '14px 18px', borderRadius: 16,
              background: m.sender === 'user' ? '#2563eb' : '#fff',
              color: m.sender === 'user' ? '#fff' : '#0f172a',
              boxShadow: m.sender === 'user' ? '0 4px 12px rgba(37,99,235,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
              border: m.sender === 'user' ? 'none' : (m.isError ? '1px solid #fecaca' : '1px solid #e2e8f0')
            }}>
              {m.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>
                  <FiAlertCircle size={14} /> Advisor unavailable
                </div>
              )}
              {m.sender === 'assistant' && !m.isError ? (
                <div className="advisor-md">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {normalizeAdvisorMarkdown(m.text)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                  {m.text}
                </div>
              )}
              {m.isError && m.retryText && (
                <button
                  onClick={() => handleRetry(m.retryText)}
                  disabled={loading}
                  style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                    borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <FiRefreshCw size={13} /> Retry
                </button>
              )}
              <div style={{ fontSize: 11, color: m.sender === 'user' ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: 6, textAlign: 'right' }}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, color: '#64748b', fontSize: 13, alignItems: 'center' }}>
            <FiRefreshCw className="s-spin" /> AI Advisor is thinking...
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', padding: 16, display: 'flex', gap: 12 }}>
        <input
          type="text"
          placeholder={`Ask AI Advisor about your ${academic.domain} career pathway...`}
          value={input}
          maxLength={MAX_MESSAGE_CHARS}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 10, padding: '0 20px', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <FiSend size={16} />
        </button>
      </div>
    </div>
  )
}
