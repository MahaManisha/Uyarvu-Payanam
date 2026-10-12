const GraduateProfile = require("../models/GraduateProfile");
const GraduateOpportunity = require("../models/GraduateOpportunity");
const GraduateApplication = require("../models/GraduateApplication");
const GraduateMentorRelationship = require("../models/GraduateMentorRelationship");
const MentorRequest = require("../models/MentorRequest");
const User = require("../models/User");
const CollegeCareerCatalog = require("../models/CollegeCareerCatalog");
const Exam = require("../models/Exam");
const GraduateExam = require("../models/GraduateExam");
const SavedItem = require("../models/SavedItem");
const ApplicationTracker = require("../models/ApplicationTracker");
const Notification = require("../models/Notification");
const { parseDate, assessEligibility, computeRecommendations } = require("../utils/graduateMatching");

// Public onboarding fields a client may write via /profile/step and
// /onboarding/complete. Ownership (userId), completion flag (onboardingCompleted),
// step/telemetry fields (currentStep, profileCompletion, careerReadinessScore)
// and the recommendation caches (cachedRecommendations) are server-controlled
// and can never be set or overwritten by the client (mass-assignment hardening).
const ONBOARDING_EDITABLE_FIELDS = new Set([
  "field", "degree", "domain", "specialization", "college", "university",
  "graduationYear", "cgpa", "percentage", "hasBacklogs", "backlogCount",
  "employmentStatus",
  "technicalSkills", "softSkills", "tools", "interests",
  "primaryCareerDirection", "secondaryDirections", "preferredWorkType",
  "preferredEnvironment", "careerPriority", "targetCareer",
  "examInterest", "selectedExams",
  "higherStudyInterest", "preferredHigherDegrees", "targetCountries",
  "upskillingFocusAreas",
  "lookingForOpportunity", "preferredRoles", "preferredIndustries",
  "preferredLocations", "remotePreference", "expectedSalary",
  "relocationWillingness",
  "projects", "internships", "certifications", "workExperience", "resumeUrl",
  "careerInterests", "targetState", "examPreparation", "ageRange", "remotePreference",
  "phone", "location", "linkedinUrl", "githubUrl", "portfolioUrl"
]);

// Merges only server-allowlisted fields onto a graduate profile.
const mergeEditableFields = (profile, source) => {
  Object.keys(source || {}).forEach((key) => {
    if (ONBOARDING_EDITABLE_FIELDS.has(key) && source[key] !== undefined) {
      profile[key] = source[key];
    }
  });
  return profile;
};

const { evaluateEligibility } = require("../services/GraduateEligibilityEngine");
const { refreshOpportunityStatuses, triggerTavilyResearch, seedDefaultOpportunities } = require("../services/GraduateOpportunityResearchService");

// Calculate profile completion percentage
const calculateProfileCompletion = (profile) => {
  let score = 0;
  if (profile.degree) score += 15;
  if (profile.specialization) score += 15;
  if (profile.collegeName || profile.college) score += 10;
  if (profile.graduationYear) score += 10;
  if (profile.cgpa || profile.percentage) score += 10;
  if (profile.careerInterests && profile.careerInterests.length > 0) score += 15;
  if (profile.preferredDomains && profile.preferredDomains.length > 0) score += 15;
  if (profile.onboardingCompleted) score += 10;
  return Math.min(100, score);
};

// Calculate career readiness score
const calculateReadinessScore = (profile) => {
  let score = 40; // baseline degree
  if (profile.cgpa && parseFloat(profile.cgpa) >= 7.5) score += 15;
  if (profile.skills && profile.skills.length > 0) score += 15;
  if (profile.experience && profile.experience.length > 0) score += 15;
  if (profile.resumeUrl) score += 15;
  return Math.min(100, score);
};

// Normalize String to ID helper
const toId = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ── GET /api/graduate/profile ──────────────────────────────────────────────────
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    let profile = await GraduateProfile.findOne({ userId });
    if (!profile) {
      const user = await User.findById(userId);
      profile = new GraduateProfile({
        userId,
        degree: "B.E.",
        degreeId: "be",
        specialization: "Computer Science",
        specializationId: "cse",
        profileCompletion: 0,
        careerReadinessScore: 40,
        onboardingCompleted: false
      });
      await profile.save();
    }

    res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Get graduate profile error:", error);
    res.status(500).json({ success: false, message: "Server error fetching profile" });
  }
};

// ── PUT & POST /api/graduate/profile & /api/graduate/onboarding ────────────────
exports.completeGraduateOnboarding = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = req.body;
    let profile = await GraduateProfile.findOne({ userId });
    if (!profile) profile = new GraduateProfile({ userId });

    // Personal / Academic fields
    if (data.degree) {
      profile.degree = data.degree;
      profile.degreeId = data.degreeId || toId(data.degree);
    }
    if (data.specialization) {
      profile.specialization = data.specialization;
      profile.specializationId = data.specializationId || toId(data.specialization);
    }
    if (data.collegeName !== undefined) profile.collegeName = data.collegeName;
    if (data.universityName !== undefined) profile.universityName = data.universityName;
    if (data.graduationYear !== undefined) profile.graduationYear = data.graduationYear;
    if (data.graduationStatus !== undefined) profile.graduationStatus = data.graduationStatus;
    if (data.cgpa !== undefined) profile.cgpa = data.cgpa;
    if (data.percentage !== undefined) profile.percentage = data.percentage;
    if (data.state !== undefined) profile.state = data.state;
    if (data.location !== undefined) profile.location = data.location;

    // Career Interests & Domains
    if (Array.isArray(data.careerInterests)) profile.careerInterests = data.careerInterests;
    if (Array.isArray(data.preferredDomains)) profile.preferredDomains = data.preferredDomains;
    if (Array.isArray(data.skills)) profile.skills = data.skills;
    if (Array.isArray(data.experience)) profile.experience = data.experience;
    if (data.resumeUrl !== undefined) profile.resumeUrl = data.resumeUrl;

    profile.onboardingCompleted = true;
    profile.profileCompletion = calculateProfileCompletion(profile);
    profile.careerReadinessScore = calculateReadinessScore(profile);

    await profile.save();

    // Update User model role/userType
    await User.findByIdAndUpdate(userId, {
      userType: "graduate",
      onboardingCompleted: true
    });

    res.status(200).json({
      success: true,
      message: "Graduate onboarding profile saved successfully",
      profile
    });
  } catch (error) {
    console.error("Complete graduate onboarding error:", error);
    res.status(500).json({ success: false, message: "Failed to save graduate onboarding profile" });
  }
};

// ── GET /api/graduate/dashboard ───────────────────────────────────────────────
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    let profile = await GraduateProfile.findOne({ userId });
    if (!profile) {
      profile = new GraduateProfile({ userId, onboardingCompleted: false });
      await profile.save();
    }

    const careerMatches = await generateCareerMatches(profile);
    const topCareer = careerMatches[0] || null;

    // Refresh data statuses
    await refreshOpportunityStatuses();

    // ── Real dashboard statistics (no fabricated numbers) ──────────────
    const savedCount = await SavedItem.countDocuments({ userId, contentType: "GraduateExam" });
    const applicationsTracked = await ApplicationTracker.countDocuments({ userId });
    const activeExams = await GraduateExam.find({ isActive: true })
      .select("examName governmentType state applicationEndDate examDate organization category")
      .populate("organization", "name")
      .limit(500)
      .lean();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const inThirtyDays = new Date(today.getTime() + 30 * 86400000);
    const upcoming = [];
    for (const ex of activeExams) {
      const appEnd = parseDate(ex.applicationEndDate);
      const examD = parseDate(ex.examDate);
      if (appEnd && appEnd >= today && appEnd <= inThirtyDays) {
        upcoming.push({ examId: ex._id, title: ex.examName, organization: ex.organization?.name || "", kind: "Application deadline", date: ex.applicationEndDate, state: ex.state, governmentType: ex.governmentType });
      } else if (examD && examD >= today && examD <= inThirtyDays) {
        upcoming.push({ examId: ex._id, title: ex.examName, organization: ex.organization?.name || "", kind: "Exam date", date: ex.examDate, state: ex.state, governmentType: ex.governmentType });
      }
    }
    upcoming.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const recommended = await computeRecommendations(profile);
    const recommendedCount = recommended.central.length + recommended.state.length;

    // Weekly action plan generated dynamically based on profile
    const weeklyPlan = [
      {
        task: `Practice core interview questions for ${topCareer ? topCareer.title : "your target role"}`,
        category: "Interview Prep",
        status: "pending"
      },
      {
        task: `Build a mini portfolio project covering ${topCareer?.missingSkills?.[0] || "modern tools"}`,
        category: "Upskilling",
        status: "pending"
      },
      {
        task: "Update Resume Projects section with measurable outcomes",
        category: "Placement Hub",
        status: "pending"
      }
    ];

    // Fetch opportunities from DB (ensure default seeding if empty)
    let opportunities = await GraduateOpportunity.find({}).lean();
    if (opportunities.length === 0) {
      await seedDefaultOpportunities();
      opportunities = await GraduateOpportunity.find({}).lean();
    }

    // Actual Database Counts for Opportunity Summary Cards
    const govCount = opportunities.filter(o => o.category === "GOVERNMENT_EXAMS").length;
    const higherStudiesCount = opportunities.filter(o => o.category === "HIGHER_STUDIES").length;
    const psuCount = opportunities.filter(o => o.category === "PSU").length;
    const privateJobsCount = opportunities.filter(o => o.category === "PRIVATE_JOBS").length;

    // Actual Mentorship Requests Count
    const incomingMentorRequestsCount = await GraduateMentorRelationship.countDocuments({
      mentorId: userId,
      status: "PENDING"
    }) + await MentorRequest.countDocuments({ status: "Pending" });

    // Evaluate Eligibility for Opportunities
    const evaluatedOpportunities = opportunities.map(opp => {
      const evalResult = evaluateEligibility(profile, opp);
      return {
        ...opp,
        eligibilityEvaluation: evalResult,
        matchScore: evalResult.matchScore
      };
    });

    // Sort by Match Score (Recommended for You)
    evaluatedOpportunities.sort((a, b) => b.matchScore - a.matchScore);

    // Upcoming Exams (Sorted by nearest deadline / exam date)
    const now = new Date();
    const upcomingExams = evaluatedOpportunities
      .filter(o => o.applicationDeadline || o.examDate)
      .sort((a, b) => {
        const dateA = a.applicationDeadline || a.examDate;
        const dateB = b.applicationDeadline || b.examDate;
        return new Date(dateA) - new Date(dateB);
      })
      .slice(0, 6);

    // Deadline Alerts (Closing soon / Upcoming)
    const deadlineAlerts = evaluatedOpportunities
      .filter(o => o.applicationDeadline && o.status !== "CLOSED")
      .map(o => {
        const diffMs = new Date(o.applicationDeadline).getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let urgency = "GREEN"; // upcoming
        if (diffDays <= 3) urgency = "RED"; // apply within 3 days
        else if (diffDays <= 7) urgency = "ORANGE"; // apply within 7 days

        return {
          id: o._id,
          title: o.opportunityName,
          organization: o.organization,
          deadline: o.applicationDeadline,
          diffDays,
          urgency,
          applicationUrl: o.applicationUrl
        };
      })
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 5);

    // Active User Applications Count
    const userApplicationsCount = await GraduateApplication.countDocuments({ userId });

    res.status(200).json({
      success: true,
      profile,
      summaryCounts: {
        governmentExams: govCount,
        higherStudies: higherStudiesCount,
        psuOpportunities: psuCount,
        privateJobs: privateJobsCount,
        mentorshipRequests: incomingMentorRequestsCount,
        myApplications: userApplicationsCount
      },
      weeklyPlan,
      stats: {
        recommendedOpportunities: recommendedCount,
        savedOpportunities: savedCount,
        applicationsTracked,
        upcomingDeadlines: upcoming.length
      },
      upcoming,
      recommendedOpportunities: evaluatedOpportunities.slice(0, 6),
      upcomingExams,
      deadlineAlerts
    });
  } catch (error) {
    console.error("Get graduate dashboard summary error:", error);
    res.status(500).json({ success: false, message: "Failed to load dashboard summary" });
  }
};

// ── GET /api/graduate/opportunities ───────────────────────────────────────────
exports.getOpportunities = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { category, search } = req.query;

    const profile = await GraduateProfile.findOne({ userId });

    let filter = {};
    if (category && category !== "ALL") {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { opportunityName: { $regex: search, $options: "i" } },
        { organization: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let opportunities = await GraduateOpportunity.find(filter).lean();
    if (opportunities.length === 0 && (!category || category === "ALL")) {
      await seedDefaultOpportunities();
      opportunities = await GraduateOpportunity.find(filter).lean();
    }

    const evaluated = opportunities.map(opp => {
      const evalResult = evaluateEligibility(profile, opp);
      return {
        ...opp,
        eligibilityEvaluation: evalResult,
        matchScore: evalResult.matchScore
      };
    });

    evaluated.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({ success: true, opportunities: evaluated });
  } catch (error) {
    console.error("Get opportunities error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch opportunities" });
  }
};

// ── GET /api/graduate/opportunities/:id ───────────────────────────────────────
exports.getOpportunityById = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { id } = req.params;

    const opportunity = await GraduateOpportunity.findById(id).lean();
    if (!opportunity) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    const profile = await GraduateProfile.findOne({ userId });
    const eligibilityEvaluation = evaluateEligibility(profile, opportunity);

    // Check if user has already added this to My Applications
    let existingApplication = null;
    if (userId) {
      existingApplication = await GraduateApplication.findOne({ userId, opportunityId: id }).lean();
    }

    res.status(200).json({
      success: true,
      opportunity: {
        ...opportunity,
        eligibilityEvaluation,
        matchScore: eligibilityEvaluation.matchScore,
        existingApplication
      }
    });
  } catch (error) {
    console.error("Get opportunity by id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch opportunity details" });
  }
};

// ── GET /api/graduate/government-exams ────────────────────────────────────────
exports.getGovernmentExams = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });

    const filter = { category: { $in: ["GOVERNMENT_EXAMS", "PSU"] } };
    let exams = await GraduateOpportunity.find(filter).lean();

    if (exams.length === 0) {
      await seedDefaultOpportunities();
      exams = await GraduateOpportunity.find(filter).lean();
    }

    const evaluated = exams.map(opp => {
      const evalResult = evaluateEligibility(profile, opp);
      return {
        ...opp,
        eligibilityEvaluation: evalResult,
        matchScore: evalResult.matchScore
      };
    });

    evaluated.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({ success: true, exams: evaluated });
  } catch (error) {
    console.error("Get government exams error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch government exams" });
  }
};

// ── GET /api/graduate/higher-studies ──────────────────────────────────────────
exports.getHigherStudiesGuide = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });

    const degree = (profile?.degree || "B.E.").toUpperCase();

    // 7-Step Higher Studies Application Pipeline
    const applicationFlow = [
      { step: 1, title: "Choose Program", description: "Select target postgraduate program (M.Tech, MS, MBA, MCA, PhD)" },
      { step: 2, title: "Choose Entrance Exam", description: "Identify eligible national/state entrance exam (GATE, CAT, XAT, CUET-PG, GRE)" },
      { step: 3, title: "Check Eligibility", description: "Verify degree, minimum percentage, and specialization requirements" },
      { step: 4, title: "View Participating Institutes", description: "Explore participating IITs, NITs, IIMs, Central Universities, and Global Colleges" },
      { step: 5, title: "Application Process", description: "Fill online portal forms, upload certificates, and submit application fees" },
      { step: 6, title: "Official Application Link", description: "Navigate directly to verified official admission portal" },
      { step: 7, title: "Preparation Roadmap", description: "Access AI-guided study syllabus, mock tests, and subject revision plans" }
    ];

    // Entrance Exams List for Higher Studies
    const entranceFilter = { category: "HIGHER_STUDIES" };
    let entranceExams = await GraduateOpportunity.find(entranceFilter).lean();
    if (entranceExams.length === 0) {
      await seedDefaultOpportunities();
      entranceExams = await GraduateOpportunity.find(entranceFilter).lean();
    }

    const evaluatedExams = entranceExams.map(opp => {
      const evalResult = evaluateEligibility(profile, opp);
      return {
        ...opp,
        eligibilityEvaluation: evalResult,
        matchScore: evalResult.matchScore
      };
    });

    res.status(200).json({
      success: true,
      degree,
      disclaimerNotice: "Eligibility varies by university/program. Verify the official admission notification before applying.",
      applicationFlow,
      entranceExams: evaluatedExams
    });
  } catch (error) {
    console.error("Get higher studies guide error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch higher studies guide" });
  }
};

// ── GET /api/graduate/applications & POST /api/graduate/applications ─────────
exports.getUserApplications = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const applications = await GraduateApplication.find({ userId })
      .populate("opportunityId")
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error("Get user applications error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
};

exports.createOrUpdateApplication = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { opportunityId, status, notes } = req.body;

    const opp = await GraduateOpportunity.findById(opportunityId);
    if (!opp) return res.status(404).json({ success: false, message: "Opportunity not found" });

    let application = await GraduateApplication.findOne({ userId, opportunityId });
    if (application) {
      if (status) application.status = status;
      if (notes !== undefined) application.notes = notes;
      await application.save();
    } else {
      application = new GraduateApplication({
        userId,
        opportunityId,
        opportunityName: opp.opportunityName,
        category: opp.category,
        organization: opp.organization,
        status: status || "PLANNING",
        officialApplicationUrl: opp.applicationUrl,
        deadline: opp.applicationDeadline,
        notes: notes || ""
      });
      await application.save();
    }

    res.status(200).json({ success: true, application });
  } catch (error) {
    console.error("Create/update application error:", error);
    res.status(500).json({ success: false, message: "Failed to save application" });
  }
};

// ── POST /api/graduate/opportunities/:id/reminder ─────────────────────────────
exports.setOpportunityReminder = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { id } = req.params;

    const opp = await GraduateOpportunity.findById(id);
    if (!opp) return res.status(404).json({ success: false, message: "Opportunity not found" });

    const now = new Date();
    if (opp.applicationDeadline && new Date(opp.applicationDeadline) < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot create reminders for already-closed applications."
      });
    }

    let application = await GraduateApplication.findOne({ userId, opportunityId: id });
    if (!application) {
      application = new GraduateApplication({
        userId,
        opportunityId: id,
        opportunityName: opp.opportunityName,
        category: opp.category,
        organization: opp.organization,
        status: "PLANNING",
        officialApplicationUrl: opp.applicationUrl,
        deadline: opp.applicationDeadline
      });
    }

    application.reminderSet = true;
    application.reminderDate = opp.applicationDeadline || new Date(Date.now() + 7 * 86400000);
    await application.save();

    // Create Notification record
    await Notification.create({
      userId,
      title: `Deadline Reminder: ${opp.opportunityName} 📅`,
      message: `Reminder set for ${opp.opportunityName} (Deadline: ${opp.applicationDeadline ? new Date(opp.applicationDeadline).toLocaleDateString() : 'Upcoming'}). Official URL: ${opp.applicationUrl}`,
      type: "exam",
      targetLevel: "Graduate",
      sentByAdmin: false
    });

    res.status(200).json({
      success: true,
      message: `Deadline reminder set for ${opp.opportunityName}`,
      application
    });
  } catch (error) {
    console.error("Set opportunity reminder error:", error);
    res.status(500).json({ success: false, message: "Failed to set deadline reminder" });
  }
};

// ── POST /api/graduate/research/refresh ───────────────────────────────────────
exports.refreshOpportunityResearch = async (req, res) => {
  try {
    const { query } = req.body;

    await refreshOpportunityStatuses();
    const liveResults = await triggerTavilyResearch(query);

    res.status(200).json({
      success: true,
      message: "Graduate opportunity research refreshed and verified",
      liveResults
    });
  } catch (error) {
    console.error("Refresh research error:", error);
    res.status(500).json({ success: false, message: "Failed to refresh research" });
  }
};

// GET /api/graduate/recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.student?._id;
    const profile = await GraduateProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Graduate profile not found" });
    }
    const recommendations = await computeRecommendations(profile);
    res.json({ success: true, ...recommendations });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res.status(500).json({ success: false, message: "Failed to load recommendations" });
  }
};

// GET /api/graduate/notifications
// Only verified, DB-backed items: published dates of managed exams plus
// admin announcements targeted at graduates. Nothing is fabricated.
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.student?._id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + 30 * 86400000);

    const exams = await GraduateExam.find({ isActive: true })
      .select("examName governmentType state applicationEndDate examDate notificationUrl applicationUrl organization")
      .populate("organization", "name")
      .limit(500)
      .lean();

    const alerts = [];
    for (const ex of exams) {
      const appEnd = parseDate(ex.applicationEndDate);
      const examD = parseDate(ex.examDate);
      if (appEnd && appEnd >= today && appEnd <= horizon) {
        alerts.push({
          kind: "deadline",
          title: `Application deadline approaching: ${ex.examName}`,
          message: `Applications close on ${ex.applicationEndDate}${ex.state ? ` (${ex.state})` : ""}. Organization: ${ex.organization?.name || "—"}.`,
          date: ex.applicationEndDate,
          examId: ex._id,
          actionUrl: ex.applicationUrl || ex.notificationUrl || "",
        });
      }
      if (examD && examD >= today && examD <= horizon) {
        alerts.push({
          kind: "exam",
          title: `Exam scheduled: ${ex.examName}`,
          message: `Exam date: ${ex.examDate}${ex.state ? ` (${ex.state})` : ""}.`,
          date: ex.examDate,
          examId: ex._id,
          actionUrl: ex.notificationUrl || ex.applicationUrl || "",
        });
      }
    }
    alerts.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const announcements = await Notification.find({
      $or: [
        { userId },
        { isBroadcast: true },
        { targetLevel: { $in: ["All", "Graduate"] }, userId: null },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, alerts: alerts.slice(0, 20), announcements });
  } catch (error) {
    console.error("Get graduate notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};



// ── Restored local-module handlers ──
const generateCareerMatches = async (profile) => {
  const userDomain = (profile.domain || "").toLowerCase();
  const userDegree = (profile.degree || "").toLowerCase();
  const userSkills = (profile.technicalSkills || []).map(s => s.name.toLowerCase());
  const userTools = (profile.tools || []).map(t => t.toLowerCase());
  const allUserSkills = [...userSkills, ...userTools];
  const userInterests = (profile.interests || []).map(i => i.toLowerCase());

  // Fetch available careers from catalog
  let careers = await CollegeCareerCatalog.find({}).lean();
  if (!careers || careers.length === 0) {
    // Built-in rich fallback catalog if DB catalog is empty
    careers = [
      {
        title: "Full Stack Software Developer",
        slug: "full-stack-developer",
        category: "Software & Computing",
        shortDescription: "Designs and builds end-to-end web and cloud applications using modern frontend and backend frameworks.",
        requiredSkills: ["JavaScript", "React", "Node.js", "SQL", "Git", "REST APIs"],
        growthOutlook: "Very High Demand",
        requiredDomains: ["Computer Science & Engineering", "Information Technology", "Electronics"]
      },
      {
        title: "Data Analyst / Analytics Consultant",
        slug: "data-analyst",
        category: "AI & Data Science",
        shortDescription: "Transforms complex datasets into business intelligence, reports, and predictive models.",
        requiredSkills: ["Python", "SQL", "Power BI", "Excel", "Statistics", "Data Visualization"],
        growthOutlook: "High Growth",
        requiredDomains: ["Data Science", "Computer Science", "Mathematics", "Commerce", "Engineering"]
      },
      {
        title: "AI / Machine Learning Engineer",
        slug: "ml-engineer",
        category: "AI & Data Science",
        shortDescription: "Builds intelligent algorithms, neural network pipelines, and automated reasoning models.",
        requiredSkills: ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "SQL", "Linear Algebra"],
        growthOutlook: "Exponential Growth",
        requiredDomains: ["Artificial Intelligence", "Computer Science", "Data Science"]
      },
      {
        title: "Mechanical Design & Simulation Engineer",
        slug: "mechanical-design-engineer",
        category: "Core Engineering",
        shortDescription: "Develops CAD models, structural analysis, and CFD simulations for industrial machinery and automotive systems.",
        requiredSkills: ["AutoCAD", "SolidWorks", "Finite Element Analysis (FEA)", "Thermodynamics", "GD&T"],
        growthOutlook: "Steady Demand",
        requiredDomains: ["Mechanical Engineering", "Automotive Engineering"]
      },
      {
        title: "Embedded Systems & IoT Engineer",
        slug: "embedded-iot-engineer",
        category: "Core Engineering",
        shortDescription: "Develops firmware, microcontrollers, and connected edge devices for smart hardware systems.",
        requiredSkills: ["C/C++", "Microcontrollers", "Embedded Systems", "RTOS", "PCB Design"],
        growthOutlook: "High Growth",
        requiredDomains: ["Electrical & Electronics Engineering", "Electronics & Communication"]
      },
      {
        title: "Business & Financial Analyst",
        slug: "financial-analyst",
        category: "Management & Finance",
        shortDescription: "Conducts corporate valuation, financial modeling, and risk forecasting for enterprises.",
        requiredSkills: ["Financial Analysis", "Excel", "Tally", "Financial Modeling", "Corporate Finance"],
        growthOutlook: "High Demand",
        requiredDomains: ["Finance & Accounting", "Commerce", "Management"]
      }
    ];
  }

  const results = [];

  for (const career of careers) {
    const cTitle = career.title.toLowerCase();
    const cCat = career.category.toLowerCase();
    const reqSkills = career.requiredSkills || [];
    const reqDomains = (career.requiredDomains || []).map(d => d.toLowerCase());

    let matchScore = 50; // base score
    const matchingSkills = [];
    const missingSkills = [];

    // 1. Skill Match (40% Weight)
    reqSkills.forEach(req => {
      const rLower = req.toLowerCase();
      const hasSkill = allUserSkills.some(u => u.includes(rLower) || rLower.includes(u));
      if (hasSkill) {
        matchingSkills.push(req);
      } else {
        missingSkills.push(req);
      }
    });

    if (reqSkills.length > 0) {
      matchScore += Math.round((matchingSkills.length / reqSkills.length) * 30);
    }

    // 2. Domain Alignment (20% Weight)
    const isDirectDomainMatch = reqDomains.some(d => userDomain.includes(d) || d.includes(userDomain));
    if (isDirectDomainMatch) {
      matchScore += 20;
    } else {
      matchScore += 5; // potential cross-domain career switch
    }

    // 3. Interest & Career Direction Match (10% Weight)
    const matchesInterest = userInterests.some(i => cTitle.includes(i) || cCat.includes(i));
    if (matchesInterest) matchScore += 10;

    matchScore = Math.min(96, Math.max(55, matchScore));

    // Career Switching Logic
    const isCareerSwitch = !isDirectDomainMatch && (userDomain.length > 0);
    let transitionGuidance = null;

    if (isCareerSwitch) {
      transitionGuidance = {
        isCareerSwitch: true,
        originalDomain: profile.domain || "Your Current Degree",
        targetDomain: career.category,
        transitionDifficulty: matchScore >= 70 ? "Moderate" : "Challenging",
        transferableSkills: matchingSkills.length > 0 ? matchingSkills : ["Problem Solving", "Analytical Thinking"],
        advice: `Transitioning from ${profile.domain || "your background"} into ${career.title} is achievable by focusing on your transferable skills and building 2-3 portfolio projects covering: ${missingSkills.slice(0, 3).join(", ")}.`
      };
    }

    results.push({
      title: career.title,
      slug: career.slug || career.title.toLowerCase().replace(/\s+/g, "-"),
      category: career.category,
      shortDescription: career.shortDescription,
      growthOutlook: career.growthOutlook || "High Demand",
      matchScore,
      whyItMatches: isDirectDomainMatch
        ? `Direct alignment with your ${profile.domain} degree and core skills.`
        : `Strong potential match leveraging your ${matchingSkills.join(", ") || "analytical fundamentals"}.`,
      matchingSkills,
      missingSkills,
      transitionGuidance,
      nextStep: `Build portfolio projects in ${missingSkills.slice(0, 2).join(" & ") || "core industry tools"}`
    });
  }

  // Sort descending by match score
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
};

// ΓöÇΓöÇ GET /api/graduate/profile ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const validateAcademicCombination = (field, degree, domain) => {
  if (!field || !degree || !domain) return true;
  const fLower = String(field).toLowerCase();
  const domLower = String(domain).toLowerCase();

  if (fLower.includes("medical") && (domLower.includes("electronics") || domLower.includes("mechanical") || domLower.includes("civil") || domLower.includes("computer science"))) {
    return false;
  }
  if (fLower.includes("commerce") && (domLower.includes("mechanical") || domLower.includes("civil") || domLower.includes("electronics"))) {
    return false;
  }
  if (fLower.includes("law") && (domLower.includes("vlsi") || domLower.includes("embedded") || domLower.includes("mechanical"))) {
    return false;
  }
  return true;
};

// ΓöÇΓöÇ POST /api/graduate/profile/step ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

exports.saveOnboardingStep = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const stepData = req.body;
    let profile = await GraduateProfile.findOne({ userId });
    if (!profile) profile = new GraduateProfile({ userId });

    // Merge only server-allowlisted fields (ownership/telemetry/completion
    // flags are never client-settable).
    mergeEditableFields(profile, stepData);

    if (!validateAcademicCombination(profile.field, profile.degree, profile.domain)) {
      return res.status(400).json({
        success: false,
        message: "Invalid academic combination: Major Academic Field, Degree, and Domain must be academically consistent."
      });
    }

    profile.profileCompletion = calculateProfileCompletion(profile);
    profile.careerReadinessScore = calculateReadinessScore(profile);

    await profile.save();
    res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Save graduate onboarding step error:", error);
    res.status(500).json({ success: false, message: "Failed to save step" });
  }
};

// ΓöÇΓöÇ POST /api/graduate/onboarding/complete ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

exports.getCareerRecommendations = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    const careers = await generateCareerMatches(profile);
    res.status(200).json({ success: true, careers });
  } catch (error) {
    console.error("Get graduate career recommendations error:", error);
    res.status(500).json({ success: false, message: "Failed to load recommendations" });
  }
};

// ΓöÇΓöÇ GET /api/graduate/skill-gap ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
exports.getSkillGapAnalysis = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    const careers = await generateCareerMatches(profile);
    const targetCareer = careers[0];

    const userSkills = (profile.technicalSkills || []).map(s => ({
      name: s.name,
      proficiency: s.proficiency
    }));

    res.status(200).json({
      success: true,
      targetCareer: targetCareer?.title || "Target Career",
      matchScore: targetCareer?.matchScore || 70,
      skillsAvailable: targetCareer?.matchingSkills || [],
      skillsNeedingImprovement: targetCareer?.missingSkills || [],
      recommendedLearningOrder: [
        ...(targetCareer?.missingSkills || []).map((s, idx) => ({
          step: idx + 1,
          skill: s,
          estimatedWeeks: 2 + idx,
          resourceType: idx === 0 ? "Hands-on Tutorials & Docs" : "Applied Portfolio Project"
        }))
      ],
      userSkills
    });
  } catch (error) {
    console.error("Get skill gap analysis error:", error);
    res.status(500).json({ success: false, message: "Failed to analyze skill gap" });
  }
};

// ΓöÇΓöÇ GET /api/graduate/exams ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

exports.getExamsGuide = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });

    const domain = (profile?.domain || "").toLowerCase();

    // Curated catalog of relevant competitive exams
    const exams = [
      {
        name: "GATE (Graduate Aptitude Test in Engineering)",
        category: "Engineering & Science",
        eligibleDegrees: ["B.E / B.Tech", "M.Sc", "MCA"],
        conductingBody: "IITs / IISc Bangalore",
        frequency: "Once a year (February)",
        purpose: "M.Tech / Ph.D in IITs/NITs and Direct PSU Recruitment (ONGC, IOCL, NTPC, BHEL)",
        overview: "A prestigious national examination testing comprehensive understanding of undergraduate engineering subjects.",
        syllabusKeywords: ["Core Engineering Mathematics", "Data Structures / Algorithms / Digital Logic", "Engineering Sciences"],
        officialWebsite: "https://gate.iitk.ac.in",
        preparationRoadmap: "Phase 1: Syllabus fundamentals (3 months) ΓåÆ Phase 2: Previous year questions (2 months) ΓåÆ Phase 3: Mock tests & revision (1 month)"
      },
      {
        name: "CAT (Common Admission Test)",
        category: "Management",
        eligibleDegrees: ["Any Graduate Degree (Min 50% marks)"],
        conductingBody: "IIMs",
        frequency: "Once a year (November)",
        purpose: "Admission to premier MBA / PGDM programmes at IIMs, FMS, SPJIMR, etc.",
        overview: "Tests Quantitative Aptitude, Data Interpretation & Logical Reasoning, and Verbal Ability.",
        syllabusKeywords: ["Quantitative Aptitude", "Data Interpretation", "Logical Reasoning", "Verbal Ability & Reading Comprehension"],
        officialWebsite: "https://iimcat.ac.in",
        preparationRoadmap: "Focus on daily reading comprehension, mental math speed, and sectional timing mocks."
      },
      {
        name: "UPSC Civil Services Examination (CSE)",
        category: "Public Sector & Governance",
        eligibleDegrees: ["Any Recognized Graduate Degree"],
        conductingBody: "Union Public Service Commission",
        frequency: "Once a year (May - Prelims, Sep - Mains)",
        purpose: "Direct recruitment to IAS, IPS, IFS, IRS, and central civil posts",
        overview: "Consists of Prelims (General Studies + CSAT), Mains (9 written papers), and Personality Interview.",
        syllabusKeywords: ["History, Geography, Polity", "Economics & Environment", "Current Affairs", "Optional Subject"],
        officialWebsite: "https://upsc.gov.in",
        preparationRoadmap: "NCERT foundation reading (4 months) ΓåÆ Standard reference texts + answer writing (6 months) ΓåÆ Test series (3 months)"
      },
      {
        name: "SSC CGL (Combined Graduate Level)",
        category: "Central Government Jobs",
        eligibleDegrees: ["Any Graduate Degree"],
        conductingBody: "Staff Selection Commission",
        frequency: "Annual",
        purpose: "Group B and C officers in Central Ministries, Income Tax, Customs, and CAG",
        overview: "Tier 1 and Tier 2 computer-based examinations testing Math, Reasoning, English, and General Awareness.",
        syllabusKeywords: ["Quantitative Aptitude", "General Intelligence", "English Comprehension", "General Awareness"],
        officialWebsite: "https://ssc.nic.in",
        preparationRoadmap: "Consistent daily problem sets in Arithmetic, English grammar, and current affairs."
      },
      {
        name: "GRE & IELTS / TOEFL (Higher Studies Abroad)",
        category: "Study Abroad",
        eligibleDegrees: ["Any Graduate Degree"],
        conductingBody: "ETS / British Council / IDP",
        frequency: "Year-round",
        purpose: "MS and PhD admissions in USA, Europe, Canada, Australia, and Singapore",
        overview: "GRE evaluates analytical writing, quantitative reasoning, and verbal reasoning. IELTS tests English language proficiency.",
        syllabusKeywords: ["Vocabulary & Reading Comprehension", "Quantitative Reasoning", "Analytical Writing"],
        officialWebsite: "https://www.ets.org/gre",
        preparationRoadmap: "Vocabulary building + Quant practice (8ΓÇô12 weeks) followed by full-length computer-based mocks."
      }
    ];

    res.status(200).json({
      success: true,
      selectedExams: profile?.selectedExams || [],
      examInterest: profile?.examInterest || "No",
      exams
    });
  } catch (error) {
    console.error("Get exams guide error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch exams guide" });
  }
};

// ΓöÇΓöÇ GET /api/graduate/higher-studies ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

exports.getUpskillingRoadmap = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const profile = await GraduateProfile.findOne({ userId });

    const careers = await generateCareerMatches(profile || {});
    const targetCareer = careers[0] || { title: "Software Engineer", missingSkills: ["Modern Tools", "Portfolio Project"] };

    const roadmapPhases = [
      {
        phaseNumber: 1,
        title: "Phase 1: Strengthen Fundamentals & Core Concepts",
        duration: "Weeks 1ΓÇô4",
        status: "in-progress",
        description: `Master fundamental principles and essential baseline competencies for ${targetCareer.title}.`,
        tasks: [
          "Complete foundational concepts check and skill diagnostic",
          `Master basics of ${targetCareer.missingSkills?.[0] || "core tools"}`,
          "Set up professional development environment (Git, IDE, Terminal)"
        ]
      },
      {
        phaseNumber: 2,
        title: "Phase 2: Tool Mastery & Applied Problem Solving",
        duration: "Weeks 5ΓÇô8",
        status: "upcoming",
        description: `Build hands-on proficiency with required industry tools (${targetCareer.missingSkills?.slice(0, 3).join(", ") || "tools"}).`,
        tasks: [
          `Build structured modules using ${targetCareer.missingSkills?.[1] || "frameworks"}`,
          "Practice 30+ domain problems and scenario implementations",
          "Conduct code review and optimize performance efficiency"
        ]
      },
      {
        phaseNumber: 3,
        title: "Phase 3: Portfolio Projects & Real-World Evidence",
        duration: "Weeks 9ΓÇô12",
        status: "upcoming",
        description: "Develop 2 comprehensive portfolio projects that demonstrate practical competence to hiring teams.",
        tasks: [
          `Build Project 1: Full-scale ${targetCareer.title} workflow application`,
          "Build Project 2: Problem-solving case study with clean GitHub documentation",
          "Publish live demo links and write concise architecture overview"
        ]
      },
      {
        phaseNumber: 4,
        title: "Phase 4: Placement Preparation & Career Transition",
        duration: "Weeks 13ΓÇô16",
        status: "upcoming",
        description: "Optimize professional resume, practice technical & HR interviews, and begin targeted applications.",
        tasks: [
          "Complete ATS-friendly Resume with highlighted projects & impact metrics",
          "Practice 50+ role-specific interview questions",
          "Apply to 15+ curated graduate trainee, internship, or entry-level roles"
        ]
      }
    ];

    res.status(200).json({
      success: true,
      targetCareer: targetCareer.title,
      roadmapPhases
    });
  } catch (error) {
    console.error("Get upskilling roadmap error:", error);
    res.status(500).json({ success: false, message: "Failed to generate roadmap" });
  }
};

// GET /api/graduate/recommendations


// restored handlers


