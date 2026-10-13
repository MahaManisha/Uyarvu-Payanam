import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useCollegeProfile } from '../../context/CollegeProfileContext'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import { getCollegeFeatureEligibility, getDashboardWidgetPriority } from '../../services/collegeFeatureEligibilityEngine'
import { getCollegePracticeConfig } from '../../services/collegePracticeEngine'
import axiosInstance from '../../../config/axios'
import { SBtn, SCard, SBadge, SLoader } from '../../components/ui'
import {
  FiCompass, FiAward, FiFileText, FiBell,
  FiArrowRight, FiCheckCircle, FiTarget, FiZap, FiBookmark,
  FiTrendingUp, FiSliders, FiUser, FiCalendar, FiClock,
  FiBookOpen, FiUsers, FiHelpCircle, FiActivity, FiCheckSquare,
  FiAlertCircle, FiCode, FiX, FiEye, FiSettings, FiCpu, FiMessageSquare, FiBarChart2, FiPlay
} from 'react-icons/fi'

export default function CollegeDashboardPage() {
  const { student } = useStudentAuth()
  const { profile } = useCollegeProfile()
  const { theme, themeKey } = useCollegeTheme()
  const navigate = useNavigate()
  const isGamified = themeKey === 'gamified'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [discoveryResult, setDiscoveryResult] = useState(null)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState([])
  // Focus stats for dashboard widget
  const [focusToday, setFocusToday] = useState(null)
  const [focusStats, setFocusStats] = useState(null)
  // Peer chat recent conversations
  const [recentConvos, setRecentConvos] = useState([])

  // Feature Eligibility Flags for current student profile
  const flags = getCollegeFeatureEligibility(profile)
  const prioritizedWidgets = getDashboardWidgetPriority(profile)
  const practiceConfig = getCollegePracticeConfig(profile)

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('studentToken')
        if (token) {
          const [res, discRes, focusTodayRes, focusStatsRes, convosRes] = await Promise.allSettled([
            axiosInstance.get('/study-tools/dashboard-summary'),
            axiosInstance.get('/onboarding/discovery/result'),
            axiosInstance.get('/focus/today'),
            axiosInstance.get('/focus/stats'),
            axiosInstance.get('/peer-chat/conversations'),
          ])
          if (res.status === 'fulfilled' && res.value.data?.success) setData(res.value.data)
          if (discRes.status === 'fulfilled' && discRes.value.data?.recommendedDomain) setDiscoveryResult(discRes.value.data)
          if (focusTodayRes.status === 'fulfilled' && focusTodayRes.value.data?.success) setFocusToday(focusTodayRes.value.data.today)
          if (focusStatsRes.status === 'fulfilled' && focusStatsRes.value.data?.success) setFocusStats(focusStatsRes.value.data.stats)
          if (convosRes.status === 'fulfilled' && convosRes.value.data?.success) setRecentConvos(convosRes.value.data.conversations?.slice(0, 3) || [])
        }
      } catch (err) {
        console.warn('Failed to load dashboard summary:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardSummary()
  }, [])

  if (loading) {
    return (
      <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SLoader />
      </div>
    )
  }

  const header = data?.header || {}
  const todaySec = data?.todaySection || {}
  const careerSec = data?.careerSection || {}
  const roadmapSec = data?.roadmapSection || {}
  const scholarshipSec = data?.scholarshipSection || {}
  const skillSec = data?.skillSection || {}
  const perfSec = data?.performanceSection || {}
  const commSec = data?.communitySection || {}

  const firstName = header.studentName?.split(' ')[0] || student?.name?.split(' ')[0] || 'Student'

  const activeWidgets = prioritizedWidgets.filter(w => !hiddenWidgetIds.includes(w.id))

  return (
    <div className="s-anim-up" style={{ paddingBottom: 40 }}>

      {/* ── DASHBOARD HEADER WITH DEGREE/DOMAIN TAG ── */}
      <div style={{
        background: isGamified
          ? 'linear-gradient(135deg, #0f2044 0%, #080d1f 100%)'
          : 'linear-gradient(135deg, #1a6fc4 0%, #0ea5e9 100%)',
        color: '#fff', padding: '32px 36px', borderRadius: 24,
        boxShadow: isGamified ? '0 10px 30px rgba(0,245,212,0.1)' : '0 10px 30px rgba(4, 120, 87, 0.2)', marginBottom: 28,
        position: 'relative',
        border: isGamified ? '1px solid rgba(0,245,212,0.15)' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
              <FiCompass size={13} /> {[header.degreeProgramme || profile?.degreeProgramme, header.branch || profile?.domain || profile?.field].filter(Boolean).join(' • ') || 'College Student Portal'}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 8px', fontFamily: 'var(--s-font-display)', color: '#fff' }}>
              {header.greeting || 'Good Afternoon'}, {firstName}! 👋
            </h1>
            <p style={{ fontSize: 14, color: '#a7f3d0', fontWeight: 700, margin: '0 0 20px' }}>
              Personalized Student Dashboard.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/college/profile')}
              style={{
                background: '#047857', color: '#fff', border: 'none',
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <FiUser size={14} /> Complete Profile →
            </button>
            <button
              type="button"
              onClick={() => setShowCustomizeModal(true)}
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <FiSettings size={14} /> Customize Dashboard
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800 }}>Profile Completion</div>
            <Link to="/college/profile" style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <FiCheckCircle size={14} /> {header.profileCompletion !== undefined ? `${header.profileCompletion}%` : (profile?.profileCompletion !== undefined ? `${profile.profileCompletion}%` : '0%')}
                <span style={{ fontSize: 11, color: '#a7f3d0', textDecoration: 'underline', marginLeft: 4 }}>Complete →</span>
              </div>
            </Link>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800 }}>CGPA</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              {header.cgpa || profile?.cgpa || 'Not provided'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800 }}>Recommended Career</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FiTarget size={14} /> {discoveryResult?.recommendedDomain?.domainName || data?.recommendation?.career || profile?.targetCareer || 'Not set'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800 }}>Roadmap Progress</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              {header.roadmapProgress !== undefined ? `${header.roadmapProgress}%` : '0%'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800 }}>Current Streak</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fef08a', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FiZap size={14} /> {header.currentStreak !== undefined ? `${header.currentStreak} Days 🔥` : '0 Days 🔥'}
            </div>
          </div>
        </div>
      </div>

      {/* ── TODAY'S FOCUS & PEER CHAT QUICK ACCESS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Focus Widget */}
        <div style={{ background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 20, padding: 24, border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiCpu size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: isGamified ? '#f8fafc' : '#0f172a' }}>Today's Focus</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Intelligent Focus Mode</div>
              </div>
            </div>
            <Link to="/college/focus/analytics" style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textDecoration: 'none' }}>Analytics →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Focus Time', value: focusToday?.totalFocusMinutes ? `${focusToday.totalFocusMinutes}m` : '—' },
              { label: 'Sessions',   value: focusToday?.sessionsCompleted ?? '—' },
              { label: 'Streak',     value: focusStats?.streak ? `${focusStats.streak}d 🔥` : '—' },
              { label: 'Score',      value: focusToday?.averageFocusScore ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', background: isGamified ? 'rgba(0,245,212,0.05)' : '#f8fafc', borderRadius: 10, padding: '10px 6px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0284c7' }}>{value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/college/academic/focus"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0284c7', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
              <FiPlay size={14} /> Start Focus
            </Link>
            <Link to="/college/peer-chat"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f1f5f9', color: '#475569', padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
              <FiUsers size={14} /> Find Peer
            </Link>
          </div>
        </div>

        {/* Peer Chat Widget */}
        <div style={{ background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 20, padding: 24, border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiMessageSquare size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: isGamified ? '#f8fafc' : '#0f172a' }}>Peer Chat</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Study with classmates</div>
              </div>
            </div>
            <Link to="/college/peer-chat" style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textDecoration: 'none' }}>Open →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, minHeight: 64 }}>
            {recentConvos.length === 0
              ? <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>No conversations yet. Find a peer to get started!</div>
              : recentConvos.map(c => (
                <Link key={c._id} to="/college/peer-chat"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, textDecoration: 'none', border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{c.peerName?.[0] || 'S'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{c.peerName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || 'Start chatting'}</div>
                  </div>
                  {c.unreadCount > 0 && <div style={{ background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 8, flexShrink: 0 }}>{c.unreadCount}</div>}
                </Link>
              ))
            }
          </div>
          <Link to="/college/peer-chat"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
            <FiMessageSquare size={14} /> Open Chat
          </Link>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28 }} className="s-grid-2col">

        {/* LEFT COLUMN: DYNAMIC ELIGIBLE & PRIORITY CARDS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── PERSONALIZED EVALUATED CANDIDATE DOMAINS CARD ── */}
          {(() => {
            const rawList = discoveryResult?.rankings || discoveryResult?.finalScores || data?.ahp?.topDomains || []
            const domainList = [...rawList].sort((a, b) => {
              const scoreB = b.score !== undefined ? b.score : (b.fuzzyScore || 0)
              const scoreA = a.score !== undefined ? a.score : (a.fuzzyScore || 0)
              return scoreB - scoreA
            })
            if (domainList.length === 0) return null

            return (
              <SCard style={{ padding: 26, borderRadius: 20, borderLeft: '5px solid #0284c7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiCompass color="#0284c7" size={18} /> YOUR EVALUATED CAREER DOMAINS &amp; FUZZY BREAKDOWN
                  </div>
                  <SBadge color="blue">AHP + Fuzzy Engine Alignment</SBadge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {domainList.map((dom, idx) => {
                    const dName = dom.domainName || dom.name || dom.domainId
                    const rawScore = dom.score !== undefined ? dom.score : (dom.fuzzyScore || 0.5)
                    const scorePct = rawScore > 1 ? Math.round(rawScore) : Number((rawScore * 100).toFixed(1))

                    return (
                      <div key={dom.domainId || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--s-surface2)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#0284c7', color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{dName}</div>
                            <div style={{ fontSize: 11, color: 'var(--s-text3)' }}>Evaluated Suitability Score</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', padding: '4px 12px', borderRadius: 8 }}>
                          {scorePct}% Match
                        </span>
                      </div>
                    )
                  })}
                </div>
              </SCard>
            )
          })()}

          {/* FUZZY LOGIC RECOMMENDATION CARD */}
          {(discoveryResult?.recommendedDomain || data?.recommendation) && (() => {
            const rec = discoveryResult?.recommendedDomain || {}
            const recCareer = rec.domainName || data?.recommendation?.career || 'AI & Machine Learning'
            const rawSuit = rec.score !== undefined ? rec.score : (data?.recommendation?.suitability || 82)
            const suitScore = rawSuit > 1 ? Math.round(rawSuit) : Number((rawSuit * 100).toFixed(1))
            const confidence = discoveryResult?.confidenceLevel || data?.recommendation?.confidenceLevel || 'high'

            return (
              <SCard style={{ padding: 26, borderRadius: 20, borderLeft: '5px solid #7c3aed', background: isGamified ? '#0f1f3d' : '#fcfaff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiAward color="#7c3aed" size={18} /> MAMDANI FUZZY CAREER RECOMMENDATION
                  </div>
                  <SBadge color="purple">{confidence.toUpperCase()} CONFIDENCE</SBadge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--s-text)' }}>
                      🎯 {recCareer}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 4, margin: '4px 0 0' }}>
                      Calculated via Mamdani Fuzzy Inference Engine using AHP Priorities $\rightarrow$ Assessment Results.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#7c3aed' }}>
                      {suitScore}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>
                      Career Suitability
                    </div>
                  </div>
                </div>
              </SCard>
            )
          })()}



          {/* FOCUS LEARNING BANNER CARD */}
          {!hiddenWidgetIds.includes('focus-learning') && (
            <SCard style={{ padding: 24, borderRadius: 20, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.06em' }}>
                  🎯 Active Deep Work Mode
                </span>
                <SBadge color="blue">Tab & Distraction Monitoring</SBadge>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px', color: '#fff' }}>
                Focus Learning Session
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Start a timed, distraction-free study session with real-time browser tab monitoring and optional camera attention detection.
              </p>
              <button
                type="button"
                onClick={() => navigate('/college/academic/focus')}
                style={{
                  padding: '12px 24px', borderRadius: 12, background: '#0284c7', color: '#fff',
                  fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 8
                }}
              >
                Start Focus Session →
              </button>
            </SCard>
          )}

          {/* DYNAMIC PROFILE-DRIVEN PRACTICE CARD (Domain-Specific) */}
          {!hiddenWidgetIds.includes('practice-lab') && (
            <SCard style={{ padding: 28, borderRadius: 20, borderLeft: '5px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiActivity color="#0284c7" size={18} /> {practiceConfig.practiceTitle}
                </div>
                <SBadge color="blue">{practiceConfig.badge}</SBadge>
              </div>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                {practiceConfig.practiceDescription}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate('/college/practice')}
                  style={{ padding: '10px 20px', borderRadius: 10, background: '#0284c7', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer' }}
                >
                  Enter {practiceConfig.navLabel} →
                </button>
              </div>
            </SCard>
          )}

          {/* DYNAMIC DOMAIN CARD: MEDICAL CASE DISCUSSION */}
          {flags.medicalCaseDiscussion && !hiddenWidgetIds.includes('medical-case-discussion') && (
            <SCard style={{ padding: 28, borderRadius: 20, borderLeft: '5px solid #ec4899' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🩺 Clinical Case Discussions & Medical Planner
                </div>
                <SBadge color="purple">Clinical Focus</SBadge>
              </div>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Review clinical case scenarios, discuss diagnostic reasoning with medical peers, and plan your clinical rotation schedule.
              </p>
              <button
                type="button"
                onClick={() => navigate('/college/community/doubts?tab=clinical')}
                style={{ padding: '10px 20px', borderRadius: 10, background: '#db2777', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer' }}
              >
                Explore Clinical Cases →
              </button>
            </SCard>
          )}

          {/* DYNAMIC DOMAIN CARD: LAW CASE ANALYSIS */}
          {flags.lawCaseAnalysis && !hiddenWidgetIds.includes('law-case-analysis') && (
            <SCard style={{ padding: 28, borderRadius: 20, borderLeft: '5px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚖️ Legal Reasoning, Landmark Cases & Moot Practice
                </div>
                <SBadge color="orange">Legal Domain</SBadge>
              </div>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Analyze statutory interpretations, landmark court judgments, and practice moot court arguments with law peers.
              </p>
              <button
                type="button"
                onClick={() => navigate('/college/study-tools/practice?subject=Law')}
                style={{ padding: '10px 20px', borderRadius: 10, background: '#d97706', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer' }}
              >
                Analyze Legal Cases →
              </button>
            </SCard>
          )}

          {/* DYNAMIC DOMAIN CARD: HACKATHON & PROJECT TEAMMATE FINDER */}
          {flags.hackathonTeammates && !hiddenWidgetIds.includes('hackathon-teammates') && (
            <SCard style={{
              padding: 28,
              borderRadius: 20,
              borderLeft: '5px solid #6366f1',
              background: isGamified
                ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,31,61,0.8) 100%)'
                : 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
              border: isGamified ? '1px solid rgba(99,102,241,0.3)' : '1px solid #e0e7ff',
              boxShadow: '0 4px 20px rgba(99,102,241,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🚀</span> Hackathon Teammate Finder
                </div>
                <SBadge color="purple">Hackathon &amp; Project Squads</SBadge>
              </div>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '0 0 16px', lineHeight: 1.6 }}>
                Form your dream team for <strong>Smart India Hackathon (SIH 2026)</strong>, Tamil Nadu State Innovation Challenges, College Symposiums, and Mini/Final-Year Projects. Find peers with complementary skills (React, AI/ML, IoT Hardware, ROS2, VLSI, Design) and start collaborating immediately.
              </p>

              {/* Real Verified Hackathon & Competition Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#e0e7ff', color: '#4338ca' }}>
                  🏆 Smart India Hackathon (SIH 2026)
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#fef3c7', color: '#92400e' }}>
                  🏛️ TNSI (EDII-TN State Challenge)
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#ecfdf5', color: '#065f46' }}>
                  ⚡ Naan Mudhalvan AI Challenge
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#f5f3ff', color: '#6d28d9' }}>
                  🚀 Anna Univ Kurukshetra
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigate('/college/teammate-matchmaker')}
                  style={{
                    padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(79,70,229,0.3)'
                  }}
                >
                  <FiUsers size={16} /> Explore Open Squads →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/college/teammate-matchmaker?action=post')}
                  style={{
                    padding: '10px 18px', borderRadius: 12, background: isGamified ? 'rgba(255,255,255,0.1)' : '#fff',
                    color: '#4f46e5', fontWeight: 800, fontSize: 13, border: '1px solid #c7d2fe', cursor: 'pointer'
                  }}
                >
                  + Post Team Idea
                </button>
              </div>
            </SCard>
          )}

          {/* SECTION 1 — TODAY'S OVERVIEW */}
          {!hiddenWidgetIds.includes('study-planner') && (
            <SCard style={{ padding: 28, borderRadius: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiCalendar color="var(--s-primary)" size={18} /> Today's Overview & Study Plan
                </div>
                <SBtn variant="secondary" onClick={() => navigate('/college/academic/planner')} style={{ fontSize: 12, padding: '4px 12px' }}>
                  Open Planner →
                </SBtn>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="s-grid-2col">
                <div style={{ background: 'var(--s-surface2)', padding: 16, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#047857', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiClock size={13} /> Daily Study Schedule
                  </div>
                  {todaySec.todayStudyPlan?.length > 0 ? (
                    todaySec.todayStudyPlan.map((task, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--s-card-bg)', borderRadius: 10, marginBottom: 6, borderLeft: task.priority === 'HIGH' ? '3px solid #ef4444' : '3px solid #10b981' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--s-text3)' }}>{task.timeSlot}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text)' }}>{task.subject}: {task.topic}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--s-text3)' }}>Complete focus session to auto-update planner tasks.</div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#fef3c7', padding: 14, borderRadius: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#b45309', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiAlertCircle size={13} /> Upcoming Exams
                    </div>
                    {todaySec.upcomingExams?.length > 0 ? (
                      todaySec.upcomingExams.map((exam, i) => (
                        <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#78350f', marginTop: 2 }}>• {exam}</div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: '#78350f' }}>Mid-term assessments in 14 days</div>
                    )}
                  </div>
                </div>
              </div>
            </SCard>
          )}

          {/* SECTION 2 — CAREER RECOMMENDATION & GOAL */}
          {!hiddenWidgetIds.includes('skill-gap') && (
            <SCard style={{ padding: 28, borderRadius: 20, borderLeft: '5px solid #047857' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiTarget color="#047857" size={18} /> Career Goal & Skill Alignment
                </div>
                <SBadge color="green">Target Readiness: 82%</SBadge>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="s-grid-2col">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--s-text3)' }}>Target Career Goal</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--s-text)', marginTop: 2 }}>
                    🎯 {discoveryResult?.recommendedDomain?.domainName || data?.recommendation?.career || profile?.targetCareer || profile?.specialization || profile?.domain || 'Academic & Professional Pathway'}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--s-text3)', marginTop: 4, lineHeight: 1.4 }}>
                    Tailored guidance based on your discipline ({profile?.field || profile?.domain || 'Academic Discipline'}) and degree programme ({profile?.degreeProgramme || 'Undergraduate'}).
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#b45309', marginBottom: 6 }}>
                    Top Skill Gaps
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(data?.careerSection?.topSkillGaps && data.careerSection.topSkillGaps.length > 0) ? (
                      data.careerSection.topSkillGaps.slice(0, 3).map((sg, idx) => (
                        <span key={idx} style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>
                          △ {sg}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--s-text3)' }}>Add skills in your profile to analyze skill gaps</span>
                    )}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <SBtn variant="primary" onClick={() => navigate('/college/career/skill-gap')} style={{ width: '100%', justifyContent: 'center', borderRadius: 12, fontSize: 13 }}>
                      View Skill Gap Analysis →
                    </SBtn>
                  </div>
                </div>
              </div>
            </SCard>
          )}

          {/* SECTION 3 — LEARNING ROADMAP */}
          <SCard style={{ padding: 28, borderRadius: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiTrendingUp color="#7c3aed" size={18} /> Learning Roadmap Progress
              </div>
              <SBadge color="purple">Milestone 3 / 5</SBadge>
            </div>

            <div style={{ background: 'var(--s-surface2)', padding: 18, borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>
                {profile?.domain || 'Core Domain'} Specialization Path
              </div>
              <div style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 4 }}>
                Current Milestone: <strong style={{ color: '#7c3aed' }}>Advanced Concepts & Project Portfolio</strong>
              </div>

              <div style={{ background: '#e2e8f0', height: 8, borderRadius: 99, overflow: 'hidden', margin: '12px 0' }}>
                <div style={{ width: `65%`, height: '100%', background: '#7c3aed' }} />
              </div>
            </div>
          </SCard>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* PEER LEARNING QUICK MATCH CARD */}
          {!hiddenWidgetIds.includes('peer-learning') && (
            <SCard style={{ padding: 24, borderRadius: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiUsers color="#0284c7" size={16} /> Peer Learning Network
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', lineHeight: 1.4 }}>
                Connect with domain peers for <strong>Mutual Skill Exchange</strong> or <strong>Learn Together</strong> study sessions.
              </p>
              <button
                type="button"
                onClick={() => navigate('/college/community/mentors')}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, background: '#0284c7', color: '#fff',
                  fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer'
                }}
              >
                Find Study Peers →
              </button>
            </SCard>
          )}

          {/* SKILLS OVERVIEW & ASSESSED BASELINE */}
          <SCard style={{ padding: 24, borderRadius: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiZap color="#f59e0b" size={16} /> Knowledge Baseline & Skills
            </div>

            {profile?.onboardingBaseline?.currentBaseline && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: 'var(--s-text2)', lineHeight: 1.4 }}>
                <strong>Assessed Baseline:</strong> {profile.onboardingBaseline.currentBaseline}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#047857' }}>Demonstrated Strengths</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {((profile?.onboardingBaseline?.strengths || profile?.strengths || discoveryResult?.strongDimensions) && (profile?.onboardingBaseline?.strengths || profile?.strengths || discoveryResult?.strongDimensions).length > 0) ? (
                  (profile?.onboardingBaseline?.strengths || profile?.strengths || discoveryResult?.strongDimensions).map((s, i) => (
                    <span key={i} style={{ fontSize: 11, background: '#d1fae5', color: '#047857', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>✓ {s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>Complete career assessment to discover strengths</span>
                )}
              </div>
            </div>

            {profile?.onboardingBaseline?.areasToStrengthen?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#b45309' }}>Target Improvement Areas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {profile.onboardingBaseline.areasToStrengthen.map((a, i) => (
                    <span key={i} style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>🎯 {a}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#1d4ed8' }}>Active Profile Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {profile?.skills && profile.skills.length > 0 ? (
                  profile.skills.map((s, i) => (
                    <span key={i} style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>⚡ {s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>No profile skills added yet</span>
                )}
              </div>
            </div>
          </SCard>

          {/* QUICK ACTIONS */}
          <SCard style={{ padding: 24, borderRadius: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiSliders color="var(--s-primary)" size={16} /> Quick Actions
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Hackathon Squads', path: '/college/teammate-matchmaker', bg: '#e0e7ff', color: '#4338ca', icon: FiUsers },
                { label: 'Focus Mode', path: '/college/academic/focus', bg: '#0284c7', color: '#fff', icon: FiClock },
                { label: practiceConfig.navLabel, path: '/college/practice', bg: '#ede9fe', color: '#6d28d9', icon: practiceConfig.isComputing ? FiCode : FiActivity },
                { label: 'Ask AI', path: '/college/advisor/chat', bg: '#f1f5f9', color: '#475569', icon: FiCompass },
                { label: 'Study Planner', path: '/college/academic/planner', bg: '#fef3c7', color: '#b45309', icon: FiSliders },
                { label: 'Peer Network', path: '/college/community/mentors', bg: '#d1fae5', color: '#047857', icon: FiUsers },
                { label: 'Skill Gap', path: '/college/career/skill-gap', bg: '#dbeafe', color: '#1e40af', icon: FiZap }
              ].map(({ label, path, bg, color, icon: Icon }) => (
                <Link key={path} to={path} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: 10, background: 'var(--s-surface2)', borderRadius: 12, textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--s-text)' }}>{label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </SCard>
        </div>
      </div>

      {/* ── CUSTOMIZE DASHBOARD MODAL ────────────────────────────────────────── */}
      {showCustomizeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Customize Dashboard Widgets
              </h3>
              <button type="button" onClick={() => setShowCustomizeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <FiX size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Toggle visibility of optional dashboard widgets based on your study workflow.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {prioritizedWidgets.map(widget => {
                const isHidden = hiddenWidgetIds.includes(widget.id)
                return (
                  <div key={widget.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{widget.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{widget.subtitle}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHiddenWidgetIds(prev => isHidden ? prev.filter(id => id !== widget.id) : [...prev, widget.id])}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        background: isHidden ? '#f1f5f9' : '#dcfce7',
                        color: isHidden ? '#64748b' : '#15803d',
                        border: 'none'
                      }}
                    >
                      {isHidden ? 'Hidden' : 'Visible'}
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomizeModal(false)}
              style={{ width: '100%', padding: '12px', borderRadius: 12, background: '#0284c7', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
              Save Customization Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
