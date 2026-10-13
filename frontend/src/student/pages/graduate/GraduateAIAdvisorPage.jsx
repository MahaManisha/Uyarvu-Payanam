import React, { useState, useRef, useEffect } from 'react'
import {
  FiMessageSquare, FiSend, FiUser, FiZap,
  FiCopy, FiCheck, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi'
import graduateService from '../../../services/graduateService'
import {
  buildAIAdvisorContext,
  getEffectiveAcademicHierarchy
} from '../../services/graduatePersonalizationEngine'

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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
  const profileContext = buildAIAdvisorContext(profile)

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim() || loading) return

    const userMsg = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))

      const res = await graduateService.chatAdvisor({
        message: text.trim(),
        history,
        profileContext
      })

      const botMsg = {
        sender: 'assistant',
        text: res.reply || res.message || `Based on your ${academic.domain} qualification, I recommend focusing on practical portfolio evidence and applying directly to entry-level roles.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      console.error('Failed to get advisor reply:', err)
      const errorMsg = {
        sender: 'assistant',
        text: `Based on your ${academic.fullHierarchyText} qualification, our recommended pathway is to complete your core portfolio projects and apply directly for entry-level positions.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
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
              maxWidth: '80%', padding: '14px 18px', borderRadius: 16,
              background: m.sender === 'user' ? '#2563eb' : '#fff',
              color: m.sender === 'user' ? '#fff' : '#0f172a',
              boxShadow: m.sender === 'user' ? '0 4px 12px rgba(37,99,235,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
              border: m.sender === 'user' ? 'none' : '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: 14, lineHeight: 1.6, whitespace: 'pre-line' }}>
                {m.text}
              </div>
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
