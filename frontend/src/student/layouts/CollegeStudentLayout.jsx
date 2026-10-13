import React, { useState } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useStudentAuth } from '../context/StudentAuthContext'
import { CollegeProfileProvider, useCollegeProfile } from '../context/CollegeProfileContext'
import { CollegeThemeProvider, useCollegeTheme } from '../context/CollegeThemeContext'
import { getCollegeFeatureEligibility } from '../services/collegeFeatureEligibilityEngine'
import {
  FiGrid, FiUser, FiCompass, FiZap, FiBriefcase,
  FiFileText, FiAward, FiBookmark, FiTarget, FiBarChart2,
  FiBook, FiMessageSquare, FiLogOut, FiMenu, FiX, FiBell,
  FiBookOpen, FiCpu, FiUsers, FiHelpCircle, FiSettings,
  FiSearch, FiCheckCircle, FiArchive
} from 'react-icons/fi'

// ── SIDEBAR NAVIGATION CONFIG ──────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  {
    title: 'AI Assistant',
    ai: true,
    items: [
      { id: 'chat',      icon: FiMessageSquare, label: 'Ask AI',             to: '/college/advisor/chat' },
      { id: 'advisor',   icon: FiCompass,       label: 'Academic Advisor',   to: '/college/advisor' },
      { id: 'roadmap',   icon: FiTarget,        label: 'Learning Roadmap',   to: '/college/academic/roadmap' },
      { id: 'interview', icon: FiBriefcase,      label: 'Interview Prep',     to: '/college/career/interview-prep' },
      { id: 'notes',     icon: FiBookOpen,       label: 'Notes Summarizer',   to: '/college/study-tools/notes-summarizer' },
      { id: 'practice',  icon: FiHelpCircle,     label: 'Practice Questions', to: '/college/study-tools/practice' },
    ],
  },
  {
    title: 'Career & Placement',
    items: [
      { id: 'resume',    icon: FiFileText,      label: 'Resume Builder',     to: '/college/career/resume' },
      { id: 'ats',       icon: FiCheckCircle,   label: 'ATS Score Checker',  to: '/college/career/ats-checker' },
      { id: 'skill-gap', icon: FiZap,           label: 'Skill Gap Analysis', to: '/college/career/skill-gap' },
    ],
  },
  {
    title: 'Focus & Productivity',
    items: [
      { id: 'focus',     icon: FiCpu,     label: 'Intelligent Focus',   to: '/college/academic/focus' },
      { id: 'analytics', icon: FiBarChart2, label: 'Focus Analytics',   to: '/college/focus/analytics' },
    ],
  },
  {
    title: 'Personal',
    items: [
      { id: 'memories', icon: FiArchive, label: 'My Memories', to: '/college/memories' },
    ],
  },
  {
    title: 'Academic',
    items: [
      { id: 'dashboard',   icon: FiGrid,      label: 'Dashboard',           to: '/college/dashboard' },
      { id: 'profile',     icon: FiUser,      label: 'My Academic Profile', to: '/college/profile' },
      { id: 'planner',     icon: FiBook,      label: 'Study Planner',       to: '/college/academic/planner' },
      { id: 'performance', icon: FiBarChart2, label: 'Performance',         to: '/college/academic/performance' },
    ],
  },
  {
    title: 'Community & Resources',
    items: [
      { id: 'teammates',    icon: FiUsers,         label: 'Hackathon Teammate Finder', to: '/college/teammate-matchmaker', badge: '🔥 SQUAD' },
      { id: 'peer-chat',    icon: FiMessageSquare, label: 'Peer Chat',                 to: '/college/peer-chat' },
      { id: 'mentors',      icon: FiUsers,         label: 'Peer Mentors',              to: '/college/community/mentors' },
      { id: 'doubts',       icon: FiHelpCircle,    label: 'Doubt Resolution',          to: '/college/community/doubts' },
      { id: 'scholarships', icon: FiAward,         label: 'Scholarships',              to: '/college/scholarships' },
      { id: 'bookmarks',    icon: FiBookmark,      label: 'Saved Items',               to: '/college/bookmarks' },
    ],
  },
]

// ── INNER LAYOUT (has access to theme context) ─────────────────────────────────
function CollegeLayoutInner() {
  const { student, logout } = useStudentAuth()
  const { profile } = useCollegeProfile()
  const flags = getCollegeFeatureEligibility(profile)
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, themeKey } = useCollegeTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isGamified = themeKey === 'gamified'

  // Filter sidebar sections if user uses search bar
  const dynamicSidebarSections = React.useMemo(() => {
    if (!searchQuery.trim()) return SIDEBAR_SECTIONS
    const q = searchQuery.toLowerCase().trim()
    return SIDEBAR_SECTIONS.map(sec => ({
      ...sec,
      items: sec.items.filter(item =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q))
      )
    })).filter(sec => sec.items.length > 0)
  }, [searchQuery])

  const handleLogout = () => {
    logout()
    navigate('/student/signin')
  }

  const isActive = (to) =>
    location.pathname === to || (to !== '/college/dashboard' && location.pathname.startsWith(to))

  const firstName = student?.name?.split(' ')[0] || 'Student'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: theme.contentBg,
      fontFamily: theme.fontBody,
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 89 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className="no-print" style={{
        width: 260,
        background: theme.sidebarBg,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        zIndex: 90,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        transition: 'all 0.3s ease',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 18px 16px',
          borderBottom: `1px solid ${theme.sidebarBorder}`,
        }}>
          <Link to="/college/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: isGamified ? '#00f5d4' : theme.primary,
              color: isGamified ? '#000' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 18, flexShrink: 0,
              boxShadow: isGamified ? '0 0 14px rgba(0,245,212,0.5)' : 'none',
              fontFamily: theme.fontDisplay,
            }}>
              U
            </div>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 900, color: '#fff',
                fontFamily: theme.fontDisplay, lineHeight: 1.2,
                letterSpacing: isGamified ? '0.06em' : '0',
              }}>
                Uyarvu Payanam
              </div>
              <div style={{
                fontSize: 10, fontWeight: 800,
                color: isGamified ? '#00f5d4' : '#34d399',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {isGamified ? '🎮 GAMIFIED MODE' : '💼 College Portal'}
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {dynamicSidebarSections.map((section) => (
            <div key={section.title}>
              {/* Section label */}
              <div style={{ padding: '0 12px 6px', marginTop: 4 }}>
                {section.ai ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: theme.sidebarAiBadgeBg,
                    color: '#fff', fontSize: 9,
                    fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '2px 7px', borderRadius: 6,
                  }}>
                    <FiCpu size={9} /> AI TOOLS
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isGamified ? 'rgba(0,245,212,0.4)' : theme.sidebarSectionLabel,
                  }}>
                    {section.title}
                  </span>
                )}
              </div>

              {/* Nav Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map(({ id, icon: Icon, label, to, badge }) => {
                  const active = isActive(to)
                  return (
                    <Link
                      key={id}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11,
                        padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                        fontSize: 13, fontWeight: active ? 800 : 500,
                        color: active ? theme.sidebarActiveItemColor : theme.sidebarInactiveColor,
                        background: active ? theme.sidebarActiveItemBg : 'transparent',
                        transition: 'all 0.15s ease',
                        borderLeft: active && isGamified ? `3px solid ${theme.primary}` : '3px solid transparent',
                        boxShadow: active && isGamified ? `0 0 10px rgba(0,245,212,0.15)` : 'none',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = theme.sidebarHoverBg }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon size={15} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {badge && !active && (
                        <span style={{
                          fontSize: 8, fontWeight: 900,
                          background: 'rgba(99,102,241,0.25)', color: '#818cf8',
                          padding: '2px 6px', borderRadius: 5, letterSpacing: '0.05em'
                        }}>{badge}</span>
                      )}
                      {section.ai && !active && (
                        <span style={{
                          fontSize: 8, fontWeight: 800,
                          color: isGamified ? '#00f5d4' : '#6366f1',
                          letterSpacing: '0.05em', opacity: 0.7,
                        }}>AI</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + User Card at bottom */}
        <div style={{ borderTop: `1px solid ${theme.sidebarBorder}` }}>
          {/* Settings Link */}
          <Link
            to="/college/settings"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
              color: isActive('/college/settings') ? theme.sidebarActiveItemColor : theme.sidebarInactiveColor,
              background: isActive('/college/settings') ? theme.sidebarActiveItemBg : 'transparent',
              transition: 'background 0.15s',
              borderTop: `1px solid ${theme.sidebarBorder}`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.sidebarHoverBg}
            onMouseLeave={e => e.currentTarget.style.background = isActive('/college/settings') ? theme.sidebarActiveItemBg : 'transparent'}
          >
            <FiSettings size={15} />
            Settings
            {isGamified && (
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#f72585', fontWeight: 800 }}>THEME</span>
            )}
          </Link>

          {/* User card */}
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: isGamified ? 'rgba(0,245,212,0.2)' : '#3b82f6',
              color: isGamified ? '#00f5d4' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, flexShrink: 0,
              boxShadow: isGamified ? '0 0 8px rgba(0,245,212,0.3)' : 'none',
            }}>
              {student?.name?.[0] || 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {student?.name}
              </div>
              <div style={{ fontSize: 11, color: theme.sidebarInactiveColor, fontWeight: 600 }}>
                {isGamified ? '⚡ Active Player' : 'College Student'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, flexShrink: 0 }}
            >
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTENT AREA ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Header */}
        <header className="no-print" style={{
          height: 60,
          background: theme.headerBg,
          borderBottom: `1px solid ${theme.headerBorder}`,
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 80, flexShrink: 0,
          transition: 'all 0.3s ease',
        }}>
          {/* Left: mobile toggle + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setMobileOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: theme.text2, cursor: 'pointer', display: 'none' }}
              className="mobile-toggle-btn"
            >
              {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>

            {/* Search bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isGamified ? 'rgba(0,245,212,0.05)' : '#f1f5f9',
              border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`,
              borderRadius: 10, padding: '6px 12px', width: 240,
            }}>
              <FiSearch size={14} color={theme.text3} />
              <input
                type="text"
                placeholder="Search portal..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  fontSize: 13, color: theme.text,
                  fontFamily: theme.fontBody, width: '100%',
                }}
              />
            </div>
          </div>

          {/* Right: Ask AI + Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Theme badge */}
            <Link
              to="/college/settings"
              style={{
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 800,
                color: isGamified ? '#00f5d4' : theme.text3,
                padding: '4px 10px', borderRadius: 8,
                background: isGamified ? 'rgba(0,245,212,0.08)' : '#f1f5f9',
                border: `1px solid ${isGamified ? 'rgba(0,245,212,0.2)' : '#e2e8f0'}`,
              }}
            >
              {isGamified ? '🎮' : '💼'} {isGamified ? 'Gamified' : 'Professional'}
            </Link>

            <Link
              to="/college/advisor/chat"
              style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                background: isGamified ? 'linear-gradient(90deg,#00f5d4,#f72585)' : theme.primary,
                color: isGamified ? '#000' : '#fff',
                padding: '7px 15px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                boxShadow: isGamified ? '0 0 12px rgba(0,245,212,0.3)' : 'none',
              }}
            >
              <FiCompass size={13} /> Ask AI Advisor
            </Link>

            <Link
              to="/college/notifications"
              style={{
                textDecoration: 'none', width: 34, height: 34, borderRadius: 10,
                background: isGamified ? 'rgba(0,245,212,0.08)' : '#f8fafc',
                border: `1px solid ${isGamified ? 'rgba(0,245,212,0.2)' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.text2,
              }}
            >
              <FiBell size={15} />
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main style={{
          flex: 1,
          padding: '26px 30px',
          overflowY: 'auto',
          background: theme.contentBg,
          transition: 'background 0.3s ease',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── WRAPPER (injects theme & profile providers) ───────────────────────────────
export default function CollegeStudentLayout() {
  return (
    <CollegeProfileProvider>
      <CollegeThemeProvider>
        <CollegeLayoutInner />
      </CollegeThemeProvider>
    </CollegeProfileProvider>
  )
}

