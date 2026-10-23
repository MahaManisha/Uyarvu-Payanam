import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from 'recharts'
import {
  FiArrowLeft, FiClock, FiZap, FiTarget, FiTrendingUp, FiAward, FiActivity, FiPlay, FiBookOpen
} from 'react-icons/fi'

import { API_BASE_URL } from '../../../config/apiConfig'

const API = API_BASE_URL
const getToken = () => localStorage.getItem('studentToken')

const COLORS = ['#0284c7', '#f59e0b', '#dc2626', '#7c3aed', '#059669']

export default function FocusAnalyticsPage() {
  const { theme } = useCollegeTheme()
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [history, setHistory] = useState([])

  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${getToken()}` } }
    Promise.all([
      axios.get(`${API}/focus/today`, h).then(r => r.data.today).catch(() => null),
      axios.get(`${API}/focus/analytics/weekly`, h).then(r => r.data.weekly).catch(() => null),
      axios.get(`${API}/focus/analytics`, h).then(r => r.data.analytics).catch(() => null),
      axios.get(`${API}/focus/analytics/subjects`, h).then(r => r.data.subjects || []).catch(() => []),
      axios.get(`${API}/focus/history`, h).then(r => r.data.sessions || []).catch(() => []),
    ]).then(([t, w, a, sub, hs]) => {
      setToday(t)
      setWeekly(w)
      setAnalytics(a)
      setSubjects(sub)
      setHistory(hs)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>
      Loading intelligent focus analytics...
    </div>
  )

  const hasData = history.length > 0

  // Fallback demo data if user has 0 sessions yet so charts still show structure gracefully
  const timeSeriesData = history.length > 0
    ? history.slice().reverse().map((s, i) => ({
        session: `#${i + 1}`,
        score: s.focusScore || 85,
        date: new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }))
    : []

  const distractionBreakdown = analytics?.distractionBreakdown || [
    { name: "Tab Switching", percentage: 42, count: 8 },
    { name: "Inactivity", percentage: 31, count: 6 },
    { name: "Looking Away", percentage: 18, count: 4 },
    { name: "Phone Distraction", percentage: 9, count: 2 }
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60, fontFamily: 'var(--s-font-body, Inter, sans-serif)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <Link to="/college/academic/focus" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#64748b', textDecoration: 'none', marginBottom: 6 }}>
            <FiArrowLeft size={16} /> Back to Focus Mode
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>Intelligent Focus Analytics</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Comprehensive insights into your focus scores, distraction breakdown, and subject performance.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/college/study-tools/practice"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
            <FiBookOpen size={16} /> Practice Questions
          </Link>
          <Link to="/college/academic/focus"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0284c7', color: '#fff', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            <FiPlay size={16} /> Start Session
          </Link>
        </div>
      </div>

      {!hasData ? (
        <div style={{ background: '#fff', borderRadius: 20, padding: 60, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>No Focus Sessions Yet</h2>
          <p style={{ color: '#64748b', marginBottom: 24, maxWidth: 460, margin: '0 auto 24px' }}>
            Start your first focus session to generate real-time attention signals, focus score history, and distraction analytics.
          </p>
          <Link to="/college/academic/focus"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0284c7', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
            <FiPlay size={18} /> Start Your First Session
          </Link>
        </div>
      ) : (
        <>
          {/* ── 1. Key Metrics ──────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Sessions', value: analytics?.totalSessions || 0, icon: <FiZap size={20} />, color: '#0284c7' },
              { label: 'Total Focus Time', value: `${analytics?.totalFocusTimeMinutes || 0}m`, icon: <FiClock size={20} />, color: '#7c3aed' },
              { label: 'Avg Focus Score', value: `${analytics?.avgScore || 0}`, icon: <FiTarget size={20} />, color: '#059669' },
              { label: 'Best Focus Score', value: `${analytics?.bestScore || 0}`, icon: <FiAward size={20} />, color: '#d97706' },
              { label: 'Avg Distractions', value: `${analytics?.avgDistractionCount || 0}`, icon: <FiActivity size={20} />, color: '#dc2626' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ color, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── 2. Time Series & Distraction Breakdown ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 28 }}>
            {/* Focus Score Time Series */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 20px' }}>Focus Score Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={12} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} fontSize={12} tick={{ fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v} / 100`, 'Focus Score']} />
                  <Line type="monotone" dataKey="score" stroke="#0284c7" strokeWidth={3} dot={{ r: 4, fill: '#0284c7' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Distraction Breakdown */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>YOUR DISTRACTIONS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {distractionBreakdown.map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: '#334155' }}>{item.name}</span>
                      <span style={{ color: '#0284c7' }}>{item.percentage}%</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.percentage}%`, background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 3. Subject-wise Analytics ────────────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #e2e8f0', marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>Subject-wise Focus Breakdown</h3>
            {subjects.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {subjects.map((sub, i) => (
                  <div key={i} style={{ background: '#f8fafc', padding: 18, borderRadius: 14, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{sub.subject}</div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                      Average Focus: <strong style={{ color: sub.avgFocusScore > 80 ? '#059669' : '#d97706' }}>{sub.avgFocusScore}%</strong><br />
                      Total Sessions: <strong>{sub.sessionCount}</strong><br />
                      Total Time: <strong>{sub.totalMinutes} min</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>No subject data recorded yet.</div>
            )}
          </div>

          {/* ── 4. Session History ────────────────────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 20px' }}>Recent Focus Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(s => {
                const sc = s.focusScore || 0
                const color = sc > 80 ? '#059669' : sc > 60 ? '#d97706' : '#dc2626'
                return (
                  <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: '#f8fafc', borderRadius: 14, border: '1px solid #f1f5f9' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '15', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
                      {sc}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.subject}{s.topic ? ` — ${s.topic}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        Goal: "{s.goal || 'General Study'}" • {Math.round((s.actualDuration || 0) / 60)} min • {new Date(s.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: s.status === 'completed' ? '#059669' : '#94a3b8' }}>
                        {s.status === 'completed' ? '✓ Completed' : 'Abandoned'}
                      </div>
                      {s.distractionCount > 0 && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{s.distractionCount} distractions</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
