const Exam = require("../models/Exam");
const ExamStudyPlan = require("../models/ExamStudyPlan");
const GraduateProfile = require("../models/GraduateProfile");
const { seedDefaultExams, triggerTavilyExamResearch } = require("../services/ExamResearchService");
const { generatePersonalizedStudyPlan } = require("../services/studyPlanEngine");
const { calculateExamReadiness } = require("../services/ExamReadinessService");
const { calculateTopicPriority } = require("../services/ExamTopicPriorityService");

// Dynamic Status Calculation Helper
function calculateDynamicStatus(exam) {
  const now = new Date();
  if (exam.applicationStartDate || exam.applicationEndDate || exam.examDate) {
    const start = exam.applicationStartDate ? new Date(exam.applicationStartDate) : null;
    const end = exam.applicationEndDate ? new Date(exam.applicationEndDate) : null;
    const examDt = exam.examDate ? new Date(exam.examDate) : null;

    if (start && now < start) return "UPCOMING";
    if (start && end && now >= start && now <= end) {
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= 0) return "CLOSING_SOON";
      return "OPEN";
    }
    if (end && now > end && (!examDt || now <= examDt)) return "CLOSED";
    if (examDt && now > examDt) return "COMPLETED";
  }

  if (exam.status && ["UPCOMING", "OPEN", "CLOSING_SOON", "CLOSED", "COMPLETED", "NOT_VERIFIED"].includes(exam.status)) {
    return exam.status;
  }
  return "OPEN";
}

// Candidate Profile Match & Eligibility Engine
function evaluateExamMatchAndEligibility(profile, exam) {
  let score = 50; // Baseline score
  let degreeMatch = false;
  let branchMatch = false;

  const candidateDegree = String(profile?.degree || "").trim().toUpperCase();
  const candidateBranch = String(profile?.specialization || "").trim().toUpperCase();

  const eligibleDegs = (exam.eligibleDegrees || []).map(d => String(d).toUpperCase());
  const eligibleBranks = (exam.eligibleBranches || []).map(b => String(b).toUpperCase());

  // Degree Match Check
  if (
    eligibleDegs.length === 0 ||
    eligibleDegs.some(d => d.includes("ANY") || d.includes("DEGREE") || candidateDegree.includes(d) || d.includes(candidateDegree))
  ) {
    degreeMatch = true;
    score += 25;
  }

  // Branch / Specialization Match Check
  if (
    eligibleBranks.length === 0 ||
    eligibleBranks.some(b => b.includes("ALL") || candidateBranch.includes(b) || b.includes(candidateBranch))
  ) {
    branchMatch = true;
    score += 15;
  }

  // Career Interest & Category Alignment
  const interests = (profile?.careerInterests || []).concat(profile?.preferredDomains || []).map(i => String(i).toUpperCase());
  const examCat = String(exam.category || "").toUpperCase();

  if (interests.some(i => i.includes(examCat) || examCat.includes(i))) {
    score += 10;
  }

  // Cap match score between 40% and 98%
  const matchScore = Math.min(98, Math.max(40, score));

  // Determine Eligibility Status
  let eligibilityStatus = "ELIGIBLE";
  let eligibilityBadgeText = "✓ Your profile appears eligible";

  if (degreeMatch && branchMatch) {
    eligibilityStatus = "ELIGIBLE";
    eligibilityBadgeText = "✓ Eligible";
  } else if (degreeMatch) {
    eligibilityStatus = "CHECK_REQUIRED";
    eligibilityBadgeText = "⚠ Eligibility Check Required";
  } else {
    eligibilityStatus = "INELIGIBLE";
    eligibilityBadgeText = "✕ Not Currently Eligible";
  }

  return {
    matchScore,
    eligibilityStatus,
    eligibilityBadgeText
  };
}

// ── GET /api/graduate/exams ──────────────────────────────────────────────────
exports.getExams = async (req, res) => {
  try {
    const { category, search } = req.query;
    const userId = req.student?._id || req.user?._id || req.student?.id;

    // Ensure database is populated if total records is 0
    const totalCountInDb = await Exam.countDocuments({});
    if (totalCountInDb === 0) {
      await seedDefaultExams();
    }

    let filter = {};
    if (category && category !== "ALL") {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { shortName: { $regex: search, $options: "i" } },
        { conductingOrganization: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    let exams = await Exam.find(filter).lean();

    // Fetch Graduate Profile for personalized match score calculation
    let profile = null;
    if (userId) {
      profile = await GraduateProfile.findOne({ userId }).lean();
    }

    // Enrich exam records with dynamic status, match score, and eligibility badge
    const enrichedExams = exams.map(ex => {
      const computedStatus = calculateDynamicStatus(ex);
      const evalResult = evaluateExamMatchAndEligibility(profile, ex);

      return {
        ...ex,
        status: computedStatus,
        matchScore: evalResult.matchScore,
        eligibilityStatus: evalResult.eligibilityStatus,
        eligibilityBadgeText: evalResult.eligibilityBadgeText
      };
    });

    // Sort by match score descending
    enrichedExams.sort((a, b) => b.matchScore - a.matchScore);

    // If ALL category & no search query, compute Recommended Section
    let recommendedExams = [];
    if ((!category || category === "ALL") && !search) {
      recommendedExams = enrichedExams.slice(0, 4);
    }

    res.status(200).json({
      success: true,
      count: enrichedExams.length,
      exams: enrichedExams,
      recommendedExams
    });
  } catch (error) {
    console.error("Get exams error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch examinations list" });
  }
};

// ── GET /api/graduate/exams/:examId ─────────────────────────────────────────
exports.getExamById = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.student?._id || req.user?._id || req.student?.id;

    let exam = await Exam.findOne({ examId }).lean();
    if (!exam) {
      await seedDefaultExams();
      exam = await Exam.findOne({ examId }).lean();
    }

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: `Current official information for examination '${examId}' could not be verified.`
      });
    }

    // Dynamic Status and Profile Evaluation
    const computedStatus = calculateDynamicStatus(exam);
    let profile = null;
    if (userId) {
      profile = await GraduateProfile.findOne({ userId }).lean();
    }
    const evalResult = evaluateExamMatchAndEligibility(profile, exam);

    const enrichedExam = {
      ...exam,
      status: computedStatus,
      matchScore: evalResult.matchScore,
      eligibilityStatus: evalResult.eligibilityStatus,
      eligibilityBadgeText: evalResult.eligibilityBadgeText
    };

    // Fetch student's existing study plan if logged in
    let userStudyPlan = null;
    if (userId) {
      userStudyPlan = await ExamStudyPlan.findOne({ userId, examId }).lean();
    }

    res.status(200).json({
      success: true,
      exam: enrichedExam,
      userStudyPlan
    });
  } catch (error) {
    console.error("Get exam by id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch examination details" });
  }
};

// ── GET /api/graduate/exams/:examId/pattern ────────────────────────────────
exports.getExamPattern = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ examId }, "name shortName stages examPatternUrl sourceConfidence").lean();
    if (!exam) return res.status(404).json({ success: false, message: "Exam pattern not found" });

    res.status(200).json({ success: true, pattern: exam.stages, examPatternUrl: exam.examPatternUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch exam pattern" });
  }
};

// ── GET /api/graduate/exams/:examId/syllabus ───────────────────────────────
exports.getExamSyllabus = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ examId }).lean();
    if (!exam) return res.status(404).json({ success: false, message: "Exam syllabus not found" });

    res.status(200).json({ success: true, stages: exam.stages, syllabusUrl: exam.syllabusUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch exam syllabus" });
  }
};

// ── GET /api/graduate/exams/:examId/papers ─────────────────────────────────
exports.getExamPapers = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ examId }, "name shortName previousPapers").lean();
    if (!exam) return res.status(404).json({ success: false, message: "Exam papers not found" });

    res.status(200).json({
      success: true,
      previousPapers: exam.previousPapers || [],
      message: exam.previousPapers?.length ? undefined : "No verified previous papers available."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch previous papers" });
  }
};

// ── POST /api/graduate/exams/:examId/research ──────────────────────────────
exports.researchExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ examId });
    const query = exam ? `${exam.name} ${exam.shortName}` : examId;

    const researchResult = await triggerTavilyExamResearch(query);

    if (exam) {
      exam.lastVerifiedAt = new Date();
      await exam.save();
    }

    res.status(200).json({
      success: true,
      message: "Exam research refreshed",
      researchResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to research exam" });
  }
};

// ── GET & POST /api/graduate/exams/:examId/study-plan ──────────────────────
exports.getStudyPlan = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { examId } = req.params;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    let plan = await ExamStudyPlan.findOne({ userId, examId }).lean();
    if (!plan) {
      const exam = await Exam.findOne({ examId }).lean();
      if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

      const generated = generatePersonalizedStudyPlan({ exam, hoursPerDay: 2 });
      plan = new ExamStudyPlan({
        userId,
        examId,
        hoursPerDay: 2,
        studentLevel: "Intermediate",
        readinessScore: 0,
        readinessStatus: "Getting Started",
        phases: generated.phases,
        dailySchedule: generated.dailySchedule,
        weakTopics: generated.weakTopics,
        strongTopics: generated.strongTopics
      });
      await plan.save();
      plan = plan.toObject();
    }

    res.status(200).json({ success: true, plan });
  } catch (error) {
    console.error("Get study plan error:", error);
    res.status(500).json({ success: false, message: "Failed to load study plan" });
  }
};

exports.createOrUpdateStudyPlan = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { examId } = req.params;
    const { hoursPerDay, studentLevel, targetExamDate } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const exam = await Exam.findOne({ examId }).lean();
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    let plan = await ExamStudyPlan.findOne({ userId, examId });
    const hours = Math.max(1, Math.min(8, Number(hoursPerDay || plan?.hoursPerDay || 2)));
    const level = studentLevel || plan?.studentLevel || "Intermediate";

    const topicMasteryMap = {};
    if (plan && plan.topicMastery) {
      plan.topicMastery.forEach(tm => {
        topicMasteryMap[tm.topicId] = tm;
      });
    }

    const generated = generatePersonalizedStudyPlan({
      exam,
      hoursPerDay: hours,
      studentLevel: level,
      targetDate: targetExamDate,
      topicMasteryMap
    });

    if (!plan) {
      plan = new ExamStudyPlan({
        userId,
        examId,
        targetExamDate,
        hoursPerDay: hours,
        studentLevel: level,
        phases: generated.phases,
        dailySchedule: generated.dailySchedule,
        weakTopics: generated.weakTopics,
        strongTopics: generated.strongTopics
      });
    } else {
      plan.hoursPerDay = hours;
      plan.studentLevel = level;
      if (targetExamDate) plan.targetExamDate = targetExamDate;
      plan.phases = generated.phases;
      plan.dailySchedule = generated.dailySchedule;
      plan.weakTopics = generated.weakTopics;
      plan.strongTopics = generated.strongTopics;
    }

    await plan.save();

    res.status(200).json({ success: true, message: "Personalized study plan created", plan });
  } catch (error) {
    console.error("Create study plan error:", error);
    res.status(500).json({ success: false, message: "Failed to save study plan" });
  }
};

// ── GET /api/graduate/exams/:examId/progress ──────────────────────────────
exports.getExamProgress = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { examId } = req.params;

    let plan = await ExamStudyPlan.findOne({ userId, examId }).lean();
    if (!plan) {
      return res.status(200).json({
        success: true,
        readinessScore: 0,
        readinessStatus: "Getting Started",
        syllabusCompletion: 0,
        topicMastery: [],
        weakTopics: [],
        strongTopics: []
      });
    }

    const readiness = calculateExamReadiness({
      syllabusCompletion: plan.syllabusCompletion || 0,
      topicMastery: plan.topicMastery?.reduce((acc, t) => acc + t.masteryScore, 0) / (plan.topicMastery?.length || 1),
      practiceAccuracy: plan.topicMastery?.reduce((acc, t) => acc + t.accuracy, 0) / (plan.topicMastery?.length || 1),
      mockPerformance: plan.mockTestHistory?.length ? (plan.mockTestHistory.reduce((acc, m) => acc + m.percentage, 0) / plan.mockTestHistory.length) : 0,
      consistency: 75
    });

    res.status(200).json({
      success: true,
      readinessScore: readiness.readinessScore,
      readinessStatus: readiness.readinessStatus,
      disclaimer: readiness.disclaimer,
      syllabusCompletion: plan.syllabusCompletion || 0,
      topicMastery: plan.topicMastery || [],
      weakTopics: plan.weakTopics || [],
      strongTopics: plan.strongTopics || [],
      mockTestHistory: plan.mockTestHistory || []
    });
  } catch (error) {
    console.error("Get exam progress error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch exam progress" });
  }
};

// ── POST /api/graduate/exams/:examId/topic/:topicId/progress ──────────────
exports.recordTopicProgress = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { examId, topicId } = req.params;
    const { questionsAttempted, correctAnswers, topicName, sectionId } = req.body;

    let plan = await ExamStudyPlan.findOne({ userId, examId });
    if (!plan) {
      plan = new ExamStudyPlan({ userId, examId });
    }

    const attempted = Number(questionsAttempted || 0);
    const correct = Number(correctAnswers || 0);
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const masteryScore = Math.round(0.50 * accuracy + 0.20 * 70 + 0.30 * 70);

    let status = "PRACTICE";
    if (masteryScore < 50) status = "REINFORCE";
    else if (masteryScore < 75) status = "PRACTICE";
    else if (masteryScore < 90) status = "ADVANCE";
    else status = "MASTERED";

    let tm = plan.topicMastery.find(t => t.topicId === topicId);
    if (!tm) {
      plan.topicMastery.push({
        topicId,
        topicName: topicName || topicId,
        sectionId: sectionId || "",
        questionsAttempted: attempted,
        correctAnswers: correct,
        accuracy,
        masteryScore,
        status,
        lastPracticedAt: new Date()
      });
    } else {
      tm.questionsAttempted += attempted;
      tm.correctAnswers += correct;
      tm.accuracy = Math.round((tm.correctAnswers / tm.questionsAttempted) * 100);
      tm.masteryScore = Math.round(0.50 * tm.accuracy + 0.20 * 70 + 0.30 * 70);
      if (tm.masteryScore < 50) tm.status = "REINFORCE";
      else if (tm.masteryScore < 75) tm.status = "PRACTICE";
      else if (tm.masteryScore < 90) tm.status = "ADVANCE";
      else tm.status = "MASTERED";
      tm.lastPracticedAt = new Date();
    }

    plan.weakTopics = plan.topicMastery.filter(t => t.status === "REINFORCE").map(t => t.topicName);
    plan.strongTopics = plan.topicMastery.filter(t => t.status === "MASTERED").map(t => t.topicName);

    const totalMastery = plan.topicMastery.reduce((acc, t) => acc + t.masteryScore, 0);
    const avgMastery = plan.topicMastery.length > 0 ? Math.round(totalMastery / plan.topicMastery.length) : 0;
    plan.syllabusCompletion = Math.min(100, Math.round((plan.topicMastery.length / 15) * 100));

    const readiness = calculateExamReadiness({
      syllabusCompletion: plan.syllabusCompletion,
      topicMastery: avgMastery,
      practiceAccuracy: accuracy,
      mockPerformance: 0,
      consistency: 70
    });

    plan.readinessScore = readiness.readinessScore;
    plan.readinessStatus = readiness.readinessStatus;

    await plan.save();

    res.status(200).json({
      success: true,
      message: `Progress recorded for ${topicId}`,
      topicMastery: plan.topicMastery,
      readinessScore: plan.readinessScore,
      readinessStatus: plan.readinessStatus,
      weakTopics: plan.weakTopics,
      strongTopics: plan.strongTopics
    });
  } catch (error) {
    console.error("Record topic progress error:", error);
    res.status(500).json({ success: false, message: "Failed to record topic progress" });
  }
};

// ── POST /api/graduate/exams/:examId/mock/submit ───────────────────────────
exports.submitMockTest = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { examId } = req.params;
    const { mockId, mockTitle, mockType, score, totalMarks, timeTakenMinutes } = req.body;

    let plan = await ExamStudyPlan.findOne({ userId, examId });
    if (!plan) plan = new ExamStudyPlan({ userId, examId });

    const total = Number(totalMarks || 100);
    const scored = Number(score || 0);
    const percentage = total > 0 ? Math.round((scored / total) * 100) : 0;

    plan.mockTestHistory.push({
      mockId: mockId || `mock_${Date.now()}`,
      mockTitle: mockTitle || "Sectional Practice Mock",
      mockType: mockType || "FULL_MOCK",
      score: scored,
      totalMarks: total,
      percentage,
      accuracy: percentage,
      timeTakenMinutes: Number(timeTakenMinutes || 30),
      attemptedAt: new Date()
    });

    const avgMockPct = Math.round(plan.mockTestHistory.reduce((acc, m) => acc + m.percentage, 0) / plan.mockTestHistory.length);
    const readiness = calculateExamReadiness({
      syllabusCompletion: plan.syllabusCompletion || 20,
      topicMastery: 50,
      practiceAccuracy: avgMockPct,
      mockPerformance: avgMockPct,
      consistency: 80
    });

    plan.readinessScore = readiness.readinessScore;
    plan.readinessStatus = readiness.readinessStatus;

    await plan.save();

    res.status(200).json({
      success: true,
      message: "Mock test attempt submitted successfully",
      percentage,
      readinessScore: plan.readinessScore,
      readinessStatus: plan.readinessStatus,
      mockTestHistory: plan.mockTestHistory
    });
  } catch (error) {
    console.error("Submit mock test error:", error);
    res.status(500).json({ success: false, message: "Failed to submit mock test" });
  }
};
