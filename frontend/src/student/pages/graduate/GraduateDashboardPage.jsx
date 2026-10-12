import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import graduateService from '../../../services/graduateService'
import higherStudiesService from '../../services/higherStudiesService'
import { SBtn, SCard, SLoader, SAlert, SBadge } from '../../components/ui'
import {
  FiBriefcase, FiZap, FiTarget, FiBook, FiAward, FiCheckSquare,
  FiArrowRight, FiTrendingUp, FiCheck, FiClock, FiStar, FiFileText,
  FiBarChart2, FiMessageSquare, FiAlertCircle, FiChevronRight,
  FiUsers, FiShield, FiExternalLink
} from 'react-icons/fi'
import {
  calculateProfileCompletionScore,
  getEffectiveAcademicHierarchy,
  generatePersonalizedCareers,
  generatePersonalizedSkillGap,
  generatePersonalizedExamsGuide,
  generatePersonalizedHigherStudies
} from '../../services/graduatePersonalizationEngine'
import GraduateCourseImage from '../../components/common/GraduateCourseImage'

export default function GraduateDashboardPage() {
  const { student } = useStudentAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tasksCompleted, setTasksCompleted] = useState({})
  const [higherStudiesCourses, setHigherStudiesCourses] = useState([])
  const [higherStudiesLoading, setHigherStudiesLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await graduateService.getDashboard()
        if (res.success) {
          setData(res)
        } else {
          setError('Failed to load dashboard data.')
        }
      } catch (err) {
        console.warn('Dashboard fetch error:', err)
        setError('Error connecting to graduate portal services.')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  // Fetch published higher studies courses for recommendations
  useEffect(() => {
    const fetchHigherStudies = async () => {
      setHigherStudiesLoading(true)
      try {
        const params = { limit: '6' }
        const degree = data?.profile?.degree
        if (degree) params.search = degree
        const res = await higherStudiesService.list(params)
        if (res?.success) {
          setHigherStudiesCourses(res.courses || [])
        }
      } catch (err) {
        console.warn('Higher studies fetch error:', err)
      } finally {
        setHigherStudiesLoading(false)
      }
    }
    fetchHigherStudies()
  }, [data?.profile?.degree])

  const toggleTask = (idx) => {
    setTasksCompleted(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <SLoader label="Personalizing your Graduate Dashboard..." />
      </div>
    )
  }

  const profile = data?.profile || {}
  const completion = calculateProfileCompletionScore(profile)
  const academic = getEffectiveAcademicHierarchy(profile)
  const personalizedCareers = generatePersonalizedCareers(profile)
  const topCareer = personalizedCareers[0]
  const skillGap = generatePersonalizedSkillGap(profile, topCareer?.title)
  const examsGuide = generatePersonalizedExamsGuide(profile)
  const higherStudies = generatePersonalizedHigherStudies(profile)
  const readinessScore = data?.careerReadinessScore || Math.min(95, Math.max(45, completion.percentage + 10))

  const isProfileIncomplete = !profile.degree || !profile.domain

  // Opportunity ecosystem data (merged graduate dashboard response)
  const summary = data?.summaryCounts || {}
  const recommended = data?.recommendedOpportunities || []
  const upcomingExams = data?.upcomingExams || []
  const deadlineAlerts = data?.deadlineAlerts || []

  const handleApplyNow = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('Official application URL unavailable or opening soon.')
    }
  }

  return (
    <div className="s-anim-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── 1. WELCOME BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 24, padding: '32px 36px', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 20, boxShadow: '0 10px 25px rgba(15,23,42,0.15)'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
            <FiBriefcase size={13} /> GRADUATE CAREER PERSONALIZATION ENGINE
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', fontWeight: 900, margin: '0 0 8px', color: '#fff' }}>
            Welcome back, {student?.name || 'Graduate'}!
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, maxWidth: 580 }}>
            {academic.fullHierarchyText} • Focused on <strong>{profile.primaryCareerDirection || 'Professional Placement'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/graduate/ai-advisor">
            <SBtn variant="primary" style={{ padding: '12px 24px', borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiMessageSquare /> Ask AI Advisor
            </SBtn>
          </Link>
          <Link to="/graduate/profile">
            <button style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}>
              Update Profile ({completion.percentage}% Complete)
            </button>
          </Link>
        </div>
      </div>

      {error && <SAlert type="error">{error}</SAlert>}

      {/* Missing profile warning banner */}
      {isProfileIncomplete && (
        <div style={{
          background: '#fffbe3', border: '1px solid #fde047', borderRadius: 16, padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FiAlertCircle size={24} color="#d97706" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>
                Complete your Graduate Onboarding
              </div>
              <div style={{ fontSize: 13, color: '#b45309' }}>
                Provide your major field, degree, domain, and skills to unlock precise profile-driven career recommendations.
              </div>
            </div>
          </div>
          <Link to="/graduate/onboarding">
            <SBtn variant="primary" style={{ background: '#d97706', padding: '8px 18px', fontSize: 13 }}>
              Complete Profile →
            </SBtn>
          </Link>
        </div>
      )}

      {/* ── TOP SECTION: GRADUATE SUMMARY CARD ── */}
      <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 28, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
              Student Profile
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4 }}>
              {profile.degree || 'B.E.'} {profile.specialization || 'Computer Science'}
            </div>
            <div style={{ fontSize: 13, color: '#60a5fa', marginTop: 2 }}>
              Graduation Year: <strong>{profile.graduationYear || '2026'}</strong> ({profile.graduationStatus || 'Completed'})
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
              Profile Completion
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${profile.profileCompletion || 85}%`, height: '100%', background: '#3b82f6', borderRadius: 6 }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa' }}>{profile.profileCompletion || 85}%</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
              Primary Career Goal
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
              {(profile.careerInterests || ['Higher Studies', 'Government Exams', 'Private Jobs']).join(' • ')}
            </div>
          </div>
        </div>
      </SCard>

      {/* ── GRADUATE RESUME DASHBOARD WIDGET ── */}
      <SCard style={{ padding: 22, borderRadius: 20, marginBottom: 28, background: '#fff', border: '1px solid var(--s-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              📄
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>MY RESUME</h3>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
                  ✓ Resume Ready
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--s-text3)', marginTop: 2, display: 'flex', gap: 12 }}>
                <span>Target: <strong>{profile.preferredDomains?.[0] || profile.targetCareer || 'Software Engineer'}</strong></span>
                <span>• ATS Score: <strong style={{ color: '#2563eb' }}>{profile.careerReadinessScore || 82}/100</strong></span>
                <span>• Last Updated: <strong>Today</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/graduate/resume-builder">
              <SBtn variant="primary" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>
                [ EDIT RESUME ]
              </SBtn>
            </Link>
            <Link to="/graduate/ats-checker">
              <SBtn variant="secondary" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>
                [ CHECK ATS ]
              </SBtn>
            </Link>
            <Link to="/graduate/resume-builder">
              <SBtn variant="secondary" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>
                [ DOWNLOAD ]
              </SBtn>
            </Link>
          </div>
        </div>
      </SCard>

      {/* -- REAL STATISTICS -- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'Recommended Opportunities', value: data?.stats?.recommendedOpportunities ?? '—', color: '#2563eb' },
          { label: 'Saved Opportunities', value: data?.stats?.savedOpportunities ?? '—', color: '#f59e0b' },
          { label: 'Applications Tracked', value: data?.stats?.applicationsTracked ?? '—', color: '#10b981' },
          { label: 'Upcoming Deadlines', value: data?.stats?.upcomingDeadlines ?? '—', color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {Array.isArray(data?.upcoming) && data.upcoming.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Upcoming application deadlines &amp; exam dates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcoming.slice(0, 5).map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{u.title}</span>
                <span>{u.kind}: {u.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── OPPORTUNITY SUMMARY CARDS (ACTUAL DB COUNTS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>

        <Link to="/graduate/government-exams" style={{ textDecoration: 'none' }}>
          <SCard style={{ padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px solid var(--s-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text2)' }}>Government Exams</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiBook size={16} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--s-text)' }}>
              {summary.governmentExams || 0}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 2 }}>Relevant Opportunities</div>
          </SCard>
        </Link>

        <Link to="/graduate/higher-studies" style={{ textDecoration: 'none' }}>
          <SCard style={{ padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px solid var(--s-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text2)' }}>Higher Studies</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiAward size={16} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--s-text)' }}>
              {summary.higherStudies || 0}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 2 }}>Entrance Routes</div>
          </SCard>
        </Link>

        <Link to="/graduate/opportunities?category=PSU" style={{ textDecoration: 'none' }}>
          <SCard style={{ padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px solid var(--s-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text2)' }}>PSU Recruitment</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiShield size={16} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--s-text)' }}>
              {summary.psuOpportunities || 0}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 2 }}>Maharatna / Navratna</div>
          </SCard>
        </Link>

        <Link to="/graduate/opportunities?category=PRIVATE_JOBS" style={{ textDecoration: 'none' }}>
          <SCard style={{ padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px solid var(--s-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text2)' }}>Private Jobs</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiBriefcase size={16} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--s-text)' }}>
              {summary.privateJobs || 0}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 2 }}>Software & Tech Roles</div>
          </SCard>
        </Link>

        <Link to="/graduate/peer-mentor" style={{ textDecoration: 'none' }}>
          <SCard style={{ padding: 18, borderRadius: 16, background: '#f8fafc', border: '1px solid var(--s-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text2)' }}>Peer Mentorship</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fae8ff', color: '#a21caf', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiUsers size={16} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--s-text)' }}>
              {summary.mentorshipRequests || 0}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 2 }}>Student Requests</div>
          </SCard>
        </Link>

      </div>

      {/* ── PEER MENTORSHIP BANNER FOR GRADUATES ── */}
      {summary.mentorshipRequests > 0 && (
        <SCard style={{ padding: '18px 24px', borderRadius: 18, marginBottom: 28, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🎓
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1e40af' }}>
                🎓 Mentor Requests ({summary.mentorshipRequests})
              </div>
              <div style={{ fontSize: 13, color: '#1e3a8a' }}>
                College students are looking for guidance from graduates like you.
              </div>
            </div>
          </div>
          <Link to="/graduate/peer-mentor">
            <SBtn variant="primary" style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13 }}>
              View Requests <FiArrowRight style={{ marginLeft: 6 }} />
            </SBtn>
          </Link>
        </SCard>
      )}

      {/* ── DEADLINE ALERTS (CALCULATED FROM SERVER CURRENT DATE) ── */}
      {deadlineAlerts.length > 0 && (
        <SCard style={{ padding: 22, borderRadius: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiAlertCircle color="#dc2626" size={18} /> Deadlines Alert — Applications Closing Soon
            </h3>
            <span style={{ fontSize: 12, color: 'var(--s-text3)', fontWeight: 700 }}>
              Current Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deadlineAlerts.map(alert => (
              <div key={alert.id} style={{
                padding: '12px 16px', borderRadius: 12,
                background: alert.urgency === 'RED' ? '#fef2f2' : alert.urgency === 'ORANGE' ? '#fffbe6' : '#f0fdf4',
                border: `1px solid ${alert.urgency === 'RED' ? '#fecaca' : alert.urgency === 'ORANGE' ? '#ffe58f' : '#bbf7d0'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>
                    {alert.title} — <span style={{ fontSize: 13, color: 'var(--s-text3)' }}>{alert.organization}</span>
                  </div>
                  <div style={{ fontSize: 12, color: alert.urgency === 'RED' ? '#dc2626' : alert.urgency === 'ORANGE' ? '#d97706' : '#16a34a', fontWeight: 800, marginTop: 2 }}>
                    {alert.urgency === 'RED' ? '🔴 Apply within 3 days!' : alert.urgency === 'ORANGE' ? '🟠 Apply within 7 days' : '🟢 Upcoming deadline'} — Deadline: {new Date(alert.deadline).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyNow(alert.applicationUrl)}
                  style={{ background: 'var(--s-primary)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Apply Now <FiExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        </SCard>
      )}

      {/* ── 2. METRICS ROW: READINESS SCORE & TOP CAREER MATCH ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

        {/* Career Readiness Score Card */}
        <SCard style={{ borderRadius: 20, padding: 26, border: '1px solid var(--s-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text3)', textTransform: 'uppercase' }}>
              Career Readiness Index
            </span>
            <span style={{ fontSize: 12, background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 20, fontWeight: 800 }}>
              Profile Evidence
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: `conic-gradient(#2563eb ${readinessScore * 3.6}deg, #e2e8f0 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#0f172a' }}>
                {readinessScore}%
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--s-text)', marginBottom: 4 }}>
                {readinessScore >= 75 ? 'Strong Placement Candidate' : readinessScore >= 55 ? 'Developing Candidate' : 'Foundation Building'}
              </div>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: 0, lineHeight: 1.4 }}>
                Calculated from your {academic.domain} qualification and logged skills.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 14, borderTop: '1px solid var(--s-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--s-text2)' }}>
              Skills Logged: <strong>{(profile.technicalSkills || []).length} items</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--s-text2)' }}>
              Profile Score: <strong>{completion.percentage}% complete</strong>
            </div>
          </div>
        </SCard>

        {/* Primary Career Goal Card with Course Image */}
        <SCard style={{ borderRadius: 20, padding: 26, border: '1px solid var(--s-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: 14 }}>
              <GraduateCourseImage course={topCareer} height={140} borderRadius={12} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text3)', textTransform: 'uppercase' }}>
                #1 Personalized Match
              </span>
              {topCareer && (
                <span style={{ fontSize: 12, background: '#d1fae5', color: '#047857', padding: '4px 10px', borderRadius: 20, fontWeight: 800 }}>
                  {topCareer.matchScore}% Match
                </span>
              )}
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 6px' }}>
              {topCareer?.title || 'Software & Technology Specialist'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--s-text3)', marginBottom: 12, lineHeight: 1.5 }}>
              {topCareer?.description || 'Aligns with your academic domain and professional preferences.'}
            </p>

            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10, fontSize: 12, color: '#334155', marginBottom: 14, borderLeft: '3px solid #2563eb' }}>
              <strong>Why it matches:</strong> {topCareer?.whyItMatches}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--s-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>
              Outlook: <strong style={{ color: '#047857' }}>{topCareer?.growthOutlook || 'High Demand'}</strong>
            </span>
            <Link to="/graduate/careers" style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Explore All Matches ({personalizedCareers.length}) <FiArrowRight size={14} />
            </Link>
          </div>
        </SCard>
      </div>

      {/* ── 3. SKILL GAP SUMMARY CHIPS ── */}
      <SCard style={{ borderRadius: 20, padding: 26, border: '1px solid var(--s-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: 'var(--s-text)' }}>
              ⚡ Personalized Skill Gap Benchmarking
            </h3>
            <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: 0 }}>
              Tailored skill requirements for your target <strong>{topCareer?.title}</strong> role.
            </p>
          </div>
          <Link to="/graduate/skill-gap" style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Detailed Gap Analysis <FiArrowRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {/* Matching Skills */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', marginBottom: 10 }}>
              ✓ Verified Candidate Strengths
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skillGap.strongSkills.length > 0 ? (
                skillGap.strongSkills.map((s, idx) => (
                  <span key={idx} style={{ background: '#dcfce7', color: '#14532d', padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                    {s}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#15803d' }}>Academic baseline established</span>
              )}
            </div>
          </div>

          {/* Missing Critical Skills */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
              🎯 Recommended Skills to Acquire
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skillGap.missingCriticalSkills.length > 0 ? (
                skillGap.missingCriticalSkills.map((s, idx) => (
                  <span key={idx} style={{ background: '#fef3c7', color: '#78350f', padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                    • {s}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#b45309' }}>Target skills aligned</span>
              )}
            </div>
          </div>
        </div>
      </SCard>

      {/* ── RECOMMENDED FOR YOU (DETERMINISTIC RANKING 0-100) ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>
              Recommended For You (Eligibility Matched)
            </h2>
            <div style={{ fontSize: 13, color: 'var(--s-text3)' }}>
              Determined by your degree ({profile.degree || 'B.E.'}), specialization, CGPA & career goals.
            </div>
          </div>
          <Link to="/graduate/opportunities">
            <SBtn variant="secondary" style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12 }}>
              View All Opportunities
            </SBtn>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {recommended.map(opp => {
            const evalRes = opp.eligibilityEvaluation || {}
            const isEligible = evalRes.eligible !== false

            return (
              <SCard key={opp._id} style={{ padding: 22, borderRadius: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <SBadge color={isEligible ? 'green' : 'orange'}>
                      {isEligible ? '✓ Appears Eligible' : 'Check Requirements'}
                    </SBadge>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 10 }}>
                      {opp.matchScore || 92}% Match
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16.5, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 4px' }}>
                    {opp.opportunityName}
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--s-text3)', fontWeight: 700, marginBottom: 10 }}>
                    🏛 {opp.organization}
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, margin: '0 0 14px' }}>
                    {opp.description?.substring(0, 130)}...
                  </p>

                  <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid var(--s-border)', marginBottom: 16 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                      Why this is shown:
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>
                      "{evalRes.reasons?.[0] || `Your ${profile.degree || 'B.E.'} degree satisfies the stated criteria.`}"
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--s-border)' }}>
                  <Link to={`/graduate/opportunities/${opp._id}`}>
                    <SBtn variant="secondary" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
                      View Details
                    </SBtn>
                  </Link>

                  <SBtn
                    variant="primary"
                    onClick={() => handleApplyNow(opp.applicationUrl)}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Apply Now <FiExternalLink size={12} />
                  </SBtn>
                </div>
              </SCard>
            )
          })}
        </div>
      </div>

      {/* ── 4. CONDITIONAL MODULES: EXAMS & HIGHER STUDIES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Competitive Exams */}
        <SCard style={{ borderRadius: 20, padding: 24, border: '1px solid var(--s-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiBook style={{ color: '#2563eb' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--s-text)' }}>Competitive Exam Track</span>
            </div>
            <Link to="/graduate/exams" style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textDecoration: 'none' }}>
              View Exam Guide →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {examsGuide.recommendedExams.slice(0, 2).map((ex, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid var(--s-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--s-text)' }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{ex.conductingBody}</div>
                </div>
                <a href={ex.officialUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: 6, fontWeight: 700, textDecoration: 'none' }}>
                  Official Site ↗
                </a>
              </div>
            ))}
          </div>
        </SCard>

        {/* Higher Studies Module */}
        <SCard style={{ borderRadius: 20, padding: 24, border: '1px solid var(--s-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiAward style={{ color: '#047857' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--s-text)' }}>Higher Studies Pathways</span>
            </div>
            <Link to="/graduate/higher-studies" style={{ fontSize: 12, fontWeight: 800, color: '#047857', textDecoration: 'none' }}>
              Explore Pathways →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {higherStudies.programmes.slice(0, 2).map((prog, idx) => (
              <div key={idx} style={{ background: '#f0fdf4', padding: 12, borderRadius: 12, border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>🎓 {prog.title}</div>
                <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>{prog.whyRecommended}</div>
              </div>
            ))}
          </div>
        </SCard>
      </div>

      {/* ── HIGHER STUDIES RECOMMENDATIONS ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>
              Higher Studies For You
            </h2>
            <div style={{ fontSize: 13, color: 'var(--s-text3)' }}>
              Recommended postgraduate courses based on your degree and interests.
            </div>
          </div>
          <Link to="/student/graduate/higher-studies">
            <SBtn variant="secondary" style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12 }}>
              View All Courses
            </SBtn>
          </Link>
        </div>

        {higherStudiesLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--s-text3)' }}>Loading courses...</div>
        ) : higherStudiesCourses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--s-text3)' }}>
            No higher studies courses available at the moment.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {higherStudiesCourses.map(course => (
              <SCard key={course._id} style={{ padding: 20, borderRadius: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#ede9fe', color: '#5b21b6' }}>
                      {course.category}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 4px' }}>{course.title}</h3>
                  <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 8 }}>
                    {course.studyDomain}{course.specialization ? ` · ${course.specialization}` : ''}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, margin: '0 0 10px' }}>
                    {course.shortDescription || course.detailedDescription?.slice(0, 100) + '...'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {course.duration && <span style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: 'var(--s-text3)' }}>{course.duration}</span>}
                    {course.studyMode && <span style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: 'var(--s-text3)' }}>{course.studyMode}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--s-border)' }}>
                  <Link to={`/student/graduate/higher-studies/${course._id}`} style={{ flex: 1 }}>
                    <SBtn variant="primary" style={{ width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12 }}>View Details</SBtn>
                  </Link>
                </div>
              </SCard>
            ))}
          </div>
        )}
      </div>

      {/* ── UPCOMING EXAMS WIDGET ── */}
      <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>
              📅 Verified Upcoming Examinations
            </h3>
            <div style={{ fontSize: 13, color: 'var(--s-text3)' }}>
              Sorted by nearest verified application deadline and examination dates.
            </div>
          </div>
          <Link to="/graduate/government-exams">
            <SBtn variant="secondary" style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12 }}>
              Explore All Exams
            </SBtn>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {upcomingExams.map(exam => (
            <div key={exam._id} style={{ padding: 16, borderRadius: 14, background: '#f8fafc', border: '1px solid var(--s-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <SBadge color={exam.status === 'OPEN' ? 'green' : 'orange'}>
                    {exam.status || 'OPEN'}
                  </SBadge>
                  <span style={{ fontSize: 11, color: '#047857', fontWeight: 800 }}>
                    ✓ Verified Official
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--s-text)' }}>{exam.opportunityName}</div>
                <div style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 2 }}>{exam.organization}</div>

                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--s-text2)' }}>
                  <div>Application Closes: <strong>{exam.applicationDeadline ? new Date(exam.applicationDeadline).toLocaleDateString('en-IN') : 'TBA'}</strong></div>
                  <div>Exam Date: <strong>{exam.examDate ? new Date(exam.examDate).toLocaleDateString('en-IN') : 'As notified'}</strong></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Link to={`/graduate/opportunities/${exam._id}`} style={{ flex: 1 }}>
                  <SBtn variant="secondary" style={{ width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12 }}>
                    Details
                  </SBtn>
                </Link>
                <SBtn variant="primary" onClick={() => handleApplyNow(exam.applicationUrl)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12 }}>
                  Apply Now
                </SBtn>
              </div>
            </div>
          ))}
        </div>
      </SCard>

      {/* ── 5. ACTION PLAN ── */}
      <SCard style={{ borderRadius: 20, padding: 26, border: '1px solid var(--s-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--s-text)' }}>
            📋 Priority Action Roadmap for {academic.domain}
          </h3>
          <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>Stay on track toward {topCareer?.title}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { task: `Complete initial learning module for ${skillGap.missingCriticalSkills[0] || 'core tool'}`, category: 'Skill Building' },
            { task: `Build Capstone Project 1 for ${topCareer?.title || 'portfolio'}`, category: 'Portfolio' },
            { task: `Review ${academic.domain} technical interview questions`, category: 'Interview Prep' },
            { task: `Update resume with metrics for ${topCareer?.title}`, category: 'Placement' }
          ].map((item, idx) => {
            const isDone = tasksCompleted[idx]
            return (
              <div
                key={idx}
                onClick={() => toggleTask(idx)}
                style={{
                  background: isDone ? '#f0fdf4' : '#fff',
                  border: isDone ? '1px solid #86efac' : '1px solid var(--s-border)',
                  padding: 16, borderRadius: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: isDone ? '2px solid #16a34a' : '2px solid #cbd5e1',
                    background: isDone ? '#16a34a' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                  }}>
                    {isDone && <FiCheck size={14} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? '#15803d' : 'var(--s-text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {item.task}
                  </span>
                </div>
                <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  {item.category}
                </span>
              </div>
            )
          })}
        </div>
      </SCard>

    </div>
  )
}
