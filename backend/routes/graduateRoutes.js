const express = require("express");
const router = express.Router();
const {
  getMyProfile,
  completeGraduateOnboarding,
  saveOnboardingStep,
  getDashboardSummary,
  getOpportunities,
  getOpportunityById,
  getGovernmentExams,
  getHigherStudiesGuide,
  getUserApplications,
  createOrUpdateApplication,
  setOpportunityReminder,
  refreshOpportunityResearch,
  getRecommendations,
  getNotifications,
  getCareerRecommendations,
  getSkillGapAnalysis,
  getExamsGuide,
  getUpskillingRoadmap,
} = require("../controllers/graduateController");

const {
  getIncomingMentorRequests,
  acceptMentorRequest,
  rejectMentorRequest,
  getActiveMentees,
  getRelationshipMessages,
  sendRelationshipMessage,
  getMentorProfile,
  updateMentorProfile
} = require("../controllers/graduateMentorController");

const {
  askAdvisorChat,
  generateResumeSuggestions,
  saveResumeVersion,
  getResumeVersions,
  deleteResumeVersion,
  generateAiSummary,
  analyzeResumeJd,
  getAtsPresets,
  checkResumeAtsScore,
  getAtsHistory
} = require("../controllers/collegeStudyToolsController");

const {
  getExams,
  getExamById,
  getExamPattern,
  getExamSyllabus,
  getExamPapers,
  researchExam,
  getStudyPlan,
  createOrUpdateStudyPlan,
  getExamProgress,
  recordTopicProgress,
  submitMockTest
} = require("../controllers/examPreparationController");
const verifyStudent = require("../middleware/verifyStudent");
const verifyAdmin = require("../middleware/verifyAdmin");
const { rateLimit } = require("../middleware/rateLimit");

const multer = require("multer");
const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ── Graduate portal boundary ────────────────────────────────────────────
// The frontend hides these routes, but the backend is the real security
// boundary: a non-graduate account must not read or write graduate data
// just by changing the URL. The /exams/* routes are public exam-content
// APIs (optionalStudent) and are intentionally excluded.
// NOTE: verifyStudent must run before the type check — req.student is only
// populated after authentication.
router.use(/^\/(?!exams(?:\/|$)).*/, (req, res, next) => {
  verifyStudent(req, res, () => {
    if (req.student?.userType !== 'graduate') {
      return res.status(403).json({ success: false, message: 'Graduate accounts only' });
    }
    next();
  });
});

// ── Profile & Onboarding ────────────────────────────────────
router.get("/profile", verifyStudent, getMyProfile);
router.post(
  "/profile/step",
  verifyStudent,
  rateLimit({ keyFn: (req) => `grad-step:${req.student._id}`, max: 40, windowMs: 60000 }),
  saveOnboardingStep
);
router.put("/profile", verifyStudent, completeGraduateOnboarding);
router.post("/onboarding", verifyStudent, completeGraduateOnboarding);
router.post(
  "/onboarding/complete",
  verifyStudent,
  rateLimit({ keyFn: (req) => `grad-onb:${req.student._id}`, max: 10, windowMs: 60000 }),
  completeGraduateOnboarding
);

// ── Dashboard & Opportunities ───────────────────────────────
router.get("/dashboard", verifyStudent, getDashboardSummary);
router.get("/opportunities", verifyStudent, getOpportunities);
router.get("/opportunities/:id", verifyStudent, getOpportunityById);
router.post("/opportunities/:id/reminder", verifyStudent, setOpportunityReminder);

// ── Career guidance (resume-safe, merged recommendations) ───
router.get("/careers", verifyStudent, getCareerRecommendations);
router.get("/skill-gap", verifyStudent, getSkillGapAnalysis);
router.get("/roadmap", verifyStudent, getUpskillingRoadmap);
router.get("/recommendations", verifyStudent, getRecommendations);
router.get("/notifications", verifyStudent, getNotifications);

// ── Categorized Guides & Exams ──────────────────────────────
router.get("/government-exams", verifyStudent, getGovernmentExams);
router.get("/higher-studies", verifyStudent, getHigherStudiesGuide);
router.get("/entrance-exams", verifyStudent, getHigherStudiesGuide);
router.get("/upcoming-exams", verifyStudent, getGovernmentExams);

// ── Application Tracker ─────────────────────────────────────
router.get("/applications", verifyStudent, getUserApplications);
router.post("/applications", verifyStudent, createOrUpdateApplication);
router.put("/applications/:id", verifyStudent, createOrUpdateApplication);

// ── Web Research & Refresh ──────────────────────────────────
router.post("/research/refresh", verifyStudent, refreshOpportunityResearch);

// ── AI Advisor Chat ─────────────────────────────────────────
router.post(
  "/advisor/chat",
  verifyStudent,
  rateLimit({ keyFn: (req) => `grad-chat:${req.student._id || req.student?.id}`, max: 30, windowMs: 60000 }),
  askAdvisorChat
);

// ── Peer Mentorship (Graduate-side) ─────────────────────────
router.get("/mentor/requests", verifyStudent, getIncomingMentorRequests);
router.post("/mentor/requests/:id/accept", verifyStudent, acceptMentorRequest);
router.post("/mentor/requests/:id/reject", verifyStudent, rejectMentorRequest);
router.get("/mentor/mentees", verifyStudent, getActiveMentees);
router.get("/mentor/relationships/:id/messages", verifyStudent, getRelationshipMessages);
router.post("/mentor/relationships/:id/messages", verifyStudent, sendRelationshipMessage);
router.get("/mentor/profile", verifyStudent, getMentorProfile);
router.put("/mentor/profile", verifyStudent, updateMentorProfile);

// ── Resume Builder & ATS Score Checker (Graduate Portal) ────
router.get("/resume", verifyStudent, generateResumeSuggestions);
router.get("/resume/versions", verifyStudent, getResumeVersions);
router.post("/resume/save", verifyStudent, saveResumeVersion);
router.delete("/resume/:id", verifyStudent, deleteResumeVersion);
router.post("/resume/generate-summary", verifyStudent, generateAiSummary);
router.post("/resume/analyze", verifyStudent, analyzeResumeJd);

router.get("/ats-presets", verifyStudent, getAtsPresets);
router.post("/ats-checker", verifyStudent, uploadResume.single("resumeFile"), checkResumeAtsScore);
router.get("/ats-history", verifyStudent, getAtsHistory);

const optionalStudent = require("../middleware/optionalStudent");

// ── Exam Intelligence & Exam-Specific Study Roadmap ─────────
router.get("/exams", optionalStudent, getExams);
router.get("/exams/:examId", optionalStudent, getExamById);
router.get("/exams/:examId/pattern", optionalStudent, getExamPattern);
router.get("/exams/:examId/syllabus", optionalStudent, getExamSyllabus);
router.get("/exams/:examId/papers", optionalStudent, getExamPapers);
router.post("/exams/:examId/research", optionalStudent, researchExam);
router.get("/exams/:examId/study-plan", optionalStudent, getStudyPlan);
router.post("/exams/:examId/study-plan", verifyStudent, createOrUpdateStudyPlan);
router.post("/exams/:examId/recalculate-plan", verifyStudent, createOrUpdateStudyPlan);
router.get("/exams/:examId/progress", optionalStudent, getExamProgress);
router.post("/exams/:examId/topic/:topicId/progress", verifyStudent, recordTopicProgress);
router.post("/exams/:examId/mock/submit", verifyStudent, submitMockTest);

const { crawlExamData } = require("../services/EasyShikshaExamCrawler");

// ── Dynamic Exam Crawler (Admin only) ────────────────────────────────────────
// Trigger: POST /api/graduate/crawl-exams
// Fetches exams from EasyShiksha and persists to database.
// Protected: requires verifyAdmin middleware
router.post(
  "/crawl-exams",
  verifyAdmin,
  async (req, res) => {
    try {
      const result = await crawlExamData();
      if (result.success) {
        return res.json({
          success: true,
          message: result.message,
          totalDiscovered: result.totalDiscovered,
          totalSaved: result.totalSaved,
          categoriesCovered: result.categoriesCovered,
        });
      } else {
        return res.status(500).json({
          success: false,
          message: result.error || "Crawler failed",
        });
      }
    } catch (err) {
      console.error("Crawl exams error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to run exam crawler",
        error: err.message,
      });
    }
  }
);

module.exports = router;
