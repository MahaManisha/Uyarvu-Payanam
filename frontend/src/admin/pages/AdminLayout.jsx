import React, { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import styles from './AdminLayout.module.css'
import NotificationBell from '../components/NotificationBell'
import uyarvuLogo from '../../uyarvu-logo.png'
import { streamLabel } from '../../services/seatMatrixService'

// Pages
import Dashboard from './admin/Dashboard'
import UsersPage from './admin/UsersPage'
import CareersPage from './admin/CareersPage'
import StreamsPage from './admin/StreamsPage'
import ClassDashboardPage from './admin/ClassDashboardPage'
import ClassFormPage from './admin/ClassFormPage'
import CoursesPage from './admin/CoursesPage'
import ExamsPage from './admin/ExamsPage'
import CollegesPage from './admin/CollegesPage'
import CoursesCollegesPage from './admin/CoursesCollegesPage'
import CourseCollegesAdminPage from './admin/CourseCollegesAdminPage'
import StreamSelectorPage from './admin/StreamSelectorPage'
import ScholarshipsPage from './admin/ScholarshipsPage'
import CutoffPage from './admin/CutoffPage'
import NotificationsPage from './admin/NotificationsPage'
import ReportsPage from './admin/ReportsPage'
import SettingsPage from './admin/SettingsPage'
import CareerDetailsPage from './admin/CareerDetailsPage'
import CourseDetailsEditPage from './admin/CourseDetailsEditPage'
import CollegeCourseMappingPage from './admin/CollegeCourseMappingPage'
import MentorRequestsPage from './admin/MentorRequestsPage'
import OnboardingManagementPage from './admin/OnboardingManagementPage'
import AssessmentManagementPage from './admin/AssessmentManagementPage'
import AdmissionHelpRequestsPage from './admin/AdmissionHelpRequestsPage'
import RecommendationRulesPage from './admin/RecommendationRulesPage'

import AcademicTaxonomyManagementPage from './admin/AcademicTaxonomyManagementPage'
import CollegeCareerCatalogManagementPage from './admin/CollegeCareerCatalogManagementPage'
import CollegeStudentsPage from './admin/CollegeStudentsPage'
import CollegeScholarshipsPage from './admin/CollegeScholarshipsPage'
import HigherStudiesPage from './admin/HigherStudiesPage'

import GraduateExamsHome from './admin/graduate/GraduateExamsHome'
import GraduateStatesPage from './admin/graduate/GraduateStatesPage'
import GraduateStatePage from './admin/graduate/GraduateStatePage'
import GraduateCentralPage from './admin/graduate/GraduateCentralPage'
import GraduateOrgExamsPage from './admin/graduate/GraduateOrgExamsPage'
import GraduateExamFormPage from './admin/graduate/GraduateExamFormPage'

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', path: '' },
  { id: 'users', icon: '👥', label: 'School Students', path: 'users' },
  { id: 'college-students', icon: '🎓', label: 'College Students', path: 'college-students' },
  { id: 'taxonomy', icon: '🏛️', label: 'Academic Taxonomy', path: 'taxonomy' },
  { id: 'college-careers', icon: '💼', label: 'College Career Catalog', path: 'college-careers' },
  { id: 'admission-help', icon: '🎓', label: 'Admission Help', path: 'admission-help' },
  { id: 'mentor', icon: '🤝', label: 'Guidance Requests', path: 'mentor-requests' },
  { id: 'careers', icon: '🎯', label: 'Career Paths', path: 'careers' },
  { id: 'streams', icon: '🧭', label: 'Streams After 10th', path: 'streams' },
  { id: 'courses', icon: '📘', label: 'Course Management', path: 'courses' },
  { id: 'exams', icon: '📝', label: 'Exam Management', path: 'exams' },
  { id: 'graduate-exams', icon: '🏅', label: 'Graduate Exams', path: 'graduate-exams' },
  { id: 'colleges', icon: '🏫', label: 'College Management', path: 'colleges' },
  { id: 'courses-colleges', icon: '📚', label: 'Courses & Colleges', path: 'courses-colleges' },
  { id: 'scholarships', icon: '🎓', label: 'School Scholarships', path: 'scholarships' },
  { id: 'college-scholarships', icon: '🏆', label: 'College Scholarships', path: 'college-scholarships' },
  { id: 'cutoff', icon: '📈', label: 'Cutoff Management', path: 'cutoff' },
  { id: 'notifications', icon: '🔔', label: 'Notifications', path: 'notifications' },
  { id: 'reports', icon: '📉', label: 'Reports & Analytics', path: 'reports' },
  { id: 'mapping', icon: '🔗', label: 'Course offered colleges', path: 'mapping' },
  { id: 'assessment', icon: '🧠', label: 'Assessment Management', path: 'assessment' },
  { id: 'onboarding', icon: '📝', label: 'Onboarding Management', path: 'onboarding' },
  { id: 'recommendation-rules', icon: '🧩', label: 'Recommendation Rules', path: 'recommendation-rules' },
  { id: 'settings', icon: '⚙️', label: 'Settings', path: 'settings' },
  { id: 'higher-studies', icon: '🎓', label: 'Higher Studies', path: 'higher-studies' },
]

const PAGE_META = {
  '': { title: 'Dashboard', sub: 'Overview & Analytics' },
  'users': { title: 'User Management', sub: 'Manage school student accounts' },
  'college-students': { title: 'College Student Management', sub: 'Higher education student accounts, profiles & roadmaps' },
  'taxonomy': { title: 'Academic Taxonomy', sub: 'Manage fields, degrees, domains & specializations' },
  'college-careers': { title: 'College Career Catalog', sub: 'Manage career entities & required skills' },
  'admission-help': { title: 'Admission Help Requests', sub: 'Manage college admission assistance' },
  'mentor-requests': { title: 'Guidance Requests', sub: 'Manage student-mentor interactions' },
  'careers': { title: 'Career Paths', sub: 'Hub for academic roadmaps' },
  'streams': { title: 'Streams After 10th', sub: 'HSC groups, vocational & polytechnic diploma courses' },
  'courses': { title: 'Course Management', sub: 'Academic & skill courses' },
  'exams': { title: 'Exam Management', sub: 'Entrance exams & important dates' },
  'graduate-exams': { title: 'Graduate Exams', sub: 'Graduate-level government recruitment examinations' },
  'colleges': { title: 'College Management', sub: 'College database' },
  'courses-colleges': { title: 'Courses & Colleges', sub: 'Select a stream to view its courses and colleges' },
  'scholarships': { title: 'School Scholarships', sub: 'School scholarship listings & deadlines' },
  'college-scholarships': { title: 'College Scholarship Management', sub: 'Higher Education Financial Schemes & AI Eligibility' },
  'cutoff': { title: 'Cutoff Management', sub: 'Year-wise cutoff data' },
  'notifications': { title: 'Notifications', sub: 'Send alerts to students' },
  'reports': { title: 'Reports & Analytics', sub: 'Data export & trends' },
  'mapping': { title: 'College-Course Mapping', sub: 'Connect courses to colleges' },
  'assessment': { title: 'Assessment Management', sub: 'Psychometric test questions' },
  'onboarding': { title: 'Onboarding Management', sub: 'Initial setup questions' },
  'recommendation-rules': { title: 'Recommendation Rules', sub: 'Assessment engine rules & guideline messages' },
  'settings': { title: 'Settings', sub: 'System configuration' },
  'higher-studies': { title: 'Higher Studies', sub: 'Postgraduate courses, diplomas & certificates' },
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const currentPath = location.pathname.replace('/admin/', '').replace('/admin', '')
  // Nested "courses-colleges/:stream[/:courseId]" pages keep the stream label
  // in the header subtitle so the breadcrumb context is clear.
  const nestedStream = currentPath.startsWith('courses-colleges/')
    ? currentPath.replace('courses-colleges/', '').split('/')[0]
    : null
  // Nested "graduate-exams/…" pages keep the graduate-exams module label.
  const nestedGrad = currentPath === 'graduate-exams' || currentPath.startsWith('graduate-exams/')
  const meta = nestedStream
    ? { title: PAGE_META['courses-colleges'].title, sub: `${streamLabel(nestedStream)} — courses, colleges & seats` }
    : nestedGrad
      ? PAGE_META['graduate-exams']
      : (PAGE_META[currentPath] || PAGE_META[''])

  const go = (path) => navigate(path ? `/admin/${path}` : '/admin')

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className={`${styles.layout} ${sidebarOpen ? '' : styles.collapsed}`}>

      {/* ── SIDEBAR ── */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <img src={uyarvuLogo} alt="Logo" className={styles.sidebarLogoImg} />
          {sidebarOpen && (
            <div className={styles.logoText}>
              <span className={styles.logoName}>UYARVU PAYANAM</span>
              <span className={styles.logoSub}>Admin Panel</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navLabel}>{sidebarOpen && 'MAIN MENU'}</div>
          {NAV.map(n => {
            const isActive = currentPath === n.path || (n.id === 'careers' && currentPath.includes('career-paths')) || (n.id === 'courses-colleges' && currentPath.startsWith('courses-colleges')) || (n.id === 'graduate-exams' && currentPath.startsWith('graduate-exams'))
            return (
              <button key={n.id}
                className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
                onClick={() => go(n.path)}
                title={!sidebarOpen ? n.label : ''}>
                <span className={styles.navIcon}>{n.icon}</span>
                {sidebarOpen && <span className={styles.navLabel2}>{n.label}</span>}
                {sidebarOpen && n.badge && <span className={styles.navBadge}>{n.badge}</span>}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className={styles.sidebarBottom}>
          {sidebarOpen && (
            <div className={styles.adminCard}>
              <div className={styles.adminAvatar}>SA</div>
              <div className={styles.adminInfo}>
                <span className={styles.adminName}>{admin?.name || 'Super Admin'}</span>
                <span className={styles.adminRole}>System Administrator</span>
              </div>
            </div>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            🚪 {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className={styles.main}>

        {/* Topbar */}
        <header className={styles.topbar}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(s => !s)}>
            ☰
          </button>
          <div>
            <h2 className={styles.topTitle}>{meta.title || 'Career Guidance'}</h2>
            <p className={styles.topSub}>UYARVU PAYANAM / {meta.sub || 'Level Management'}</p>
          </div>
          <div className={styles.topRight}>
            <button className={styles.topBtn} onClick={toggle}>
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
            <NotificationBell />
            <button className={styles.topBtnPrimary}>📤 Export</button>
          </div>
        </header>

        {/* Page content */}
        <main className={styles.content}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="college-students" element={<CollegeStudentsPage />} />
            <Route path="taxonomy" element={<AcademicTaxonomyManagementPage />} />
            <Route path="college-careers" element={<CollegeCareerCatalogManagementPage />} />
            <Route path="admission-help" element={<AdmissionHelpRequestsPage />} />
            <Route path="mentor-requests" element={<MentorRequestsPage />} />
            
            {/* Career Path Module */}
            <Route path="careers" element={<CareersPage />} />
            <Route path="streams" element={<StreamsPage />} />
            <Route path="career-paths/:level" element={<ClassDashboardPage />} />
            <Route path="career-paths/:level/new" element={<ClassFormPage />} />
            <Route path="career-paths/:level/edit/:id" element={<ClassFormPage />} />
            
            <Route path="career/:level" element={<CareerDetailsPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/edit/:id" element={<CourseDetailsEditPage />} />
            <Route path="exams" element={<ExamsPage />} />

            {/* Graduate Exams Module */}
            <Route path="graduate-exams" element={<GraduateExamsHome />} />
            <Route path="graduate-exams/state" element={<GraduateStatesPage />} />
            <Route path="graduate-exams/state/:state" element={<GraduateStatePage />} />
            <Route path="graduate-exams/central" element={<GraduateCentralPage />} />
            <Route path="graduate-exams/organization/:orgId" element={<GraduateOrgExamsPage />} />
            <Route path="graduate-exams/exam/new" element={<GraduateExamFormPage />} />
            <Route path="graduate-exams/exam/:id" element={<GraduateExamFormPage />} />
            <Route path="colleges" element={<CollegesPage />} />
            <Route path="courses-colleges" element={<StreamSelectorPage />} />
            <Route path="courses-colleges/:stream" element={<CoursesCollegesPage />} />
            <Route path="courses-colleges/:stream/:courseId" element={<CourseCollegesAdminPage />} />
            <Route path="scholarships" element={<ScholarshipsPage />} />
            <Route path="college-scholarships" element={<CollegeScholarshipsPage />} />
            <Route path="cutoff" element={<CutoffPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="mapping" element={<CollegeCourseMappingPage />} />
            <Route path="assessment" element={<AssessmentManagementPage />} />
            <Route path="onboarding" element={<OnboardingManagementPage />} />
            <Route path="recommendation-rules" element={<RecommendationRulesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="higher-studies" element={<HigherStudiesPage />} />
          </Routes>
        </main>

      </div>
    </div>
  )
}