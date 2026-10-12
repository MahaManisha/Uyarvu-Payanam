const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const path = require("path");

dotenv.config();

// JWT signing secret boot guard. In production the server refuses to start
// without a real JWT_SECRET so the development-only fallback secret can never
// be used against deployed traffic (see utils/jwtSecret.js).
try {
  require("./utils/jwtSecret")();
} catch (err) {
  console.error(`[FATAL] ${err.message}. Refusing to start.`);
  process.exit(1);
}
connectDB().then(() => {
  try {
    // Recover memory jobs interrupted by a previous process restart (in-process
    // background processing has no durable queue) — surfaces them as retryable.
    require("./services/memoryProcessingService").recoverInterrupted();
    const { importDiplomaCSV } = require("./utils/diplomaImporter");
    importDiplomaCSV(false).catch(err => console.error("Error in auto diploma import:", err));
  } catch (err) {
    console.error("Failed to require/run diploma importer on startup:", err);
  }
  try {
    const { importArtsScienceExcel } = require("./utils/artsScienceImporter");
    importArtsScienceExcel(false).catch(err => console.error("Error in auto Arts & Science import:", err));
  } catch (err) {
    console.error("Failed to require/run Arts & Science importer on startup:", err);
  }
  try {
    const { importMedicalExcel } = require("./utils/medicalImporter");
    importMedicalExcel(false).catch(err => console.error("Error in auto Medical import:", err));
  } catch (err) {
    console.error("Failed to require/run Medical importer on startup:", err);
  }
  try {
    const { importSiddhaExcel } = require("./utils/siddhaImporter");
    importSiddhaExcel(false).catch(err => console.error("Error in auto Siddha import:", err));
  } catch (err) {
    console.error("Failed to require/run Siddha importer on startup:", err);
  }
  try {
    const { importAyurvedaExcel } = require("./utils/ayurvedaImporter");
    importAyurvedaExcel(false).catch(err => console.error("Error in auto Ayurveda import:", err));
  } catch (err) {
    console.error("Failed to require/run Ayurveda importer on startup:", err);
  }
  try {
    const { seedTaxonomyData } = require("./utils/taxonomySeeder");
    const { seedCollegeCareers } = require("./utils/collegeCareerSeeder");
    const { seedAhpFuzzyQuestions } = require("./seeders/seedAhpFuzzyQuestions");
    const { seedPdfMasterQuestionBank } = require("./seeders/seedPdfMasterQuestionBank");
    seedTaxonomyData().catch(err => console.error("Error in taxonomy seeding:", err));
    seedCollegeCareers().catch(err => console.error("Error in college careers seeding:", err));
    seedAhpFuzzyQuestions().catch(err => console.error("Error in AHP Fuzzy questions seeding:", err));
    seedPdfMasterQuestionBank().catch(err => console.error("Error in PDF Master Question Bank seeding:", err));
  } catch (err) {
    console.error("Failed to require/run seeders on startup:", err);
  }
  try {
    const { seedClass5Discovery } = require("./seeders/seedClass5Discovery");
    seedClass5Discovery()
      .then((results) => {
        console.log("Class 5 discovery seed:", results);
      })
      .catch(err => console.error("Error in Class 5 discovery seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Class 5 discovery seeding:", err);
  }
  try {
    const { startScheduler } = require("./services/class5EngineService");
    startScheduler();
  } catch (err) {
    console.error("Failed to start Class 5 scheduler:", err);
  }
  try {
    const { seedAdhikarams } = require("./seeders/seedAdhikarams");
    seedAdhikarams()
      .then(results => {
        console.log("Adhikaram seed:", results);
      })
      .catch(err => console.error("Error in Adhikaram seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Adhikaram seeding:", err);
  }
  try {
    const { seedMaths } = require("./seeders/seedMaths");
    seedMaths()
      .then(results => {
        console.log("Math Adventure seed:", results);
      })
      .catch(err => console.error("Error in Math Adventure seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Math Adventure seeding:", err);
  }
  try {
    const { seedSocial } = require("./seeders/seedSocial");
    seedSocial()
      .then(results => {
        console.log("World Explorer seed:", results);
      })
      .catch(err => console.error("Error in World Explorer seeding:", err));
  } catch (err) {
    console.error("Failed to require/run World Explorer seeding:", err);
  }
  try {
    const { seedMathMissions } = require("./seeders/seedMathMissions");
    seedMathMissions()
      .then(results => {
        console.log("Maths Missions seed:", results);
      })
      .catch(err => console.error("Error in Maths Missions seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Maths Missions seeding:", err);
  }
  try {
    const { seedEnglishMissions } = require("./seeders/seedEnglishMissions");
    seedEnglishMissions()
      .then(results => {
        console.log("English Missions seed (curriculum in code):", results);
      })
      .catch(err => console.error("Error in English Missions seeding:", err));
  } catch (err) {
    console.error("Failed to require/run English Missions seeding:", err);
  }
  try {
    const { seedScience } = require("./seeders/seedScience");
    seedScience()
      .then(results => {
        console.log("Science Adventure seed:", results);
      })
      .catch(err => console.error("Error in Science Adventure seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Science Adventure seeding:", err);
  }
  try {
    const { seedStreams } = require("./seeders/seedStreams");
    seedStreams()
      .then(results => {
        console.log("Streams After 10th seed:", results);
      })
      .catch(err => console.error("Error in Streams seeding:", err));
  } catch (err) {
    console.error("Failed to require/run Streams seeding:", err);
  }
});

const app = express();
const server = http.createServer(app);

// ─── CORS Origins ───────────────────────────────────────────────────
const devOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];
const productionOrigin = process.env.FRONTEND_URL || "";
const allowedOrigins = process.env.NODE_ENV === "production" && productionOrigin
  ? [productionOrigin]
  : devOrigins;

const corsOriginValidator = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error("CORS policy: Origin not allowed"));
  }
};

// ─── Socket.io setup ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Store io on the app object so controllers can access it via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── Admin connection ─────────────────────────────────────────────
  // Admin clients join the "admins" room for multi-tab state sync.
  // Admin does NOT join "students" or any "user_<id>" room.
  socket.on("join_admin", () => {
    socket.join("admins");
    console.log(`🔑 Admin socket ${socket.id} joined [admins] room`);
  });

  // ── Student connection ───────────────────────────────────────────
  // Students emit "join_student" with their userId.
  // They join TWO rooms:
  //   1. "students"       → shared room for broadcast notifications
  //   2. "user_<userId>"  → personal room for targeted notifications
  // Admin clients do NOT call this event, so admin is NEVER in these rooms
  // and will NEVER receive user notification socket events.
  socket.on("join_student", (userId) => {
    socket.join("students");           // shared broadcast room
    socket.join(`user_${userId}`);     // personal room
    console.log(`🎓 Student ${userId} joined rooms: students, user_${userId}`);
  });

  // Legacy support: if old client code calls join_user_room
  socket.on("join_user_room", (userId) => {
    socket.join("students");
    socket.join(`user_${userId}`);
    console.log(`📌 Socket ${socket.id} joined room: user_${userId}`);
  });

  // ── Peer Chat — typing indicator ─────────────────────────────────────────
  // Client emits { conversationId, userId, peerId } to signal typing.
  // We forward it to the peer's personal room only.
  socket.on("peer:typing", ({ conversationId, userId, peerId }) => {
    if (peerId) {
      socket.to(`user_${peerId}`).emit("peer:typing", { conversationId, userId });
    }
  });

  // ── Focus Mode — status broadcast to peer study partner ─────────────────
  socket.on("focus:status", ({ toUserId, status, subject }) => {
    if (toUserId) {
      socket.to(`user_${toUserId}`).emit("focus:status", { status, subject });
    }
  });

  // ── Multiplayer Quiz Socket Events ──────────────────────────────────────
  socket.on("quiz:join", ({ sessionId, userId }) => {
    if (sessionId) {
      socket.join(`quiz:${sessionId}`);
      console.log(`🎯 Socket ${socket.id} (user ${userId}) joined quiz room [quiz:${sessionId}]`);
      socket.to(`quiz:${sessionId}`).emit("quiz:player-joined", { sessionId, userId });
    }
  });

  socket.on("quiz:leave", ({ sessionId, userId }) => {
    if (sessionId) {
      socket.leave(`quiz:${sessionId}`);
      socket.to(`quiz:${sessionId}`).emit("quiz:player-disconnected", { sessionId, userId });
    }
  });

  socket.on("quiz:answer", async ({ sessionId, userId, questionId, selectedOption, responseTime }) => {
    try {
      if (!sessionId || !userId) return;
      const { processUserAnswer } = require("./controllers/multiplayerQuizController");
      await processUserAnswer({ sessionId, userId, questionId, selectedOption, responseTime, io });
    } catch (err) {
      console.error(`Socket quiz:answer error for user ${userId}:`, err.message);
    }
  });

  socket.on("quiz:next-question-ready", async ({ sessionId, userId, questionId }) => {
    try {
      if (!sessionId || !userId) return;
      const { markUserReadyForNext } = require("./controllers/multiplayerQuizController");
      await markUserReadyForNext({ sessionId, userId, questionId, io });
    } catch (err) {
      console.error(`Socket quiz:next-question-ready error for user ${userId}:`, err.message);
    }
  });

  socket.on("quiz:timeout", async ({ sessionId }) => {
    try {
      if (!sessionId) return;
      const { checkAndEnforceQuestionTimeout } = require("./controllers/multiplayerQuizController");
      await checkAndEnforceQuestionTimeout(sessionId, io);
    } catch (err) {
      console.error(`Socket quiz:timeout error:`, err.message);
    }
  });

  socket.on("quiz:chat", ({ sessionId, userId, senderName, message }) => {
    if (sessionId && message) {
      io.to(`quiz:${sessionId}`).emit("quiz:chat-message", {
        userId,
        senderName: senderName || "Study Partner",
        message: String(message).substring(0, 500),
        timestamp: new Date()
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ──────────────────────────────────────────────────────────
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin/college", require("./routes/collegeAdminRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/career-paths", require("./routes/careerPathRoutes"));
app.use("/api/cutoffs", require("./routes/cutoffRoutes"));
app.use("/api/cutoff", require("./routes/cutoffRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/exams", require("./routes/examRoutes"));
app.use("/api/graduate-exams", require("./routes/graduateExamRoutes"));
app.use("/api/colleges", require("./routes/collegeRoutes"));
app.use("/api/scholarships", require("./routes/scholarshipRoutes"));
app.use("/api/college-scholarships", require("./routes/collegeScholarshipRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/admin/notifications", require("./routes/adminNotificationRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/student", require("./routes/studentRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/class-content", require("./routes/classContentRoutes"));
app.use("/api/user-actions", require("./routes/userActionRoutes"));
app.use("/api/recommendations", require("./routes/recommendationRoutes"));
app.use("/api/assessment", require("./routes/grokAssessmentRoutes"));
app.use("/api/study-tools", require("./routes/collegeStudyToolsRoutes"));
app.use("/api/interview-prep", require("./routes/companyInterviewPrepRoutes"));
app.use("/api/learning-roadmap", require("./routes/learningRoadmapRoutes"));
app.use("/api/practice", require("./routes/practiceRoutes"));
app.use("/api/college-courses", require("./routes/collegeCourseRoutes"));
app.use("/api/mentor-requests", require("./routes/mentorRequestRoutes"));
app.use("/api/assessment", require("./routes/assessmentRoutes"));
app.use("/api/onboarding/ahp", require("./routes/ahpOnboardingRoutes"));
app.use("/api/question-bank", require("./routes/ahpFuzzyRoutes"));
app.use("/api/onboarding/discovery", require("./routes/ahpFuzzyRoutes"));
app.use("/api/onboarding/fuzzy", require("./routes/ahpFuzzyRoutes"));
app.use("/api/onboarding", require("./routes/onboardingRoutes"));
app.use("/api/college-profile", require("./routes/collegeProfileRoutes"));
app.use("/api/college-advisor", require("./routes/collegeAdvisorRoutes"));
app.use("/api/taxonomy", require("./routes/taxonomyRoutes"));
app.use("/api/admission-help", require("./routes/admissionHelpRoutes"));
app.use("/api/class5-communication", require("./routes/class5CommunicationRoutes"));
app.use("/api/communication-content", require("./routes/communicationContentRoutes"));

// Graduate career portal (profile, onboarding, dashboard, careers, exams,
// higher-studies, roadmap, AI advisor) — userType "graduate" portal.
app.use("/api/graduate", require("./routes/graduateRoutes"));
app.use("/api/applications", require("./routes/applicationRoutes"));
app.use("/api/graduate", require("./routes/resumeRoutes"));

// Higher Studies module (admin CRUD + public read APIs)
app.use("/api/higher-studies", require("./routes/higherStudiesRoutes"));

// Class 5 career-discovery feature (Discover Me, Skill Quests, Squad, Real World, Trophy Room)
// Note: endpoints live under /api/class5/* so the existing /api/scholarships service stays untouched.
app.use("/api/class5", require("./routes/class5DiscoveryRoutes"));

// Thirukkural Adhikaram Cartoon Theme System
app.use("/api/tamil", require("./routes/tamilRoutes"));

// Math Adventure Worlds (Class 5 maths)
app.use("/api/maths", require("./routes/mathsRoutes"));

// Class 8 Maths Missions (Fractions reference implementation)
app.use("/api/maths", require("./routes/mathsMissionsRoutes"));

// World Explorer (Class 5 social science)
app.use("/api/social", require("./routes/socialRoutes"));

// Cartoon Science Adventure World (Class 5 science)
app.use("/api/science", require("./routes/scienceRoutes"));

// English Adventure (Class 5)
app.use("/api/english", require("./routes/englishRoutes"));

// Class 8 English Space Explorer (server-driven lesson + AI assessment module)
app.use("/api/english-missions", require("./routes/englishMissionsRoutes"));

// Streams After 10th (Class 10 HSC groups & vocational courses)
app.use("/api/streams", require("./routes/streamRoutes"));

// Colleges Insight (Class 12) — public read API over the admin College-Course Mapping data
app.use("/api/colleges-insight", require("./routes/collegesInsightRoutes"));

// Admin-only TNEA seat-matrix import + "Courses & Colleges" explorers
app.use("/api/admin/seat-matrix", require("./routes/seatMatrixRoutes"));

// AHP (Analytic Hierarchy Process) + Fuzzy Logic Assessment Engine
app.use("/api/ahp-fuzzy", require("./routes/ahpFuzzyRoutes"));
app.use("/api/onboarding/discovery", require("./routes/ahpFuzzyRoutes"));

// CSE Technical Skill MCQ Assessment Route (Step 6)
app.use("/api/cse-skills", require("./routes/cseSkillRoutes"));

// Step 5 AHP Career Interest Discovery Route
app.use("/api/onboarding/ahp", require("./routes/ahpOnboardingRoutes"));

// ── Intelligent Focus Mode (College Students) ───────────────────────────────
app.use("/api/focus", require("./routes/focusRoutes"));

// Peer Chat & Study Partner System (College Students)
app.use("/api/peer-chat", require("./routes/peerChatRoutes"));

// ── Real-time Multiplayer Quiz Engine ───────────────────────────────────────
app.use("/api/multiplayer-quiz", require("./routes/multiplayerQuizRoutes"));

// ── Engineering Hackathon & Project Teammate Matchmaker ─────────────────────
app.use("/api/teammate-matchmaker", require("./routes/teammateMatchmakerRoutes"));

// ── Personal Memory Vault (all authenticated students — voice, journal,
//    email/letter, document, story/note) with AI processing + retrieval ─────
app.use("/api/memories", require("./routes/memoryRoutes"));

// ── Class 8 Skill Adventure (games + evidence → LD-NBSE) ────────────────────
app.use("/api/class8-skills", require("./routes/class8SkillsRoutes"));

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server + Socket.io running on port ${PORT}`)
);
