import React from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { StudentAuthProvider, useStudentAuth } from './context/StudentAuthContext'
import StudentLayout from './layouts/StudentLayout'
import CollegeStudentLayout from './layouts/CollegeStudentLayout'
import GraduateLayout from './layouts/GraduateLayout'
import StudentProtectedRoute from './layouts/StudentProtectedRoute'
import MaintenanceGuard from './components/common/MaintenanceGuard'

// Public & Auth pages
import LandingPage from './pages/public/LandingPage'
import ExplorePage from './pages/public/ExplorePage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyOtpPage from './pages/auth/VerifyOtpPage'
import SignupOtpPage from './pages/auth/SignupOtpPage'

// School student pages
import DashboardPage from './pages/dashboard/DashboardPage'
import RecentActivityPage from './pages/dashboard/RecentActivityPage'
import CareersPage from './pages/careers/CareersPage'
import CareerClassPage from './pages/careers/CareerClassPage'
import CareerDetailPage from './pages/careers/CareerDetailPage'
import CollegesPage from './pages/colleges/CollegesPage'
import CoursesPage from './pages/courses/CoursesPage'
import CourseCategoryPage from './pages/courses/CourseCategoryPage'
import After10thCourses from './pages/courses/After10thCourses'
import After12thCourses from './pages/courses/After12thCourses'
import DiplomaCourses from './pages/courses/DiplomaCourses'
import NotificationsPage from './pages/notifications/NotificationsPage'
import ProfilePage from './pages/profile/ProfilePage'
import ScholarshipsPage from './pages/scholarships/ScholarshipsPage'
import ClassLevelPage from './pages/careers/ClassLevelPage'
import ContentDetailPage from './pages/careers/ContentDetailPage'
import CourseDetailPage from './pages/courses/CourseDetailPage'
import BookmarksPage from './pages/bookmarks/BookmarksPage'
import CollegeCourseExplorer from './pages/colleges/CollegeCourseExplorer'
import TneaCutoffPage from './pages/colleges/TneaCutoffPage'
import CollegeDetailPage from './pages/colleges/CollegeDetailPage'
import CollegeCategoryPage from './pages/colleges/CollegeCategoryPage'
import CollegesCategoryPage from './pages/colleges/CollegesCategoryPage'
import CourseCollegesPage from './pages/colleges/CourseCollegesPage'
import CollegeCoursesPage from './pages/colleges/CollegeCoursesPage'
import ScholarshipDetailPage from './pages/scholarships/ScholarshipDetailPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'
import CollegeOnboardingPage from './pages/onboarding/CollegeOnboardingPage'
import GraduateOnboardingPage from './pages/onboarding/GraduateOnboardingPage'
import GraduateInterestOnboardingPage from './pages/onboarding/GraduateInterestOnboardingPage'
import RecommendationResultPage from './pages/onboarding/RecommendationResultPage'
import Class5CommunicationPage from './pages/careers/Class5CommunicationPage'
import Class5PassportPage from './pages/careers/Class5PassportPage'
import PatternMasterPage from './pages/careers/PatternMasterPage'
import GovernmentCareerPage from './pages/careers/GovernmentCareerPage'
import CentralGovernmentPage from './pages/careers/CentralGovernmentPage'
import StateGovernmentPage from './pages/careers/StateGovernmentPage'
import TamilNaduCareerPage from './pages/careers/TamilNaduCareerPage'
import OrgExamsPage from './pages/careers/OrgExamsPage'
import GraduateExamDetailPage from './pages/careers/GraduateExamDetailPage'
import PrivateCareerPage from './pages/careers/PrivateCareerPage'

// Class 8 Maths Missions (gamified learning)
import MathsMissionsPage from './pages/class8/maths/MathsMissionsPage'
import MathsTopicPage from './pages/class8/maths/MathsTopicPage'
import MathsMissionPage from './pages/class8/maths/MathsMissionPage'

// Class 8 English Space Explorer (dark galaxy theme)
import EnglishMissionsPage from './pages/class8/english/EnglishMissionsPage'
import EnglishAreaPage from './pages/class8/english/EnglishAreaPage'
import EnglishTopicPage from './pages/class8/english/EnglishTopicPage'
import SkillsDashboardPage from './pages/class8/skills/SkillsDashboardPage'
import SkillCategoryPage from './pages/class8/skills/SkillCategoryPage'
import SkillGamePage from './pages/class8/skills/SkillGamePage'
import SkillDiagnosticPage from './pages/class8/skills/SkillDiagnosticPage'

// Class 5 career-discovery redesign (Uyarvu Payanam)
import Class5Dashboard from './pages/class5/Class5Dashboard'
import ScholarshipsSection from './pages/class5/ScholarshipsSection'
import SortingQuizPage from './pages/class5/SortingQuizPage'
import GameDetailPage from './pages/class5/GameDetailPage'
import AdhikaramPickerPage from './pages/class5/AdhikaramPickerPage'
import AdhikaramPage from './components/adhikaram/AdhikaramPage'
import MathWorldMap from './components/maths/MathWorldMap'
import TopicWorld from './components/maths/TopicWorld'
import DailyChallenge from './components/maths/DailyChallenge'
import RequireMathsLogin from './components/maths/RequireMathsLogin'
import WorldExplorer from './components/social/WorldExplorer'
import SocialWorld from './components/social/SocialWorld'
import SocialDaily from './components/social/SocialDaily'
import RequireSocialLogin from './components/social/RequireSocialLogin'
import ScienceAdventureWorld from './components/science/ScienceAdventureWorld'
import ScienceWorld from './components/science/ScienceWorld'
import ScienceDaily from './components/science/ScienceDaily'
import RequireScienceLogin from './components/science/RequireScienceLogin'

// English Adventure (Class 5)
import EnglishAdventure from './components/english/EnglishAdventure'
import StoryWriter from './components/english/StoryWriter'
import SpeakAndTell from './components/english/SpeakAndTell'
import EnglishBasics from './components/english/EnglishBasics'
import GrammarTopicWorld from './components/english/GrammarTopicWorld'
import WordExplorer from './components/english/WordExplorer'
import SentenceBuilder from './components/english/SentenceBuilder'
import ListenSpeak from './components/english/ListenSpeak'
import DailyEnglishChallenge from './components/english/DailyEnglishChallenge'
import MyEnglishProgress from './components/english/MyEnglishProgress'
import RequireEnglishLogin from './components/english/RequireEnglishLogin'

// College student pages
import CollegeDashboardPage from './pages/dashboard/CollegeDashboardPage'
import CollegeAdvisorDashboardPage from './pages/advisor/CollegeAdvisorDashboardPage'
import CollegeProfilePage from './pages/profile/CollegeProfilePage'
import StudyPlannerPage from './pages/academic/StudyPlannerPage'
import LearningRoadmapPage from './pages/academic/LearningRoadmapPage'
import PerformanceAnalyticsPage from './pages/academic/PerformanceAnalyticsPage'
import ProfileAwareAskAIChatbotPage from './pages/advisor/ProfileAwareAskAIChatbotPage'
import MyMemoriesPage from './pages/memories/MyMemoriesPage'
import SkillGapAnalysisPage from './pages/career/SkillGapAnalysisPage'
import CareerComparisonPage from './pages/career/CareerComparisonPage'
import ResumeBuilderPage from './pages/career/ResumeBuilderPage'
import AtsResumeCheckerPage from './pages/career/AtsResumeCheckerPage'
import TeammateMatchmakerPage from './pages/career/TeammateMatchmakerPage'
import InterviewPreparationPage from './pages/career/InterviewPreparationPage'
import NotesSummarizerPage from './pages/study-tools/NotesSummarizerPage'
import CollegeScholarshipsPage from './pages/scholarships/CollegeScholarshipsPage'
import PracticeQuestionsPage from './pages/study-tools/PracticeQuestionsPage'
import PeerMentorshipPage from './pages/community/PeerMentorshipPage'
import DoubtResolutionPage from './pages/community/DoubtResolutionPage'
import CollegeSettingsPage from './pages/settings/CollegeSettingsPage'
import IntelligentFocusPage from './pages/academic/IntelligentFocusPage'
import FocusAnalyticsPage from './pages/academic/FocusAnalyticsPage'
import PeerChatPage from './pages/community/PeerChatPage'
import MultiplayerQuizPage from './pages/community/MultiplayerQuizPage'

// ── Graduate portal pages (userType "graduate") ─────────────────────────────
import GraduateDashboardPage from './pages/graduate/GraduateDashboardPage'
import GraduateProfilePage from './pages/graduate/GraduateProfilePage'
import GraduateAIAdvisorPage from './pages/graduate/GraduateAIAdvisorPage'
import GraduateCareersPage from './pages/graduate/GraduateCareersPage'
import GraduateSkillGapPage from './pages/graduate/GraduateSkillGapPage'
import GraduateExamsPage from './pages/graduate/GraduateExamsPage'
import GraduateHigherStudiesPage from './pages/graduate/GraduateHigherStudiesPage'
import HigherStudiesExplorePage from './pages/graduate/HigherStudiesExplorePage'
import HigherStudiesDetailPage from './pages/graduate/HigherStudiesDetailPage'
import GraduateOpportunitiesPage from './pages/graduate/GraduateOpportunitiesPage'
import GraduateOpportunityDetailPage from './pages/graduate/GraduateOpportunityDetailPage'
import GraduateApplicationsPage from './pages/graduate/GraduateApplicationsPage'
import GraduatePeerMentorPage from './pages/graduate/GraduatePeerMentorPage'
import GraduatePeerChatPage from './pages/graduate/GraduatePeerChatPage'
import GraduateRoadmapPage from './pages/graduate/GraduateRoadmapPage'
import GraduateTopicDetailPage from './pages/graduate/GraduateTopicDetailPage'
import GraduatePlacementPage from './pages/graduate/GraduatePlacementPage'
import GraduateInterviewPage from './pages/graduate/GraduateInterviewPage'
import GraduateResumePage from './pages/graduate/GraduateResumePage'
import GraduateResumeBuilderPage from './pages/graduate/GraduateResumeBuilderPage'
import GraduateAtsCheckerPage from './pages/graduate/GraduateAtsCheckerPage'
import GraduateSavedPage from './pages/graduate/GraduateSavedPage'
import GraduateNotificationsPage from './pages/graduate/GraduateNotificationsPage'

import './student.css'

// A smart dashboard redirector that decides which layout to send the student to
function CollegeDashboardRedirector() {
  const { student } = useStudentAuth()
  const isCollege = student?.userType === 'college_student'
    const isGraduate = student?.userType === 'graduate'

  if (isCollege) {
    return <Navigate to="/college/dashboard" replace />
  }
  if (isGraduate) {
    return <Navigate to="/student/graduate/dashboard" replace />
  }
  // Fallback: render the school dashboard
  return <DashboardPage />
}

// Aliased routes redirect (<Navigate replace>) to a canonical URL
function PreserveParamRedirect({ to }) {
  const params = useParams()
  const rendered = to.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, (m) => params[m.slice(1)] ?? m)
  return <Navigate to={rendered} replace />
}

export default function StudentRoutes() {
  return (
    <StudentAuthProvider>
      <MaintenanceGuard>
        <Routes>

          {/* ════════════════════════════════════════════════════════
              SCHOOL / PUBLIC ROUTES  (StudentLayout — top navbar)
              ════════════════════════════════════════════════════════ */}
          <Route element={<StudentLayout />}>
            <Route index element={<LandingPage />} />

            {/* Landing */}
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="student/home" element={<Navigate to="/" replace />} />

            {/* Explore */}
            <Route path="explore" element={<ExplorePage />} />
            <Route path="student/explore" element={<Navigate to="/explore" replace />} />

            {/* Auth */}
            <Route path="student/signin" element={<LoginPage />} />
            <Route path="signin" element={<Navigate to="/student/signin" replace />} />
            <Route path="login" element={<Navigate to="/student/signin" replace />} />
            <Route path="student/login" element={<Navigate to="/student/signin" replace />} />
            <Route path="student/signup" element={<SignupPage />} />
            <Route path="signup" element={<Navigate to="/student/signup" replace />} />
            <Route path="student/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="forgot-password" element={<Navigate to="/student/forgot-password" replace />} />
            <Route path="student/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="reset-password/:token" element={<PreserveParamRedirect to="/student/reset-password/:token" />} />
            <Route path="student/verify-otp" element={<VerifyOtpPage />} />
            <Route path="verify-otp" element={<Navigate to="/student/verify-otp" replace />} />
            <Route path="student/signup/verify" element={<SignupOtpPage />} />
            <Route path="signup/verify" element={<Navigate to="/student/signup/verify" replace />} />

            {/* Onboarding */}
            <Route path="student/onboarding" element={<StudentProtectedRoute><OnboardingPage /></StudentProtectedRoute>} />
            <Route path="onboarding" element={<Navigate to="/student/onboarding" replace />} />
            <Route path="student/onboarding/college" element={<StudentProtectedRoute><CollegeOnboardingPage /></StudentProtectedRoute>} />
            <Route path="onboarding/college" element={<Navigate to="/student/onboarding/college" replace />} />
            <Route path="student/onboarding/graduate" element={<StudentProtectedRoute><GraduateInterestOnboardingPage /></StudentProtectedRoute>} />
            <Route path="student/onboarding/graduate/detailed" element={<StudentProtectedRoute><GraduateOnboardingPage /></StudentProtectedRoute>} />
            <Route path="onboarding/graduate" element={<Navigate to="/student/onboarding/graduate" replace />} />
            <Route path="student/onboarding/result" element={<StudentProtectedRoute><RecommendationResultPage /></StudentProtectedRoute>} />
            <Route path="onboarding/result" element={<Navigate to="/student/onboarding/result" replace />} />

            {/* School class routes */}
            <Route path="student/class5" element={<Class5Dashboard />}>
              <Route index element={<Navigate to="adhikaram" replace />} />
              <Route path="scholarships" element={<ScholarshipsSection />} />
              <Route path="adhikaram" element={<AdhikaramPickerPage />} />
              <Route path="adhikaram/:id" element={<AdhikaramPage />} />
              <Route path="maths" element={<MathWorldMap />} />
              <Route path="maths/daily" element={<RequireMathsLogin><DailyChallenge /></RequireMathsLogin>} />
              <Route path="maths/:topic" element={<RequireMathsLogin><TopicWorld /></RequireMathsLogin>} />
              <Route path="social" element={<WorldExplorer />} />
              <Route path="social/daily" element={<RequireSocialLogin><SocialDaily /></RequireSocialLogin>} />
              <Route path="social/:world" element={<RequireSocialLogin><SocialWorld /></RequireSocialLogin>} />
              <Route path="science" element={<ScienceAdventureWorld />} />
              <Route path="science/daily" element={<RequireScienceLogin><ScienceDaily /></RequireScienceLogin>} />
              <Route path="science/:world" element={<RequireScienceLogin><ScienceWorld /></RequireScienceLogin>} />
              <Route path="english" element={<EnglishAdventure />} />
              <Route path="english/writing" element={<RequireEnglishLogin><StoryWriter /></RequireEnglishLogin>} />
              <Route path="english/speaking" element={<RequireEnglishLogin><SpeakAndTell /></RequireEnglishLogin>} />
              <Route path="english/basics" element={<EnglishBasics />} />
              <Route path="english/basics/:topicId" element={<RequireEnglishLogin><GrammarTopicWorld /></RequireEnglishLogin>} />
              <Route path="english/vocabulary" element={<RequireEnglishLogin><WordExplorer /></RequireEnglishLogin>} />
              <Route path="english/sentence-builder" element={<RequireEnglishLogin><SentenceBuilder /></RequireEnglishLogin>} />
              <Route path="english/listen-speak" element={<RequireEnglishLogin><ListenSpeak /></RequireEnglishLogin>} />
              <Route path="english/daily-challenge" element={<RequireEnglishLogin><DailyEnglishChallenge /></RequireEnglishLogin>} />
              <Route path="english/progress" element={<RequireEnglishLogin><MyEnglishProgress /></RequireEnglishLogin>} />
              <Route path="quiz" element={<SortingQuizPage />} />
              <Route path="games/:key" element={<GameDetailPage />} />
            </Route>
            <Route path="class5" element={<Navigate to="/student/class5" replace />} />
            <Route path="student/class5/content/:slug" element={<ContentDetailPage />} />
            <Route path="class5/content/:slug" element={<PreserveParamRedirect to="/student/class5/content/:slug" />} />
            <Route path="student/class5/skills/communicationskills" element={<StudentProtectedRoute><Class5CommunicationPage /></StudentProtectedRoute>} />
            <Route path="class5/skills/communicationskills" element={<Navigate to="/student/class5/skills/communicationskills" replace />} />
            <Route path="student/class5/skills/communicationskills/passport/:studentId" element={<StudentProtectedRoute><Class5PassportPage /></StudentProtectedRoute>} />
            <Route path="class5/skills/communicationskills/passport/:studentId" element={<PreserveParamRedirect to="/student/class5/skills/communicationskills/passport/:studentId" />} />
            <Route path="student/class5/games/pattern-master" element={<StudentProtectedRoute><PatternMasterPage /></StudentProtectedRoute>} />
            <Route path="class5/games/pattern-master" element={<Navigate to="/student/class5/games/pattern-master" replace />} />
            <Route path="student/class8" element={<ClassLevelPage level="8" />} />
            <Route path="class8" element={<Navigate to="/student/class8" replace />} />
            <Route path="student/class8/content/:slug" element={<ContentDetailPage />} />
            <Route path="class8/content/:slug" element={<PreserveParamRedirect to="/student/class8/content/:slug" />} />
            <Route path="student/class8/maths" element={<StudentProtectedRoute><MathsMissionsPage /></StudentProtectedRoute>} />
            <Route path="class8/maths" element={<Navigate to="/student/class8/maths" replace />} />
            <Route path="student/class8/maths/topic/:topicId" element={<StudentProtectedRoute><MathsTopicPage /></StudentProtectedRoute>} />
            <Route path="class8/maths/topic/:topicId" element={<PreserveParamRedirect to="/student/class8/maths/topic/:topicId" />} />
            <Route path="student/class8/maths/topic/:topicId/mission/:missionId" element={<StudentProtectedRoute><MathsMissionPage /></StudentProtectedRoute>} />
            <Route path="class8/maths/topic/:topicId/mission/:missionId" element={<PreserveParamRedirect to="/student/class8/maths/topic/:topicId/mission/:missionId" />} />
            <Route path="student/class8/english" element={<StudentProtectedRoute><EnglishMissionsPage /></StudentProtectedRoute>} />
            <Route path="class8/english" element={<Navigate to="/student/class8/english" replace />} />
            <Route path="student/class8/english/area/:areaId" element={<StudentProtectedRoute><EnglishAreaPage /></StudentProtectedRoute>} />
            <Route path="class8/english/area/:areaId" element={<PreserveParamRedirect to="/student/class8/english/area/:areaId" />} />
            <Route path="student/class8/english/topic/:topicId" element={<StudentProtectedRoute><EnglishTopicPage /></StudentProtectedRoute>} />
            <Route path="class8/english/topic/:topicId" element={<PreserveParamRedirect to="/student/class8/english/topic/:topicId" />} />
            <Route path="student/class8/skills" element={<StudentProtectedRoute><SkillsDashboardPage /></StudentProtectedRoute>} />
            <Route path="class8/skills" element={<Navigate to="/student/class8/skills" replace />} />
            <Route path="student/class8/skills/diagnostic" element={<StudentProtectedRoute><SkillDiagnosticPage /></StudentProtectedRoute>} />
            <Route path="class8/skills/diagnostic" element={<Navigate to="/student/class8/skills/diagnostic" replace />} />
            <Route path="student/class8/skills/:skillId" element={<StudentProtectedRoute><SkillCategoryPage /></StudentProtectedRoute>} />
            <Route path="class8/skills/:skillId" element={<PreserveParamRedirect to="/student/class8/skills/:skillId" />} />
            <Route path="student/class8/skills/:skillId/game/:activityId" element={<StudentProtectedRoute><SkillGamePage /></StudentProtectedRoute>} />
            <Route path="class8/skills/:skillId/game/:activityId" element={<PreserveParamRedirect to="/student/class8/skills/:skillId/game/:activityId" />} />
            <Route path="student/class10" element={<ClassLevelPage level="10" />} />
            <Route path="class10" element={<Navigate to="/student/class10" replace />} />
            <Route path="student/class10/content/:slug" element={<ContentDetailPage />} />
            <Route path="class10/content/:slug" element={<PreserveParamRedirect to="/student/class10/content/:slug" />} />
            <Route path="student/class12" element={<ClassLevelPage level="12" />} />
            <Route path="class12" element={<Navigate to="/student/class12" replace />} />
            <Route path="student/class12/colleges/:category" element={<CollegesCategoryPage />} />
            <Route path="class12/colleges/:category" element={<PreserveParamRedirect to="/student/class12/colleges/:category" />} />
            <Route path="student/class12/colleges/:category/course/:courseId" element={<CourseCollegesPage />} />
            <Route path="class12/colleges/:category/course/:courseId" element={<PreserveParamRedirect to="/student/class12/colleges/:category/course/:courseId" />} />
            <Route path="student/class12/colleges/:category/college/:collegeId" element={<CollegeCoursesPage />} />
            <Route path="class12/colleges/:category/college/:collegeId" element={<PreserveParamRedirect to="/student/class12/colleges/:category/college/:collegeId" />} />
            <Route path="student/class12/content/:slug" element={<ContentDetailPage />} />
            <Route path="class12/content/:slug" element={<PreserveParamRedirect to="/student/class12/content/:slug" />} />
            <Route path="student/career-path/class-5/:slug" element={<ContentDetailPage />} />
            <Route path="career-path/class-5/:slug" element={<PreserveParamRedirect to="/student/career-path/class-5/:slug" />} />
            <Route path="student/career-path/class-8/:slug" element={<ContentDetailPage />} />
            <Route path="career-path/class-8/:slug" element={<PreserveParamRedirect to="/student/career-path/class-8/:slug" />} />
            <Route path="student/career-path/class-10/:slug" element={<ContentDetailPage />} />
            <Route path="career-path/class-10/:slug" element={<PreserveParamRedirect to="/student/career-path/class-10/:slug" />} />
            <Route path="student/career-path/class-12/:slug" element={<ContentDetailPage />} />
            <Route path="career-path/class-12/:slug" element={<PreserveParamRedirect to="/student/career-path/class-12/:slug" />} />

            {/* Shared public exploration routes */}
            <Route path="student/careers" element={<CareersPage />} />
            <Route path="careers" element={<Navigate to="/student/careers" replace />} />
            <Route path="student/careers/class/:classKey" element={<CareerClassPage />} />
            <Route path="careers/class/:classKey" element={<PreserveParamRedirect to="/student/careers/class/:classKey" />} />
            <Route path="student/careers/path/:id" element={<CareerDetailPage />} />
            <Route path="careers/path/:id" element={<PreserveParamRedirect to="/student/careers/path/:id" />} />
            <Route path="student/careers/government" element={<GovernmentCareerPage />} />
            <Route path="careers/government" element={<Navigate to="/student/careers/government" replace />} />
            <Route path="student/careers/government/central" element={<CentralGovernmentPage />} />
            <Route path="careers/government/central" element={<Navigate to="/student/careers/government/central" replace />} />
            <Route path="student/careers/government/central/organization/:orgId" element={<OrgExamsPage />} />
            <Route path="careers/government/central/organization/:orgId" element={<PreserveParamRedirect to="/student/careers/government/central/organization/:orgId" />} />
            <Route path="student/careers/government/central/organization/:orgId/exam/:slug" element={<GraduateExamDetailPage />} />
            <Route path="careers/government/central/organization/:orgId/exam/:slug" element={<PreserveParamRedirect to="/student/careers/government/central/organization/:orgId/exam/:slug" />} />
            <Route path="student/careers/government/state" element={<StateGovernmentPage />} />
            <Route path="careers/government/state" element={<Navigate to="/student/careers/government/state" replace />} />
            <Route path="student/careers/government/state/tamil-nadu" element={<TamilNaduCareerPage />} />
            <Route path="careers/government/state/tamil-nadu" element={<Navigate to="/student/careers/government/state/tamil-nadu" replace />} />
            <Route path="student/careers/government/state/:stateSlug" element={<TamilNaduCareerPage />} />
            <Route path="careers/government/state/:stateSlug" element={<PreserveParamRedirect to="/student/careers/government/state/:stateSlug" />} />
            <Route path="student/careers/government/state/tamil-nadu/tnpsc" element={<OrgExamsPage orgSlug="tnpsc" />} />
            <Route path="careers/government/state/tamil-nadu/tnpsc" element={<Navigate to="/student/careers/government/state/tamil-nadu/tnpsc" replace />} />
            <Route path="student/careers/government/state/tamil-nadu/tnpsc/:examId" element={<GraduateExamDetailPage />} />
            <Route path="careers/government/state/tamil-nadu/tnpsc/:examId" element={<PreserveParamRedirect to="/student/careers/government/state/tamil-nadu/tnpsc/:examId" />} />
            <Route path="student/careers/government/tamil-nadu" element={<Navigate to="/student/careers/government/state/tamil-nadu" replace />} />
            <Route path="careers/government/tamil-nadu" element={<Navigate to="/student/careers/government/state/tamil-nadu" replace />} />
            <Route path="student/careers/government/tamil-nadu/tnpsc" element={<OrgExamsPage orgSlug="tnpsc" />} />
            <Route path="careers/government/tamil-nadu/tnpsc" element={<Navigate to="/student/careers/government/state/tamil-nadu/tnpsc" replace />} />
            <Route path="student/careers/government/tamil-nadu/tnpsc/:examId" element={<GraduateExamDetailPage />} />
            <Route path="careers/government/tamil-nadu/tnpsc/:examId" element={<PreserveParamRedirect to="/student/careers/government/tamil-nadu/tnpsc/:examId" />} />
            <Route path="student/careers/government/state/:stateSlug/organization/:orgId" element={<OrgExamsPage />} />
            <Route path="careers/government/state/:stateSlug/organization/:orgId" element={<PreserveParamRedirect to="/student/careers/government/state/:stateSlug/organization/:orgId" />} />
            <Route path="student/careers/government/state/:stateSlug/organization/:orgId/exam/:slug" element={<GraduateExamDetailPage />} />
            <Route path="careers/government/state/:stateSlug/organization/:orgId/exam/:slug" element={<PreserveParamRedirect to="/student/careers/government/state/:stateSlug/organization/:orgId/exam/:slug" />} />
            <Route path="student/careers/private" element={<PrivateCareerPage />} />
            <Route path="careers/private" element={<Navigate to="/student/careers/private" replace />} />
            <Route path="student/colleges" element={<CollegesPage />} />
            <Route path="colleges" element={<Navigate to="/student/colleges" replace />} />
            <Route path="student/colleges/explorer" element={<CollegeCourseExplorer />} />
            <Route path="colleges/explorer" element={<Navigate to="/student/colleges/explorer" replace />} />
            <Route path="student/colleges/cutoff" element={<TneaCutoffPage />} />
            <Route path="colleges/cutoff" element={<Navigate to="/student/colleges/cutoff" replace />} />
            <Route path="student/colleges/category/:categoryName" element={<CollegeCategoryPage />} />
            <Route path="colleges/category/:categoryName" element={<PreserveParamRedirect to="/student/colleges/category/:categoryName" />} />
            <Route path="student/colleges/:id" element={<CollegeDetailPage />} />
            <Route path="colleges/:id" element={<PreserveParamRedirect to="/student/colleges/:id" />} />
            <Route path="student/scholarships" element={<ScholarshipsPage />} />
            <Route path="scholarships" element={<Navigate to="/student/scholarships" replace />} />
            <Route path="student/scholarships/:id" element={<ScholarshipDetailPage />} />
            <Route path="scholarships/:id" element={<PreserveParamRedirect to="/student/scholarships/:id" />} />
            <Route path="student/courses" element={<CoursesPage />} />
            <Route path="courses" element={<Navigate to="/student/courses" replace />} />
            <Route path="student/courses/:categoryKey" element={<CourseCategoryPage />} />
            <Route path="courses/:categoryKey" element={<PreserveParamRedirect to="/student/courses/:categoryKey" />} />
            <Route path="student/course/:slug" element={<CourseDetailPage />} />
            <Route path="course/:slug" element={<PreserveParamRedirect to="/student/course/:slug" />} />
            <Route path="student/courses/after-10th" element={<After10thCourses />} />
            <Route path="courses/after-10th" element={<Navigate to="/student/courses/after-10th" replace />} />
            <Route path="student/courses/after-12th" element={<After12thCourses />} />
            <Route path="courses/after-12th" element={<Navigate to="/student/courses/after-12th" replace />} />
            <Route path="student/courses/diploma" element={<DiplomaCourses />} />
            <Route path="courses/diploma" element={<Navigate to="/student/courses/diploma" replace />} />

            {/* Higher Studies — public, no login required */}
            <Route path="higher-studies" element={<HigherStudiesExplorePage />} />
            <Route path="higher-studies/:id" element={<HigherStudiesDetailPage />} />

            {/* School Dashboard */}
            <Route path="student/dashboard" element={<StudentProtectedRoute><CollegeDashboardRedirector /></StudentProtectedRoute>} />
            <Route path="dashboard" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="student/bookmarks" element={<StudentProtectedRoute><BookmarksPage /></StudentProtectedRoute>} />
            <Route path="bookmarks" element={<Navigate to="/student/bookmarks" replace />} />
            <Route path="student/recent-activity" element={<StudentProtectedRoute><RecentActivityPage /></StudentProtectedRoute>} />
            <Route path="recent-activity" element={<Navigate to="/student/recent-activity" replace />} />
            <Route path="student/notifications" element={<StudentProtectedRoute><NotificationsPage /></StudentProtectedRoute>} />
            <Route path="notifications" element={<Navigate to="/student/notifications" replace />} />
            <Route path="student/profile" element={<StudentProtectedRoute><ProfilePage /></StudentProtectedRoute>} />
            <Route path="profile" element={<Navigate to="/student/profile" replace />} />

            {/* Graduate portal — done via the /student/graduate/* canonical paths
                (rendered inside the shared student layout). userType "graduate"
                accounts land here after completing graduate onboarding. */}
            <Route path="student/graduate" element={<Navigate to="/student/graduate/dashboard" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* GRADUATE PORTAL (GraduateLayout - dark sidebar) */}
          <Route element={<StudentProtectedRoute><GraduateLayout /></StudentProtectedRoute>}>
            <Route path="student/graduate/dashboard" element={<GraduateDashboardPage />} />
            <Route path="student/graduate/profile" element={<GraduateProfilePage />} />
            <Route path="student/graduate/advisor" element={<GraduateAIAdvisorPage />} />
            <Route path="student/graduate/careers" element={<GraduateCareersPage />} />
            <Route path="student/graduate/skill-gap" element={<GraduateSkillGapPage />} />
            <Route path="student/graduate/exams" element={<GraduateExamsPage />} />
            <Route path="student/graduate/higher-studies" element={<HigherStudiesExplorePage />} />
            <Route path="student/graduate/higher-studies/:id" element={<HigherStudiesDetailPage />} />
            <Route path="student/graduate/roadmap" element={<GraduateRoadmapPage />} />
            <Route path="student/graduate/placement" element={<GraduatePlacementPage />} />
            <Route path="student/graduate/interview" element={<GraduateInterviewPage />} />
            <Route path="student/graduate/resume" element={<GraduateResumePage />} />
            <Route path="student/graduate/saved" element={<GraduateSavedPage />} />
            <Route path="student/graduate/applications" element={<GraduateApplicationsPage />} />
            <Route path="student/graduate/notifications" element={<GraduateNotificationsPage />} />
          </Route>

          {/* Legacy graduate paths (redirects) */}
          <Route path="graduate/dashboard" element={<Navigate to="/student/graduate/dashboard" replace />} />
          <Route path="graduate/profile" element={<Navigate to="/student/graduate/profile" replace />} />
          <Route path="graduate/advisor" element={<Navigate to="/student/graduate/advisor" replace />} />
          <Route path="graduate/careers" element={<Navigate to="/student/graduate/careers" replace />} />
          <Route path="graduate/skill-gap" element={<Navigate to="/student/graduate/skill-gap" replace />} />
          <Route path="graduate/exams" element={<Navigate to="/student/graduate/exams" replace />} />
          <Route path="graduate/higher-studies" element={<Navigate to="/student/graduate/higher-studies" replace />} />
          <Route path="graduate/roadmap" element={<Navigate to="/student/graduate/roadmap" replace />} />
          <Route path="graduate/placement" element={<Navigate to="/student/graduate/placement" replace />} />
          <Route path="graduate/interview" element={<Navigate to="/student/graduate/interview" replace />} />
          <Route path="graduate/resume" element={<Navigate to="/student/graduate/resume" replace />} />


          {/* ════════════════════════════════════════════════════════
              COLLEGE STUDENT ROUTES (CollegeStudentLayout — dark sidebar)
              ════════════════════════════════════════════════════════ */}
          <Route
            path="/college"
            element={<StudentProtectedRoute><CollegeStudentLayout /></StudentProtectedRoute>}
          >
            <Route path="dashboard" element={<CollegeDashboardPage />} />
            <Route path="profile" element={<CollegeProfilePage />} />
            <Route path="advisor" element={<CollegeAdvisorDashboardPage />} />
            <Route path="advisor/chat" element={<ProfileAwareAskAIChatbotPage />} />
            <Route path="memories" element={<MyMemoriesPage />} />
            <Route path="academic/planner" element={<StudyPlannerPage />} />
            <Route path="academic/roadmap" element={<LearningRoadmapPage />} />
            <Route path="academic/performance" element={<PerformanceAnalyticsPage />} />
            <Route path="career/skill-gap" element={<SkillGapAnalysisPage />} />
            <Route path="career/compare" element={<CareerComparisonPage />} />
            <Route path="career/resume" element={<ResumeBuilderPage />} />
            <Route path="career/ats-checker" element={<AtsResumeCheckerPage />} />
            <Route path="career/interview-prep" element={<InterviewPreparationPage />} />
            <Route path="study-tools/notes-summarizer" element={<NotesSummarizerPage />} />
            <Route path="study-tools/practice" element={<PracticeQuestionsPage />} />
            <Route path="teammate-matchmaker" element={<TeammateMatchmakerPage />} />
            <Route path="community/mentors" element={<PeerMentorshipPage />} />
            <Route path="community/doubts" element={<DoubtResolutionPage />} />
            <Route path="peer-chat" element={<PeerChatPage />} />
            <Route path="multiplayer-quiz/:sessionId" element={<MultiplayerQuizPage />} />
            <Route path="academic/focus" element={<IntelligentFocusPage />} />
            <Route path="academic/focus-analytics" element={<FocusAnalyticsPage />} />
            <Route path="focus/analytics" element={<FocusAnalyticsPage />} />
            <Route path="scholarships" element={<CollegeScholarshipsPage />} />
            <Route path="bookmarks" element={<BookmarksPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<CollegeSettingsPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ════════════════════════════════════════════════════════
              GRADUATE ECOSYSTEM ROUTES (GraduateLayout — dark sidebar)
              ════════════════════════════════════════════════════════ */}
          <Route
            path="/graduate"
            element={<StudentProtectedRoute><GraduateLayout /></StudentProtectedRoute>}
          >
            <Route path="dashboard" element={<GraduateDashboardPage />} />
            <Route path="onboarding" element={<GraduateOnboardingPage />} />
            <Route path="profile" element={<GraduateProfilePage />} />
            <Route path="opportunities" element={<GraduateOpportunitiesPage />} />
            <Route path="opportunities/:id" element={<GraduateOpportunityDetailPage />} />
            <Route path="government-exams" element={<GraduateExamsPage />} />
            <Route path="exams" element={<Navigate to="../government-exams" replace />} />
            <Route path="higher-studies" element={<GraduateHigherStudiesPage />} />
            <Route path="upcoming-exams" element={<GraduateExamsPage />} />
            <Route path="applications" element={<GraduateApplicationsPage />} />
            <Route path="peer-mentor" element={<GraduatePeerMentorPage />} />
            <Route path="peer-mentor/:relationshipId/chat" element={<GraduatePeerChatPage />} />
            <Route path="messages" element={<GraduatePeerMentorPage />} />
            <Route path="advisor" element={<GraduateAIAdvisorPage />} />
            <Route path="ai-advisor" element={<Navigate to="../advisor" replace />} />
            <Route path="careers" element={<GraduateCareersPage />} />
            <Route path="skill-gap" element={<GraduateSkillGapPage />} />
            <Route path="roadmap" element={<GraduateRoadmapPage />} />
            <Route path="roadmap/:examId" element={<GraduateRoadmapPage />} />
            <Route path="roadmap/:examId/topic/:topicId" element={<GraduateTopicDetailPage />} />
            <Route path="exams/:examId" element={<GraduateRoadmapPage />} />
            <Route path="placement" element={<GraduatePlacementPage />} />
            <Route path="interview" element={<GraduateInterviewPage />} />
            <Route path="resume-builder" element={<GraduateResumeBuilderPage />} />
            <Route path="ats-checker" element={<GraduateAtsCheckerPage />} />
            <Route path="resume" element={<GraduateResumeBuilderPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

        </Routes>
      </MaintenanceGuard>
    </StudentAuthProvider>
  )
}