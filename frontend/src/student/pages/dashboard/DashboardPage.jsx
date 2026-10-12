import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import studentApi from '../../services/studentApi'
import { userActionService } from '../../../services/userActionService'
import { SBtn, SLoader, SSectionHeader, SEmpty, SBadge, SCard } from '../../components/ui'
import {
  FiGrid, FiBookOpen, FiMapPin, FiFileText, FiAward,
  FiBell, FiUser, FiLogOut, FiArrowRight,
  FiClock, FiMenu, FiX,
} from 'react-icons/fi'
import s from './DashboardPage.module.css'
import MentorRequestModal from '../../components/mentor/MentorRequestModal'
import onboardingService from '../../../services/onboardingService'
import class5CommunicationService from '../../../services/class5CommunicationService'

/* ΓöÇΓöÇ Sidebar navigation config ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const SIDEBAR_NAV = [
  { id: 'dashboard',     icon: FiGrid,     label: 'Dashboard',      to: '/student/dashboard' },
  { id: 'bookmarks',     icon: FiAward,    label: 'My Bookmarks',   to: '/student/bookmarks' },
  { id: 'courses',       icon: FiBookOpen, label: 'Courses',        to: '/student/courses' },
  { id: 'colleges',      icon: FiMapPin,   label: 'Colleges',       to: '/student/colleges' },
  { id: 'exams',         icon: FiFileText, label: 'Entrance Exams', to: '/student/careers' },
  { id: 'scholarships',  icon: FiAward,    label: 'Scholarships',   to: '/student/scholarships' },
  { id: 'notifications', icon: FiBell,     label: 'Notifications',  to: '/student/notifications' },
  { id: 'profile',       icon: FiUser,     label: 'Profile',        to: '/student/profile' },
]

/* Removed: stat card gradients (Phase 1K ΓÇö green-on-white surface cards) */

/* ΓöÇΓöÇ Recommended careers (static fallback & dynamic mapping) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const CAREER_CARDS = [
  { icon: 'ΓÜÖ∩╕Å', title: 'Engineering',  sub: 'Build the future',      bg: '#e0f2fe', color: '#0369a1' },
  { icon: '≡ƒ⌐║', title: 'Medicine',     sub: 'Heal & innovate',       bg: '#d1fae5', color: '#047857' },
  { icon: '≡ƒôè', title: 'Commerce',     sub: 'Business & finance',    bg: '#fef3c7', color: '#b45309' },
  { icon: '≡ƒÄ¿', title: 'Arts',         sub: 'Create & express',      bg: '#f1f5f9', color: '#475569' },
]

/* Career-icon pastel pairs are kept to four families (blue/green/slate/gold)
   so the dashboard reads as one palette. Icons are content glyphs. */
const CAREER_CARDS_PAIRS = {
  blue:  { bg: '#e0f2fe', color: '#0369a1' },
  green: { bg: '#d1fae5', color: '#047857' },
  gold:  { bg: '#fef3c7', color: '#b45309' },
  slate: { bg: '#f1f5f9', color: '#475569' },
}

const CAREER_INFO_MAP = {
  'Engineering': { icon: 'ΓÜÖ∩╕Å', sub: 'Build the future', ...CAREER_CARDS_PAIRS.blue },
  'IT': { icon: '≡ƒÆ╗', sub: 'Tech & Software', ...CAREER_CARDS_PAIRS.blue },
  'Data Science': { icon: '≡ƒôê', sub: 'Analytics & AI', ...CAREER_CARDS_PAIRS.blue },
  'Polytechnic': { icon: '≡ƒöº', sub: 'Technical Skills', ...CAREER_CARDS_PAIRS.green },
  'Medical': { icon: '≡ƒ⌐║', sub: 'Heal & innovate', ...CAREER_CARDS_PAIRS.green },
  'Nursing': { icon: '≡ƒÅÑ', sub: 'Patient Care', ...CAREER_CARDS_PAIRS.green },
  'Pharmacy': { icon: '≡ƒÆè', sub: 'Medicine expert', ...CAREER_CARDS_PAIRS.green },
  'Agriculture': { icon: '≡ƒî▒', sub: 'Farming & Science', ...CAREER_CARDS_PAIRS.green },
  'Biotechnology': { icon: '≡ƒº¼', sub: 'Bio & Tech', ...CAREER_CARDS_PAIRS.blue },
  'Design': { icon: '≡ƒÄ¿', sub: 'Create & express', ...CAREER_CARDS_PAIRS.slate },
  'Media': { icon: '≡ƒÄ¼', sub: 'Broadcast & Film', ...CAREER_CARDS_PAIRS.slate },
  'Teaching': { icon: '≡ƒæ⌐ΓÇì≡ƒÅ½', sub: 'Educate the next gen', ...CAREER_CARDS_PAIRS.green },
  'Journalism': { icon: '≡ƒô░', sub: 'News & Writing', ...CAREER_CARDS_PAIRS.slate },
  'Arts': { icon: '≡ƒÄ¡', sub: 'Culture & Expression', ...CAREER_CARDS_PAIRS.slate },
  'Commerce': { icon: '≡ƒôè', sub: 'Business & finance', ...CAREER_CARDS_PAIRS.gold },
  'CA': { icon: '≡ƒº«', sub: 'Accountancy', ...CAREER_CARDS_PAIRS.gold },
  'B.Com': { icon: '≡ƒÆ╝', sub: 'Bachelor of Commerce', ...CAREER_CARDS_PAIRS.gold },
  'Business': { icon: '≡ƒÅó', sub: 'Enterprise', ...CAREER_CARDS_PAIRS.blue },
  'Management': { icon: '≡ƒæö', sub: 'Lead & organize', ...CAREER_CARDS_PAIRS.blue },
  'Civil Services': { icon: '≡ƒÅ¢∩╕Å', sub: 'Public Administration', ...CAREER_CARDS_PAIRS.slate },
  'Law': { icon: 'ΓÜû∩╕Å', sub: 'Justice & Rights', ...CAREER_CARDS_PAIRS.slate },
  'Public Administration': { icon: '≡ƒôï', sub: 'Government operations', ...CAREER_CARDS_PAIRS.slate }
};

const getDefaultCareerCard = (title) => ({
  icon: '≡ƒÄô', title, sub: 'Explore this path', ...CAREER_CARDS_PAIRS.slate
});

/* ΓöÇΓöÇ TimeAgo helper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(d) {
  if (!d) return 'ΓÇö'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ 
   DASHBOARD PAGE
   ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
import { Navigate } from 'react-router-dom'

export default function DashboardPage() {
  const { student, logout } = useStudentAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (student?.userType === 'college_student') {
    return <Navigate to="/college/dashboard" replace />
  }

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isClass5 = student?.classLevel === '5' || student?.classLevel === '5th' || student?.classLevel === 'Class 5';
  const [commProgress, setCommProgress] = useState(null);

  useEffect(() => {
    if (!student?._id || !isClass5) return;
    class5CommunicationService.getProgress().then(res => {
      if (res.success) {
        setCommProgress(res.data);
      }
    }).catch(err => console.error("Error fetching comm progress:", err));
  }, [student?._id, isClass5]);

  /* ΓöÇΓöÇ Data state ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [exams, setExams] = useState([])
  const [scholarships, setScholarships] = useState([])
  const [stats, setStats] = useState({ courses: 0, exams: 0, scholarships: 0, colleges: 0 })
  const [savedGuidance, setSavedGuidance] = useState([])
  const [mentorRequests, setMentorRequests] = useState([])
  const [recommendedCareerCards, setRecommendedCareerCards] = useState(CAREER_CARDS)
  const [loading, setLoading] = useState(true)
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false)
  const [recommendation, setRecommendation] = useState(null)
  const [summaryStudent, setSummaryStudent] = useState(null)
  const [retaking, setRetaking] = useState(false)

  /* ΓöÇΓöÇ Fetch dashboard summary on mount ΓÇö single API ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  useEffect(() => {
    // Phase 6B ΓÇö one call replaces the nine parallel requests (notifications,
    // careers, exams, scholarships, courses, colleges, saved items, mentor
    // requests, legacy recommendation). Identity is supplied by the axios
    // auth interceptor (Bearer token) ΓÇö no userId/studentId is sent.
    // Sections are read directly from the summary shape, NOT through the old
    // normalize() helper (which cannot see sections.notifications.items).
    studentApi.get('/dashboard-summary')
      .then((res) => {
        const summary = res.data
        try {
          const sections = summary?.sections || {}
          const notifData = sections.notifications || { items: [], unreadCount: 0 }

          setNotifications((notifData.items || []).slice(0, 3))
          setUnreadCount(notifData.unreadCount || 0)

          setExams(Array.isArray(sections.exams) ? sections.exams.slice(0, 4) : [])

          setScholarships(Array.isArray(sections.scholarships) ? sections.scholarships.slice(0, 3) : [])

          // Stats are the server-computed counts ΓÇö do NOT reconstruct them
          // from the section arrays (those are capped display lists, while
          // the stats are true class-aware counts).
          setStats({
            courses: summary?.stats?.courses ?? 0,
            exams: summary?.stats?.exams ?? 0,
            scholarships: summary?.stats?.scholarships ?? 0,
            colleges: summary?.stats?.colleges ?? 0,
          })

          if (Array.isArray(sections.savedItems)) {
            setSavedGuidance(sections.savedItems)
          }

          if (Array.isArray(sections.mentorRequests)) {
            setMentorRequests(sections.mentorRequests)
          }

          // Fresh student snapshot ΓÇö verifyStudent refetches the user per
          // request, so this is newer than the context login snapshot.
          if (summary?.student) {
            setSummaryStudent(summary.student)
          }

          // Process the legacy Recommendation (source: sections.recommendation).
          // No LD / LearningRecommendation mapping is introduced here.
          const recData = sections.recommendation || null;
          setRecommendation(recData);

          if (recData) {
            const isClass5  = student?.classLevel === '5'  || student?.classLevel === '5th'  || student?.classLevel === 'Class 5';
            const isClass8  = student?.classLevel === '8'  || student?.classLevel === '8th'  || student?.classLevel === 'Class 8';
            const isClass10 = student?.classLevel === '10' || student?.classLevel === '10th' || student?.classLevel === 'Class 10';
            const isClass12 = student?.classLevel === '12' || student?.classLevel === '12th' || student?.classLevel === 'Class 12';

            if ((isClass5 || isClass8 || isClass10 || isClass12) && recData.fetchedClass5Content) {
              // Map Class 5 Content to Cards
              const skills = recData.fetchedClass5Content.skills || [];
              const mappedSkills = skills.map(s => ({
                title: s.title,
                sub: s.category || 'Skill',
                icon: '≡ƒÜÇ',
                bg: '#e0f2fe',
                color: '#0369a1',
                link: `/student/career-path/class-5/${s.slug}`
              }));
              setRecommendedCareerCards(mappedSkills);
            } else if (recData?.recommendedCareers?.length > 0) {
              const recCareers = recData.recommendedCareers;
              const mappedCards = recCareers.map(c => {
                if (CAREER_INFO_MAP[c]) {
                  return { title: c, ...CAREER_INFO_MAP[c] }
                }
                return getDefaultCareerCard(c)
              });
              setRecommendedCareerCards(mappedCards);
            }
          }
        } catch (err) {
          console.error("Error processing dashboard data:", err)
        } finally {
          setLoading(false)
        }
      })
      .catch((err) => {
        // e.g. network failure ΓÇö keep the page usable with the empty
        // fallbacks. A 401 is handled by the studentApi interceptor, which
        // clears the token and redirects to sign-in.
        console.error("Error fetching dashboard summary:", err)
        setLoading(false)
      })
  }, [student?._id])

  /* ΓöÇΓöÇ Derived ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  // Prefer the fresh summary student snapshot; fall back to the context
  // login snapshot so the page still renders if the summary student is ever
  // absent. The summary student is refetched server-side per request.
  const viewStudent = summaryStudent || student
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = viewStudent?.name?.split(' ')[0] || 'Student'

  const handleLogout = () => {
    logout()
    navigate('/student/signin')
  }

  const handleRetake = async () => {
    if (!window.confirm("Are you sure you want to retake the assessment? Your previous results will be reset.")) return;
    setRetaking(true);
    try {
      await onboardingService.retakeAssessment(student?._id || student?.id);
      // Update student context
      const updatedStudent = { ...student, onboardingCompleted: false, recommendationGenerated: false };
      const token = localStorage.getItem('studentToken');
      logout(); // We need to re-login or just update context. logout is safer or just reload.
      window.location.href = '/student/onboarding';
    } catch (err) {
      console.error("Retake failed", err);
    } finally {
      setRetaking(false);
    }
  }

  const handleUnsave = async (contentId) => {
    try {
      await userActionService.unsaveItem(contentId)
      setSavedGuidance(prev => prev.filter(item => {
        const id = item.contentId?._id || item.contentId
        return id !== contentId
      }))
    } catch (err) {
      console.error('Failed to remove saved item', err)
    }
  }

  /* ΓöÇΓöÇ Stat card data ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  const STAT_CARDS = [
    { icon: '≡ƒôÜ', label: 'Courses Available', value: stats.courses },
    { icon: '≡ƒô¥', label: 'Entrance Exams', value: stats.exams },
    { icon: '≡ƒÄô', label: 'Scholarships', value: stats.scholarships },
    { icon: '≡ƒÅ½', label: 'Colleges', value: stats.colleges },
  ]

  return (
    <div className={s.layout}>

      {/* ΓöÇΓöÇ SIDEBAR ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      {sidebarOpen && <div className={s.overlay} onClick={() => setSidebarOpen(false)} />}

      <aside className={`${s.sidebar} ${sidebarOpen ? s.sidebarOpen : ''}`}>
        <div className={s.sidebarLabel}>Menu</div>

        {SIDEBAR_NAV.filter(item => {
          const isJunior = ['5', '8', '5th', '8th'].includes(String(viewStudent?.classLevel));
          if (isJunior && ['courses', 'colleges'].includes(item.id)) return false;
          return true;
        }).map(({ id, icon: Icon, label, to }) => {
          const isActive = location.pathname === to || (to !== '/student/dashboard' && location.pathname.startsWith(to))
          return (
            <Link
              key={id}
              to={to}
              className={`${s.navItem} ${isActive ? s.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} />
              {label}
              {id === 'notifications' && unreadCount > 0 && (
                <span className={s.navBadge}>{unreadCount}</span>
              )}
            </Link>
          )
        })}

        <div className={s.sidebarDivider} />

        <button
          className={`${s.navItem} ${s.navItemDanger}`}
          onClick={handleLogout}
        >
          <FiLogOut size={16} />
          Logout
        </button>

        {/* Profile card at bottom */}
        <div className={s.sidebarBottom}>
          <div className={s.profileCard}>
            <div className={s.profileAvatar}>
              {viewStudent?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <div className={s.profileName}>{firstName}</div>
              <div className={s.profileSub}>
                {viewStudent?.classLevel ? `Class ${viewStudent.classLevel}` : 'Student'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        className={s.mobileToggle}
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <FiX /> : <FiMenu />}
      </button>

      {/* ΓöÇΓöÇ MAIN CONTENT ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className={s.main}>

        {/* Welcome Banner */}
        <div className={`${s.welcomeBanner} s-anim-up`}>
          <div className={s.welcomeGreet}>{greet}</div>
          <div className={s.welcomeName}>Welcome back, {firstName}!</div>
          <div className={s.welcomeDesc}>
            Explore your future career paths, find the right colleges, and never miss an exam deadline.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <SBtn variant="primary" onClick={() => setIsMentorModalOpen(true)}>
              Talk to Mentor
            </SBtn>
            {String(viewStudent?.classLevel).includes('12') && (
              <SBtn variant="white" onClick={() => navigate('/student/colleges')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                Explore Colleges
              </SBtn>
            )}
          </div>
          <div className={s.welcomeBadges}>
            {viewStudent?.classLevel && <span className={s.welcomeTag}>Class {viewStudent.classLevel}</span>}
            {viewStudent?.district && <span className={s.welcomeTag}>{viewStudent.district}</span>}
            {unreadCount > 0 && <span className={s.welcomeTag}>{unreadCount} new alert{unreadCount > 1 ? 's' : ''}</span>}
          </div>
        </div>

        {loading ? (
          <SLoader />
        ) : (
          <>
            {/* ΓöÇΓöÇ Statistics Cards ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            <div className={`${s.statsGrid} s-anim-up s-d1`}>
              {STAT_CARDS.filter(stat => {
                const isVeryJunior = ['5', '8', '5th', '8th'].includes(String(viewStudent?.classLevel));
                if (isVeryJunior && (stat.label === 'Courses Available' || stat.label === 'Colleges')) return false;
                return true;
              }).map((stat) => (
                <div
                  key={stat.label}
                  className={s.statCard}
                >
                  <div className={s.statIcon}>{stat.icon}</div>
                  <div className={s.statValue}>{stat.value}</div>
                  <div className={s.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ΓöÇΓöÇ My Skill Recommendation (Class 5, 8, 10, 12) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            {(['5', '5th', 'Class 5', '8', '8th', 'Class 8', '10', '10th', 'Class 10', '12', '12th', 'Class 12'].includes(String(viewStudent?.classLevel))) && recommendation && (
              <div className="s-anim-up s-d2" style={{ marginBottom: 32 }}>
                <SSectionHeader
                  title="My Personalized Recommendation"
                  subtitle="Detailed analysis based on your assessment and interests"
                  action={() => navigate('/student/onboarding/result')}
                  actionLabel="View Full Result"
                />
                <SCard style={{ padding: 0, borderRadius: 24, overflow: 'hidden', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #1a7a50 0%, #2d9d6a 100%)',
                    padding: '32px 40px', color: '#fff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9, marginBottom: 8, textTransform: 'uppercase' }}>Overall Score</div>
                        <div style={{ fontSize: 48, fontWeight: 900 }}>{recommendation.scorePercentage}%</div>
                        <div style={{ marginTop: 8 }}><SBadge color="white" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{recommendation.performanceLevel}</SBadge></div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <SBtn variant="white" onClick={() => navigate('/student/onboarding/result')} style={{ borderRadius: 14, fontWeight: 700 }}>
                          View Full Details <FiArrowRight style={{ marginLeft: 8 }} />
                        </SBtn>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ padding: 32, background: '#fff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32 }} className="s-grid-1col">
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                          <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 16, border: '1px solid #bbf7d0' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', marginBottom: 6, textTransform: 'uppercase' }}>Strong Areas</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>{recommendation.strongSkills?.slice(0, 3).join(', ') || 'N/A'}</div>
                          </div>
                          <div style={{ padding: 16, background: '#fef2f2', borderRadius: 16, border: '1px solid #fecaca' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', marginBottom: 6, textTransform: 'uppercase' }}>Skills to Improve</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>{recommendation.weakSkills?.slice(0, 3).join(', ') || 'None'}</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text3)', marginBottom: 8, textTransform: 'uppercase' }}>Recommended Paths</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {recommendation.recommendedStreams?.map(s => (
                              <span key={s} style={{ padding: '6px 14px', background: '#f0f9ff', color: '#0369a1', borderRadius: 10, fontSize: 14, fontWeight: 700, border: '1px solid #bae6fd' }}>{s}</span>
                            ))}
                            {recommendation.recommendedCourses?.map(c => (
                              <span key={c} style={{ padding: '6px 14px', background: '#f0fdf4', color: '#15803d', borderRadius: 10, fontSize: 14, fontWeight: 700, border: '1px solid #bbf7d0' }}>{c}</span>
                            ))}
                            {recommendation.recommendedExams?.map(e => (
                              <span key={e} style={{ padding: '6px 14px', background: '#fffbeb', color: '#b45309', borderRadius: 10, fontSize: 14, fontWeight: 700, border: '1px solid #fde68a' }}>{e}</span>
                            ))}
                          </div>
                        </div>

                        {recommendation.recommendedColleges?.length > 0 && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text3)', marginBottom: 8, textTransform: 'uppercase' }}>Recommended Colleges</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {recommendation.recommendedColleges.map(c => (
                                <span key={c} style={{ padding: '6px 14px', background: '#f0fdf4', color: '#166534', borderRadius: 10, fontSize: 14, fontWeight: 700, border: '1px solid #bbf7d0' }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {recommendation.recommendedCutoffDetails && (
                          <div style={{ marginBottom: 20, padding: 16, background: '#fefce8', borderRadius: 16, border: '1px solid #fef08a' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#854d0e', marginBottom: 6, textTransform: 'uppercase' }}>Cutoff Guidance</div>
                            <p style={{ fontSize: 14, color: '#713f12', margin: 0, fontWeight: 600 }}>{recommendation.recommendedCutoffDetails}</p>
                          </div>
                        )}

                        {recommendation.improvementMessage && (
                          <p style={{ fontSize: 14, color: '#b91c1c', fontWeight: 600, background: '#fff1f2', padding: '10px 16px', borderRadius: 12, margin: 0 }}>
                            Note: {recommendation.improvementMessage}
                          </p>
                        )}
                      </div>

                      <div style={{ padding: 24, background: '#f8fafc', borderRadius: 20, border: '1px solid var(--s-border)', height: 'fit-content' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)', marginBottom: 16 }}>Need Guidance?</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <SBtn variant="primary" size="sm" onClick={() => navigate('/student/guidance')} style={{ width: '100%', justifyContent: 'center' }}>Talk to Mentor</SBtn>
                          <button onClick={handleRetake} disabled={retaking} style={{ background: 'none', border: 'none', color: 'var(--s-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 8 }}>
                            {retaking ? 'Resetting...' : 'Retake Assessment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </SCard>
              </div>
            )}

            {isClass5 && commProgress && (
              <div className="s-anim-up s-d2" style={{ marginBottom: 32 }}>
                <SSectionHeader
                  title="My Skill Journey"
                  subtitle="Track your real-time communication skills and achievements"
                  action={() => navigate('/student/class5/skills/communicationskills')}
                  actionLabel="Go to Interactive Lab"
                />
                <SCard style={{ padding: 32, borderRadius: 24, background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }} className="s-grid-1col">
                    <div>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
                        <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: 18, border: '1px solid #bfdbfe', flex: 1, minWidth: 140 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Communication Level</span>
                          <strong style={{ fontSize: 20, color: '#1e3a8a' }}>Level {commProgress.progress?.level || 1}</strong>
                        </div>
                        <div style={{ padding: '16px 20px', background: '#f0fdf4', borderRadius: 18, border: '1px solid #bbf7d0', flex: 1, minWidth: 140 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Total XP Earned</span>
                          <strong style={{ fontSize: 20, color: '#14532d' }}>{commProgress.progress?.xp || 0} XP</strong>
                        </div>
                        <div style={{ padding: '16px 20px', background: '#fff7ed', borderRadius: 18, border: '1px solid #ffedd5', flex: 1, minWidth: 140 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Current Streak</span>
                          <strong style={{ fontSize: 20, color: '#7c2d12' }}>{commProgress.progress?.streak || 0} Days</strong>
                        </div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 12 }}>Unlocked Badges</span>
                        {commProgress.badges?.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#94a3b8' }}>No badges unlocked yet. Start the journey!</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {commProgress.badges?.map(b => (
                              <span key={b} style={{ padding: '6px 12px', background: '#fef3c7', color: '#b45309', borderRadius: 10, fontSize: 12, fontWeight: 800, border: '1px solid #fde68a' }}>
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Ready to improve your skills?</h4>
                      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
                        Jump back into the Communication Lab to complete games, record speaking tasks, and build your passport.
                      </p>
                      <SBtn variant="primary" onClick={() => navigate('/student/class5/skills/communicationskills')} style={{ justifyContent: 'center' }}>
                        Open Communication Lab
                      </SBtn>
                    </div>
                  </div>
                </SCard>
              </div>
            )}

            {/* ΓöÇΓöÇ Recommended Resources ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            <div className="s-anim-up s-d2" style={{ marginBottom: 28 }}>
              <SSectionHeader
                title={ (['5', '5th', 'Class 5', '8', '8th', 'Class 8', '10', '10th', 'Class 10', '12', '12th', 'Class 12'].includes(String(viewStudent?.classLevel))) ? `Recommended for Class ${viewStudent?.classLevel?.replace(/\D/g, '')}` : "Recommended Careers" }
                subtitle={ (['5', '5th', 'Class 5', '8', '8th', 'Class 8', '10', '10th', 'Class 10', '12', '12th', 'Class 12'].includes(String(viewStudent?.classLevel))) ? "Based on your assessment results." : "Explore popular career paths tailored for your future." }
                action={() => navigate((['5', '5th', 'Class 5', '8', '8th', 'Class 8', '10', '10th', 'Class 10', '12', '12th', 'Class 12'].includes(String(viewStudent?.classLevel))) ? `/student/career-path/class-${viewStudent?.classLevel?.replace(/\D/g, '')}` : '/student/careers')}
                actionLabel="View All"
              />
              <div className={s.careerGrid}>
                {recommendedCareerCards.map((c, idx) => (
                  <Link key={c.title + idx} to={c.link || "/student/careers"} className={s.careerCard}>
                    <div className={s.careerIcon} style={{ background: c.bg }}>
                      {c.icon}
                    </div>
                    <div className={s.careerTitle}>{c.title}</div>
                    <div className={s.careerSub}>{c.sub}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ΓöÇΓöÇ Saved Resources ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            <div id="saved" className="s-anim-up s-d2" style={{ marginBottom: 28 }}>
              <SSectionHeader
                title="Saved Resources"
                subtitle="Your bookmarked careers, exams, and scholarships"
              />
              {savedGuidance.length === 0 ? (
                <SEmpty icon="≡ƒöû" title="No saved resources yet" desc="Bookmark items to keep track of your career journey." />
              ) : (
                <div className={s.savedGrid}>
                  {savedGuidance.map((item, i) => {
                    const c = item.contentId
                    const type = item.contentType
                    if (!c) return null
                    
                    // Dynamic configuration based on item type
                    const typeConfig = {
                      ClassContent: { badge: `Class ${c.targetClass || ''}`, color: 'blue',   link: `/student/career-path/class-${c.targetClass}/${c.slug}` },
                      Exam:         { badge: 'Entrance Exam',               color: 'orange', link: '/student/careers' },
                      Scholarship:  { badge: 'Scholarship',                 color: 'green',  link: `/student/scholarships/${c._id}` },
                      College:      { badge: 'College',                     color: 'gray',   link: `/student/colleges/${c._id}` },
                      Course:       { badge: 'Course',                      color: 'indigo', link: `/student/course/${c.slug}` },
                      CareerPath:   { badge: 'Career Path',                 color: 'gold',   link: `/student/careers/path/${c._id}` }
                    }
                    const config = typeConfig[type] || { badge: type, color: 'gray', link: '#' }

                    return (
                      <div key={item._id || i} className={s.savedCard}>
                        <div className={s.savedCardImg}>
                          <img 
                            src={c.coverImage || c.image || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=400'} 
                            alt="thumbnail" 
                          />
                          <div className={s.savedCardOverlay}>
                             <SBadge color={config.color}>{config.badge}</SBadge>
                          </div>
                        </div>
                        <div className={s.savedCardBody}>
                          <h4 className={s.savedCardTitle}>{c.title || c.name || c.courseName || c.collegeName || c.scholarshipName || 'Untitled Item'}</h4>
                          <div className={s.savedCardActions}>
                            <SBtn variant="primary" size="sm" style={{ flex: 1, borderRadius: '8px' }} onClick={() => navigate(config.link)}>
                              View 
                            </SBtn>
                            <SBtn variant="outline" size="sm" style={{ flex: 1, borderRadius: '8px', color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleUnsave(c._id)}>
                              Remove
                            </SBtn>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ΓöÇΓöÇ My Guidance Requests ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            <div className="s-anim-up s-d2" style={{ marginBottom: 28 }}>
              <SSectionHeader
                title="My Guidance Requests"
                subtitle="Track your interactions with our mentors"
                action={() => setIsMentorModalOpen(true)}
                actionLabel="Request New Guidance"
              />
              {mentorRequests.length === 0 ? (
                <SEmpty icon="≡ƒùú∩╕Å" title="No requests yet" desc="Need help? Talk to our mentors today." />
              ) : (
                <div className={s.mentorGrid}>
                  {mentorRequests.map((req) => (
                    <div key={req._id} className={s.mentorCard}>
                      <div className={s.mentorCardHeader}>
                        <div className={s.mentorTopic}>{req.interest}</div>
                        <SBadge color={
                          req.status === 'Completed' ? 'green' : 
                          req.status === 'In Progress' ? 'blue' : 
                          req.status === 'Rejected' ? 'red' : 'orange'
                        }>
                          {req.status}
                        </SBadge>
                      </div>
                      <div className={s.mentorMessage}>"{req.message}"</div>
                      <div className={s.mentorFooter}>
                        <div className={s.mentorDate}>{formatDate(req.createdAt)}</div>
                        {req.adminNotes && (
                          <div className={s.mentorNote}>
                             <strong>Admin Note:</strong> {req.adminNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ΓöÇΓöÇ 2-Column: Upcoming Exams + Latest Scholarships ΓöÇΓöÇ */}
            <div className={`${s.sectionGrid} s-anim-up s-d3`}>

              {/* Upcoming Exams */}
              <div>
                <SSectionHeader
                  title="Upcoming Exams"
                  subtitle="Important entrance exams and their deadlines."
                />
                {exams.length === 0 ? (
                  <SEmpty icon="≡ƒô¥" title="No exams listed yet" />
                ) : (
                  <div className={s.examList}>
                    {exams.map((exam, i) => {
                      const colors = ['#e0f2fe', '#d1fae5', '#fef3c7', '#f8fafc']
                      const textColors = ['#0369a1', '#047857', '#b45309', '#475569']
                      return (
                        <div key={exam._id || i} className={s.examCard}>
                          <div
                            className={s.examIcon}
                            style={{ background: colors[i % 4], color: textColors[i % 4] }}
                          >
                            ≡ƒô¥
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={s.examTitle}>{exam.name || exam.title || 'Exam'}</div>
                            <div className={s.examMeta}>
                              <FiClock size={11} />
                              {exam.date ? formatDate(exam.date) : exam.lastDate ? formatDate(exam.lastDate) : 'Date TBA'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Latest Scholarships */}
              <div>
                <SSectionHeader
                  title="Latest Scholarships"
                  subtitle="Don't miss these deadlines"
                />
                {scholarships.length === 0 ? (
                  <SEmpty icon="≡ƒÄô" title="No scholarships yet" />
                ) : (
                  <div className={s.scholarshipList}>
                    {scholarships.map((sch, i) => (
                      <div key={sch._id || i} className={s.scholarshipCard}>
                        <div className={s.scholarshipTitle}>
                          {sch.name || sch.title || 'Scholarship'}
                        </div>
                        <div className={s.scholarshipProvider}>
                          {sch.provider || sch.organization || sch.fundedBy || 'Provider N/A'}
                        </div>
                        {(sch.deadline || sch.lastDate) && (
                          <span className={s.scholarshipDeadline}>
                            <FiClock size={11} />
                            {formatDate(sch.deadline || sch.lastDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ΓöÇΓöÇ Notifications Preview ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
            <div className="s-anim-up s-d4" style={{ marginBottom: 28 }}>
              <SSectionHeader
                title="Notifications"
                subtitle="Latest 3 updates from admin"
                action={() => navigate('/student/notifications')}
                actionLabel="View All"
              />
              {notifications.length === 0 ? (
                <SEmpty icon="≡ƒöö" title="No notifications yet" desc="Admin updates will appear here" />
              ) : (
                <div className={s.notifList}>
                  {notifications.map((n, i) => (
                    <div
                      key={n._id || i}
                      className={`${s.notifCard} ${!n.isRead ? s.notifUnread : ''}`}
                    >
                      <div className={s.notifTitle}>
                        {n.title}
                        {!n.isRead && <span className={s.notifDot} />}
                      </div>
                      <div className={s.notifMsg}>
                        {n.message?.substring(0, 120)}{n.message?.length > 120 ? 'ΓÇª' : ''}
                      </div>
                      <div className={s.notifTime}>{timeAgo(n.createdAt)}</div>
                    </div>
                  ))}
                  <Link to="/student/notifications" style={{ textDecoration: 'none' }}>
                    <SBtn variant="ghost" size="sm" style={{ width: '100%', justifyContent: 'center' }}>
                      View All Notifications <FiArrowRight size={13} />
                    </SBtn>
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <MentorRequestModal 
        isOpen={isMentorModalOpen} 
        onClose={() => setIsMentorModalOpen(false)} 
      />
    </div>
  )
}
