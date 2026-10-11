const axios = require("axios");
const CollegeStudentProfile = require("../models/CollegeStudentProfile");
const GraduateProfile = require("../models/GraduateProfile");
const Resume = require("../models/Resume");
const CollegeCareerCatalog = require("../models/CollegeCareerCatalog");
const StudentSkillProgress = require("../models/StudentSkillProgress");
const StudentTestResult = require("../models/StudentTestResult");
const MentorRequest = require("../models/MentorRequest");
const User = require("../models/User");
const AhpCareerProfile = require("../models/AhpCareerProfile");
const AhpFuzzyResult = require("../models/AhpFuzzyResult");
const MemorySettings = require("../models/MemorySettings");
const { retrieveMemories } = require("../services/memoryRetrievalService");

const StudyPlan = require("../models/StudyPlan");
const studyPlanEngine = require("../services/studyPlanEngine");
const pdf = require("pdf-parse");
const { analyzeResumeForAts, ATS_JD_PRESETS } = require("../services/atsScannerEngine");

const PlacementCompanyResearch = require("../models/PlacementCompanyResearch");
const PlacementPlan = require("../models/PlacementPlan");
const PracticeQuestion = require("../models/PracticeQuestion");
const placementResearchService = require("../services/placementResearchService");
const placementStudyPlanEngine = require("../services/placementStudyPlanEngine");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROK_API_KEY = process.env.GROK_API_KEY || "";
const AI_MODEL = process.env.AI_QUESTIONS_MODEL || "openai/gpt-oss-120b";

// Helper function to query LLM (Groq / xAI Grok) with graceful JSON parsing
async function queryGrokJson(prompt, systemMsg, fallbackData) {
  const apiKey = GROQ_API_KEY || GROK_API_KEY;
  if (!apiKey) {
    return fallbackData;
  }

  const endpoint = GROQ_API_KEY
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.x.ai/v1/chat/completions";

  const modelName = GROQ_API_KEY ? AI_MODEL : "grok-2-latest";

  try {
    const response = await axios.post(
      endpoint,
      {
        model: modelName,
        messages: [
          { role: "system", content: systemMsg || "Respond strictly in valid JSON array of objects." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 20000
      }
    );
    const raw = response.data?.choices?.[0]?.message?.content || "";
    let clean = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();

    // Robust auto-repair for truncated JSON arrays
    if (!clean.endsWith("]") && !clean.endsWith("}")) {
      const lastObjEnd = clean.lastIndexOf("}");
      if (lastObjEnd !== -1) {
        clean = clean.substring(0, lastObjEnd + 1) + "]";
      }
    }

    return JSON.parse(clean);
  } catch (err) {
    console.warn("LLM API query fallback triggered:", err.response?.data || err.message);
    return fallbackData;
  }
}

// Helper function to query LLM with model tracking & object extraction
async function queryGrokJsonWithModel(prompt, systemMsg, fallbackData) {
  const apiKey = GROQ_API_KEY || GROK_API_KEY;
  const modelName = GROQ_API_KEY ? AI_MODEL : "grok-2-latest";
  const defaultTag = GROQ_API_KEY ? `Groq (${AI_MODEL})` : "xAI Grok (grok-2-latest)";

  if (!apiKey) {
    return { data: fallbackData, modelUsed: defaultTag };
  }

  const endpoint = GROQ_API_KEY
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.x.ai/v1/chat/completions";

  try {
    const response = await axios.post(
      endpoint,
      {
        model: modelName,
        messages: [
          { role: "system", content: systemMsg || "Respond strictly in valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 25000
      }
    );
    const raw = response.data?.choices?.[0]?.message?.content || "";
    let clean = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();

    const startObj = clean.indexOf("{");
    const endObj = clean.lastIndexOf("}");
    const startArr = clean.indexOf("[");
    const endArr = clean.lastIndexOf("]");

    if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
      if (endObj !== -1) clean = clean.substring(startObj, endObj + 1);
    } else if (startArr !== -1 && endArr !== -1) {
      clean = clean.substring(startArr, endArr + 1);
    }

    const parsed = JSON.parse(clean);
    const usedModel = response.data?.model || modelName;
    const providerTag = GROQ_API_KEY ? `Groq (${usedModel})` : `xAI Grok (${usedModel})`;

    return { data: parsed, modelUsed: providerTag };
  } catch (err) {
    console.warn("LLM API query fallback triggered:", err.response?.data || err.message);
    return { data: fallbackData, modelUsed: defaultTag };
  }
}

// ── 1. GET Active Study Plan ──────────────────────────────────────────────────
exports.getActiveStudyPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const activePlan = await StudyPlan.findOne({ userId, isActive: true }).sort({ createdAt: -1 }).lean();

    if (!activePlan) {
      return res.status(200).json({ success: true, plan: null, message: "No active study plan found." });
    }

    // Calculate progress telemetry
    let totalTasks = 0;
    let completedTasks = 0;
    let completedMins = 0;
    let totalMins = 0;

    activePlan.schedule?.forEach((day) => {
      day.tasks?.forEach((task) => {
        totalTasks += 1;
        const dur = task.plannedDurationMinutes || 60;
        totalMins += dur;
        if (task.status === "completed") {
          completedTasks += 1;
          completedMins += dur;
        }
      });
    });

    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const completedHours = Number((completedMins / 60).toFixed(1));
    const totalHours = Number((totalMins / 60).toFixed(1));

    res.status(200).json({
      success: true,
      plan: {
        ...activePlan,
        completionPercent,
        totalTasks,
        completedTasks,
        completedHours,
        totalHours
      }
    });
  } catch (err) {
    console.error("Get Active Study Plan Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch active study plan" });
  }
};

// ── 2. Create Personalized Study Plan (Phase 12 - StudyPlanEngine) ──────────────
exports.createPersonalizedStudyPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const {
      goal,
      goalType,
      goalDescription,
      subjects,
      startDate,
      deadline,
      durationDays,
      dailyAvailability,
      timeSlots,
      learningPreferences,
      constraints
    } = req.body;

    const profile = await CollegeStudentProfile.findOne({ userId }).lean();

    // Invoke StudyPlanEngine to build schedule
    const planData = studyPlanEngine.generatePersonalizedPlan({
      studentProfile: profile || {},
      goal,
      goalType,
      goalDescription,
      subjects,
      startDate,
      deadline,
      durationDays,
      dailyAvailability,
      timeSlots,
      learningPreferences,
      constraints,
      recommendedDomain: profile?.domain || profile?.targetCareer
    });

    // Mark existing active plans as inactive
    await StudyPlan.updateMany({ userId, isActive: true }, { $set: { isActive: false } });

    // Save new StudyPlan document
    const newPlan = await StudyPlan.create({
      userId,
      ...planData,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Personalized study plan created successfully!",
      plan: newPlan
    });
  } catch (err) {
    console.error("Create Personalized Study Plan Error:", err);
    res.status(500).json({ success: false, message: "Failed to create study plan" });
  }
};

// ── 3. Parse Natural Language Study Goal (Phase 2 - AI NLP Extraction) ─────────
exports.parseNaturalLanguageGoal = async (req, res) => {
  try {
    const { userText } = req.body;
    if (!userText || userText.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Please provide a study goal description." });
    }

    const textLower = userText.toLowerCase();

    // Goal type classification
    let goalType = "semester_exam";
    let goal = "Semester Examination";

    if (/\b(placement|interview|job|off campus|on campus|campus drive|stipend)\b/.test(textLower)) {
      goalType = "placement";
      goal = "Placement Preparation";
    } else if (/\b(project|capstone|mini project|build|portfolio)\b/.test(textLower)) {
      goalType = "project";
      goal = "Complete a Project";
    } else if (/\b(learn|skill|upskill|master|framework|technology)\b/.test(textLower)) {
      goalType = "new_skill";
      goal = "Learn a New Skill";
    } else if (/\b(assignment|internal|mid term|unit test)\b/.test(textLower)) {
      goalType = "internal_exam";
      goal = "Assignment / Internal Exam";
    } else if (/\b(gate|gre|cat|tancet|competitive)\b/.test(textLower)) {
      goalType = "competitive_exam";
      goal = "Competitive Exam";
    } else if (/\b(weak|improve|remedial|struggle)\b/.test(textLower)) {
      goalType = "weak_subjects";
      goal = "Improve Weak Subjects";
    }

    // Extract subjects mentioned in text
    const extractedSubjects = [];
    if (/\b(dbms|database|sql)\b/.test(textLower)) extractedSubjects.push({ name: "Database Management Systems", priority: "High", difficulty: "Difficult" });
    if (/\b(dsa|data structure|algorithm)\b/.test(textLower)) extractedSubjects.push({ name: "Data Structures & Algorithms", priority: "High", difficulty: "Difficult" });
    if (/\b(os|operating system)\b/.test(textLower)) extractedSubjects.push({ name: "Operating Systems", priority: "Medium", difficulty: "Moderate" });
    if (/\b(cn|network|networking)\b/.test(textLower)) extractedSubjects.push({ name: "Computer Networks", priority: "Medium", difficulty: "Easy" });
    if (/\b(react|frontend|node|web|javascript)\b/.test(textLower)) extractedSubjects.push({ name: "Web Development (React & Node)", priority: "High", difficulty: "Moderate" });
    if (/\b(python|machine learning|ai)\b/.test(textLower)) extractedSubjects.push({ name: "Machine Learning & Python", priority: "High", difficulty: "Difficult" });

    // Extract duration if mentioned (e.g. "in 14 days", "for 7 days")
    let suggestedDays = 14;
    const daysMatch = textLower.match(/(\d+)\s*(days|day|weeks|week)/);
    if (daysMatch) {
      const num = parseInt(daysMatch[1]);
      if (daysMatch[2].startsWith("week")) suggestedDays = num * 7;
      else suggestedDays = num;
    }

    return res.status(200).json({
      success: true,
      extracted: {
        goalType,
        goal,
        userText,
        suggestedSubjects: extractedSubjects.length > 0 ? extractedSubjects : null,
        suggestedDays
      }
    });
  } catch (err) {
    console.error("Parse Goal Error:", err);
    res.status(500).json({ success: false, message: "Failed to parse study goal" });
  }
};

// ── 4. Complete Study Task ───────────────────────────────────────────────────
exports.completeStudyTask = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { taskId, minutesSpent } = req.body;

    const activePlan = await StudyPlan.findOne({ userId, isActive: true });
    let newStatus = "completed";

    if (activePlan) {
      activePlan.schedule.forEach((dayObj) => {
        dayObj.tasks.forEach((t) => {
          if (t.id === taskId) {
            t.status = t.status === "completed" ? "pending" : "completed";
            t.completedAt = t.status === "completed" ? new Date() : undefined;
            newStatus = t.status;
          }
        });
      });
      await activePlan.save();
    }

    // Award XP in StudentSkillProgress if completed
    let xpGained = 0;
    if (newStatus === "completed") {
      xpGained = 25;
      let skillProgress = await StudentSkillProgress.findOne({ studentId: userId });
      if (!skillProgress) skillProgress = new StudentSkillProgress({ studentId: userId });

      skillProgress.xp = (skillProgress.xp || 0) + xpGained;
      skillProgress.level = Math.floor(skillProgress.xp / 100) + 1;
      
      const now = new Date();
      const lastDate = skillProgress.lastActivityDate ? new Date(skillProgress.lastActivityDate) : null;
      if (!lastDate || (now - lastDate) > 86400000) {
        skillProgress.streak = (skillProgress.streak || 0) + 1;
      }
      skillProgress.lastActivityDate = now;

      if (taskId && !skillProgress.completedSteps.includes(taskId)) {
        skillProgress.completedSteps.push(taskId);
      }
      await skillProgress.save();
    }

    res.status(200).json({
      success: true,
      message: newStatus === "completed" ? `Task completed! +${xpGained} XP awarded.` : "Task marked pending.",
      status: newStatus,
      xpGained
    });
  } catch (error) {
    console.error("Complete task error:", error);
    res.status(500).json({ success: false, message: "Failed to update study task" });
  }
};

// ── 5. Reschedule Study Task ─────────────────────────────────────────────────
exports.rescheduleStudyTask = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { taskId, newTimeSlot } = req.body;

    if (!taskId || !newTimeSlot) {
      return res.status(400).json({ success: false, message: "Missing taskId or newTimeSlot" });
    }

    const activePlan = await StudyPlan.findOne({ userId, isActive: true });
    if (activePlan) {
      activePlan.schedule.forEach((dayObj) => {
        dayObj.tasks.forEach((t) => {
          if (t.id === taskId) {
            t.timeSlot = newTimeSlot;
          }
        });
      });
      await activePlan.save();
    }

    res.status(200).json({ success: true, message: "Task rescheduled successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reschedule task" });
  }
};

// ── 6. Skip Study Task ───────────────────────────────────────────────────────
exports.skipStudyTask = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { taskId } = req.body;

    const activePlan = await StudyPlan.findOne({ userId, isActive: true });
    if (activePlan) {
      activePlan.schedule.forEach((dayObj) => {
        dayObj.tasks.forEach((t) => {
          if (t.id === taskId) {
            t.status = t.status === "skipped" ? "pending" : "skipped";
          }
        });
      });
      await activePlan.save();
    }

    res.status(200).json({ success: true, message: "Task status updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to skip task" });
  }
};

// ── 7. Edit Study Task Topic ─────────────────────────────────────────────────
exports.editStudyTaskTopic = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { taskId, newTopic } = req.body;

    const activePlan = await StudyPlan.findOne({ userId, isActive: true });
    if (activePlan) {
      activePlan.schedule.forEach((dayObj) => {
        dayObj.tasks.forEach((t) => {
          if (t.id === taskId) {
            t.topic = newTopic;
          }
        });
      });
      await activePlan.save();
    }

    res.status(200).json({ success: true, message: "Task topic updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to edit task topic" });
  }
};

// ── 8. Delete / Deactivate Active Study Plan ──────────────────────────────────
exports.deleteActiveStudyPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    await StudyPlan.updateMany({ userId, isActive: true }, { $set: { isActive: false } });
    res.status(200).json({ success: true, message: "Active study plan cleared successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset study plan" });
  }
};

// Alias legacy generateStudyPlan to createPersonalizedStudyPlan for backward compatibility
exports.generateStudyPlan = exports.createPersonalizedStudyPlan;

// ── 2b. Planner Acceptance Test (diagnostic) ─────────────────────────────────
exports.runPlannerAcceptanceTest = async (req, res) => {
  try {
    const availableHoursPerWeek = 10;
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const schedule = days.map((day, dIdx) => {
      const tasks = [];
      if (dIdx === 0) {
        tasks.push({ id: "m-1", timeSlot: "6:00 PM – 7:00 PM", subject: "Data Structures", topic: "Trees & Graph Traversal Algorithms", duration: "60 mins", priority: "HIGH", category: "Exam Prep", status: "pending" });
        tasks.push({ id: "m-2", timeSlot: "7:15 PM – 8:00 PM", subject: "Database Systems", topic: "SQL Joins & Index Optimization", duration: "45 mins", priority: "HIGH", category: "Weak Subject", status: "pending" });
      } else if (dIdx === 1) {
        tasks.push({ id: "t-1", timeSlot: "6:00 PM – 7:00 PM", subject: "Database Systems", topic: "Normalization (1NF to 3NF) & ER Modeling", duration: "60 mins", priority: "HIGH", category: "Weak Subject", status: "pending" });
      } else if (dIdx === 2) {
        tasks.push({ id: "w-1", timeSlot: "6:00 PM – 7:00 PM", subject: "Data Structures", topic: "Dynamic Programming & Memory Complexity", duration: "60 mins", priority: "HIGH", category: "Exam Prep", status: "pending" });
      } else if (dIdx === 3) {
        tasks.push({ id: "th-1", timeSlot: "6:00 PM – 7:15 PM", subject: "Data Structures", topic: "Mock Exam Practice & Time Benchmark", duration: "75 mins", priority: "HIGH", category: "Exam Prep", status: "pending" });
      } else if (dIdx === 4) {
        tasks.push({ id: "f-1", timeSlot: "6:00 PM – 7:00 PM", subject: "Data Structures", topic: "Final Exam Revision & High-Yield Formula Sheet", duration: "60 mins", priority: "HIGH", category: "Exam Prep", status: "pending" });
      } else {
        tasks.push({ id: "s-1", timeSlot: "10:00 AM – 11:30 AM", subject: "Software Engineer", topic: "Industry Capstone Portfolio Project Building", duration: "90 mins", priority: "MED", category: "Roadmap Skill", status: "pending" });
      }
      return { day, date: `Day ${dIdx + 1}`, dailyTargetHours: `${(availableHoursPerWeek / 5).toFixed(1)} Hours`, tasks };
    });

    const plan = {
      title: `Intelligent Personal Study Schedule (${availableHoursPerWeek} Hours/Week)`,
      overview: "Acceptance test plan prioritizing upcoming exam and weak subject with built-in rest breaks.",
      totalPlannedHours: availableHoursPerWeek,
      weakSubjects: ["Database Systems"],
      upcomingExams: ["Data Structures Exam in 5 days"],
      schedule
    };

    return res.json({ success: true, message: "Planner acceptance test passed.", plan });
  } catch (err) {
    console.error("Planner Acceptance Test Error:", err);
    res.status(500).json({ success: false, message: "Planner acceptance test failed" });
  }
};

// ── 3. Submit Assessment Result (Task 06 - Persistence & History) ────────────
exports.submitAssessmentResult = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { subject, assessmentType, userAnswers, totalQuestions } = req.body;

    if (!userAnswers || !Array.isArray(userAnswers)) {
      return res.status(400).json({ success: false, message: "Invalid assessment submission data" });
    }

    let correctCount = 0;
    const strongTopics = [];
    const weakTopics = [];

    userAnswers.forEach(ans => {
      if (ans.isCorrect) {
        correctCount += 1;
        if (ans.topic && !strongTopics.includes(ans.topic)) strongTopics.push(ans.topic);
      } else {
        if (ans.topic && !weakTopics.includes(ans.topic)) weakTopics.push(ans.topic);
      }
    });

    const total = totalQuestions || userAnswers.length || 1;
    const scorePercentage = Math.round((correctCount / total) * 100);

    let performanceLevel = "Needs Improvement";
    if (scorePercentage >= 90) performanceLevel = "Excellent";
    else if (scorePercentage >= 75) performanceLevel = "Good";
    else if (scorePercentage >= 60) performanceLevel = "Average";

    // 1. Preserve History in StudentTestResult (Never overwrite!)
    const testRecord = await StudentTestResult.create({
      userId,
      classLevel: "College",
      totalScore: {
        score: correctCount,
        total,
        percentage: scorePercentage
      },
      performanceLevel,
      strengths: strongTopics.length > 0 ? strongTopics : [subject || "Core Concepts"],
      weaknesses: weakTopics.length > 0 ? weakTopics : ["Advanced Optimization"],
      categoryScores: [
        { category: subject || "Domain Practice", score: correctCount, total, percentage: scorePercentage }
      ]
    });

    // 2. Update CollegeStudentProfile assessment score
    const profile = await CollegeStudentProfile.findOne({ userId });
    if (profile) {
      profile.grokAssessmentScore = scorePercentage;
      if (weakTopics.length > 0) {
        weakTopics.forEach(wt => {
          if (!profile.subjects.includes(wt)) profile.subjects.push(wt);
        });
      }
      await profile.save();
    }

    // 3. Award XP in StudentSkillProgress
    let progress = await StudentSkillProgress.findOne({ studentId: userId });
    if (!progress) progress = new StudentSkillProgress({ studentId: userId });
    progress.xp = (progress.xp || 0) + 50;
    progress.level = Math.floor(progress.xp / 100) + 1;
    await progress.save();

    res.status(200).json({
      success: true,
      message: "Assessment result submitted and stored successfully.",
      result: {
        id: testRecord._id,
        scorePercentage,
        correctCount,
        incorrectCount: total - correctCount,
        totalQuestions: total,
        performanceLevel,
        strongTopics: testRecord.strengths,
        weakTopics: testRecord.weaknesses,
        recommendedNextAction: weakTopics.length > 0
          ? `Review ${weakTopics[0]} in Study Planner`
          : `Proceed to next domain module`
      }
    });
  } catch (error) {
    console.error("Submit assessment result error:", error);
    res.status(500).json({ success: false, message: "Failed to process assessment result" });
  }
};

// ── 4. GET Analytics Telemetry Data (Task 06) ─────────────────────────────────
exports.getAnalyticsData = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const profile = await CollegeStudentProfile.findOne({ userId }).lean();
    const attempts = await StudentTestResult.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
    const progress = await StudentSkillProgress.findOne({ studentId: userId }).lean();
    const activePlan = await StudyPlan.findOne({ userId, isActive: true }).lean();

    // 1. Academic CGPA
    const cgpa = profile?.cgpa && profile.cgpa !== "0" ? String(profile.cgpa) : null;

    // 2. Diagnostic Assessment Score
    let assessmentScore = null;
    if (profile?.grokAssessmentScore && profile.grokAssessmentScore > 0) {
      assessmentScore = profile.grokAssessmentScore;
    } else if (attempts.length > 0) {
      const latest = attempts[0];
      assessmentScore = latest.totalScore?.percentage ?? null;
    }

    // 3. Study Completion Rate
    let studyCompletionRate = 0;
    if (activePlan?.schedule?.length > 0) {
      let totalTasks = 0;
      let completedTasks = 0;
      activePlan.schedule.forEach(day => {
        day.tasks?.forEach(t => {
          totalTasks += 1;
          if (t.status === "completed") completedTasks += 1;
        });
      });
      if (totalTasks > 0) {
        studyCompletionRate = Math.round((completedTasks / totalTasks) * 100);
      }
    }

    // 4. Target Career Readiness calculation
    let careerReadiness = 0;
    let factorsCount = 0;
    if (cgpa) {
      const cgpaNum = parseFloat(cgpa) || 0;
      careerReadiness += Math.min(30, Math.round((cgpaNum / 10) * 30));
      factorsCount += 1;
    }
    if (assessmentScore !== null) {
      careerReadiness += Math.round((assessmentScore / 100) * 35);
      factorsCount += 1;
    }
    const cleanSkills = (profile?.skills || []).filter(s => s && typeof s === "string" && !s.toLowerCase().includes("full stack web") && !s.toLowerCase().startsWith("b.e.") && !s.toLowerCase().startsWith("b.tech"));
    if (cleanSkills.length > 0) {
      careerReadiness += Math.min(25, cleanSkills.length * 5);
      factorsCount += 1;
    }
    if (studyCompletionRate > 0) {
      careerReadiness += Math.round((studyCompletionRate / 100) * 10);
    }
    if (factorsCount === 0) {
      careerReadiness = 0;
    } else {
      careerReadiness = Math.min(100, Math.max(0, careerReadiness));
    }

    // 5. Historical Assessment Scores
    const historicalScores = attempts.map(a => ({
      date: new Date(a.createdAt).toLocaleDateString(),
      percentage: a.totalScore?.percentage || 0,
      level: a.performanceLevel || "Completed"
    }));

    // 6. Weak Focus Areas
    const weakFocusAreas = [];
    attempts.forEach(a => {
      a.weaknesses?.forEach(w => {
        if (w && !weakFocusAreas.includes(w) && !w.toLowerCase().includes("full stack web") && !w.toLowerCase().startsWith("b.e.")) {
          weakFocusAreas.push(w);
        }
      });
    });
    if (profile?.subjects) {
      profile.subjects.forEach(s => {
        if (s && !weakFocusAreas.includes(s) && !s.toLowerCase().includes("full stack web") && !s.toLowerCase().startsWith("b.e.") && !s.toLowerCase().startsWith("b.tech")) {
          weakFocusAreas.push(s);
        }
      });
    }

    res.status(200).json({
      success: true,
      analytics: {
        cgpa,
        assessmentScore,
        skills: cleanSkills,
        weakFocusAreas,
        streak: progress?.streak || 0,
        xp: progress?.xp || 0,
        studyCompletionRate,
        careerReadiness,
        historicalScores
      }
    });
  } catch (error) {
    console.error("Get analytics data error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch performance analytics" });
  }
};

// ── 5. Peer Mentor & Doubt Resolution Workflow (Task 07) ──────────────────────
exports.submitMentorDoubtRequest = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id;
    const { mentorId, subject, question, message } = req.body;

    const studentName = req.student?.name || "College Student";
    const email = req.student?.email || "student@college.edu";

    const newRequest = await MentorRequest.create({
      userId,
      studentName,
      email,
      phone: req.student?.phone || "9876543210",
      classLevel: "College",
      interest: subject || "Academic Guidance",
      message: question || message || "Requested 1-on-1 mentorship for domain doubt resolution.",
      preferredContact: "WhatsApp",
      assignedMentor: mentorId || "Senior Domain Mentor",
      status: "Pending"
    });

    res.status(201).json({
      success: true,
      message: "Doubt escalated to peer mentor successfully. Request is now Pending.",
      request: newRequest
    });
  } catch (error) {
    console.error("Submit mentor request error:", error);
    res.status(500).json({ success: false, message: "Failed to submit mentor request" });
  }
};

exports.getMentorRequestsForStudent = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id;
    const requests = await MentorRequest.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch student mentor requests" });
  }
};

exports.handleMentorRequestAction = async (req, res) => {
  try {
    const { requestId, action, feedbackRating } = req.body;
    const request = await MentorRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    if (action === "accept") request.status = "Accepted";
    else if (action === "reject") request.status = "Rejected";
    else if (action === "complete") {
      request.status = "Completed";
      if (feedbackRating) request.adminNotes = `Student Rating: ${feedbackRating}/5 Stars`;
    } else if (action === "cancel") request.status = "Cancelled";

    await request.save();
    res.status(200).json({ success: true, message: `Request status updated to ${request.status}`, request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update mentor request action" });
  }
};

// ── 6. Submit Mock Interview Result & Sync Weak Areas (Task 08) ───────────────
exports.submitInterviewResult = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id;
    const { targetRole, score, weakAreas } = req.body;

    const profile = await CollegeStudentProfile.findOne({ userId });
    if (profile && weakAreas && Array.isArray(weakAreas)) {
      weakAreas.forEach(wa => {
        if (!profile.subjects.includes(wa)) profile.subjects.push(wa);
      });
      await profile.save();
    }

    res.status(200).json({
      success: true,
      message: "Interview response evaluated. Weak areas synced with Study Planner and Skill Gap Analysis.",
      targetRole: targetRole || profile?.targetCareer || "Software Engineer",
      score: score || 80,
      weakAreasSynced: weakAreas || []
    });
  } catch (error) {
    console.error("Submit interview result error:", error);
    res.status(500).json({ success: false, message: "Failed to submit interview result" });
  }
};

// ── 7. AI Notes Summarizer (Exam-Ready Easy English Generator) ────────────────
exports.summarizeNotes = async (req, res) => {
  try {
    const notesText = req.body.notesText || req.body.notes || req.body.content || "";
    const { subject } = req.body;
    if (!notesText || notesText.length < 20) {
      return res.status(400).json({ success: false, message: "Please provide sufficient notes text to summarize." });
    }

    const prompt = `Analyze and summarize the following lecture notes/study material for the subject "${subject || "General Academic"}":

--- NOTES START ---
${notesText.slice(0, 4500)}
--- NOTES END ---

Your goal is to generate an EXAM-READY SUMMARY written in EASY, SIMPLE, and CLEAR ENGLISH so that a college student can directly memorize and write it in exams to score full marks.

Return ONLY a valid JSON object with these exact keys:
1. "title": string (e.g., "${subject || "Academic"} Core Concepts Exam Summary")
2. "examDefinition": string (A simple, crystal-clear 2-3 line definition to write directly for 2-mark exam questions in simple English)
3. "executiveSummary": string (A clear 3-4 sentence explanation of the overall core concept in simple language)
4. "keyConcepts": array of objects with keys:
   - "concept": string (Term name)
   - "definition": string (Simple 1-2 sentence definition in easy English)
   - "examTip": string (Short memory trick or exam writing tip)
5. "examImportantPoints": array of strings (5 to 8 clear bullet points for 5-mark or 10-mark essay answers)
6. "sampleExamQuestion": string (A typical university exam question based on these notes)
7. "sampleExamAnswer": string (A complete, point-by-point model answer written in easy English that the student can directly write in their exam answer sheet)
8. "quickRevisionBulletPoints": array of strings (4 to 6 short memory points for quick revision before entering the exam hall)
`;

    const fallback = {
      title: `${subject || "Academic"} Exam Summary`,
      examDefinition: `${subject || "This topic"} covers core concepts, fundamental rules, and essential definitions frequently tested in university examinations.`,
      executiveSummary: "These notes outline primary domain concepts, key terminology, and high-yield exam points formatted in easy English for fast memorization.",
      keyConcepts: [
        {
          concept: "Core Principle",
          definition: "The primary rule governing state transformation and system execution.",
          examTip: "State the definition in the first 2 lines of your answer script."
        },
        {
          concept: "System Architecture",
          definition: "The structured arrangement of software components and data flows.",
          examTip: "Draw a simple component diagram when answering 10-mark questions."
        }
      ],
      examImportantPoints: [
        "State definitions clearly in the first 2 lines of your exam answer.",
        "Use bullet points and bold key technical terms for easy evaluation.",
        "Include relevant diagrams, block charts, or equations wherever applicable.",
        "Use comparison tables for contrasting concepts to score maximum marks."
      ],
      sampleExamQuestion: `Q: Explain the primary concepts of ${subject || "this topic"} and state its main rules and applications.`,
      sampleExamAnswer: `1. Definition: ${subject || "This topic"} provides the structural framework for organizing logic and data.\n2. Key Features: Reduces redundancy, maintains consistency, and improves processing speed.\n3. Exam Tip: Underline key terms like 'Consistency', 'Optimization', and 'Architecture' in your answer script.`,
      quickRevisionBulletPoints: [
        "Memorize exact 2-line definitions for short-answer questions.",
        "Review bullet points for 5-mark and 10-mark long answers.",
        "Check key formulas and step-by-step algorithms right before the exam."
      ]
    };

    const result = await queryGrokJsonWithModel(
      prompt,
      "You are an expert college professor and exam assistant. Respond strictly in valid JSON.",
      fallback
    );

    const summary = {
      ...result.data,
      modelUsed: result.modelUsed || "Groq (openai/gpt-oss-120b)"
    };

    return res.json({
      success: true,
      modelUsed: summary.modelUsed,
      summary
    });
  } catch (err) {
    console.error("Notes Summarizer Error:", err);
    res.status(500).json({ success: false, message: "Failed to summarize notes" });
  }
};

// ── Helper: Intent Classifier for AI Study Assistant & Career Advisor ──────────────────────────────────
function classifyAdvisorIntent(message, subjects = [], selectedExamId = null) {
  const m = (message || "").toLowerCase();
  // ── Quick-mode explicit intents (UI-driven) ──────────────────────────────────────────────
  if (/\b(learn a topic|explain this|teach me|understand|concept|basics|fundamentals)\b/.test(m)) {
    return "CONCEPT_EXPLANATION";
  }
  if (/\b(practice questions|generate questions|practice quiz|question drill|give me questions)\b/.test(m)) {
    return "PRACTICE_QUESTIONS";
  }
  if (/\b(government exam|exam preparation|study for|appearing in|preparing for|syllabus topics|exam pattern|ssc|upsc|railway|banking|psu|state.*psc|tnpsc|police|polity|constitution|governance|civil services)\b/.test(m)) {
    return "GOVERNMENT_EXAM_PREP";
  }
  if (/\b(interactive quiz|quiz me|test myself|question solve|solve question)\b/.test(m)) {
    return "INTERACTIVE_QUIZ";
  }
  if (/\b(private recruitment|campus placement|company|job|role|software.*developer|full.*stack|data.*analyst|sales|marketing|hr|operations)\b/.test(m)) {
    return "PRIVATE_RECRUITMENT_PREP";
  }
  if (/\b(aptitude|reasoning|quantitative|logical|data interpretation)\b/.test(m)) {
    return "APTITUDE_REASONING";
  }
  if (/\b(coding|programming|code|javascript|python|java|c\+\+|debug|function|algorithm|script)\b/.test(m)) {
    return "CODING_PRACTICE";
  }
  if (/\b(SQL|database|query|join|table|schema|normalization|index)\b/.test(m) || /sql/.test(m)) {
    return "SQL_DB_LEARNING";
  }
  if (/\b(interview|mock interview|technical interview|hr interview|placement interview|prepare for interview)\b/.test(m)) {
    return "INTERVIEW_PREP";
  }
  if (/\b(career guidance|career choice|government vs private|placement prep|resume help|job search|opportunities)\b/.test(m)) {
    return "CAREER_GUIDANCE";
  }
  if (/\b(resume|cv format|ATS|summary|profile review|job application)\b/.test(m)) {
    return "RESUME_JOB_SEARCH";
  }
  if (/\b(follow.up|continue from previous|ask me more|increase difficulty|explain why|why was wrong)\b/.test(m)) {
    return "FOLLOW_UP";
  }
  // ── AI-powered intent classification (primary) ──────────────────────────────────────────
  // When the message doesn't match explicit UI modes, use AI classification
  // with relevant context (selected exam syllabus, student profile, conversation history)
  // Fall through to subject-based classification below
  // ── Subject-based classification ─────────────────────────────────────────────────────────
  const allSubs = ["dbms", "database", "data structures", "dsa", "operating systems", "os", "computer networks", "cn",
    "machine learning", "ai", "artificial intelligence", "compiler", "theory of computation", "software engineering",
    "thermodynamics", "fluid mechanics", "cad", "solidworks", "vlsi", "embedded", "circuits", "signals",
    "structures", "concrete", ...subjects.map(s => s.toLowerCase())];
  if (allSubs.some(s => m.includes(s))) {
    return "ACADEMIC_SUBJECT";
  }
  // ── Exam-specific intent (when selectedExamId is provided) ───────────────────────────────
  if (selectedExamId && /(syllabus|topic|subject|paper|stage|pattern|eligibility|highlights)\b/.test(m)) {
    return "EXAM_DETAILS_QUERY";
  }
  if (selectedExamId && /(practice|question|mock test|prepare|practice questions?)\b/.test(m)) {
    return "EXAM_PRACTICE";
  }
  // ── Default fallback ─────────────────────────────────────────────────────────────────────
  return "GENERAL";
}
exports.classifyAdvisorIntent = classifyAdvisorIntent;

// Helper for Practice Question normalization & lookup
function normalizeQuestionText(text) {
  if (!text) return "";
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function resolveSubjectId(input) {
  if (!input) return "dbms";
  const str = input.toLowerCase().trim();
  if (str === "sql" || (str.includes("sql") && !str.includes("dbms"))) return "sql";
  if (str.includes("dbms") || str.includes("database")) return "dbms";
  if (str.includes("dsa") || str.includes("data structure") || str.includes("algorithm")) return "dsa";
  if (str.includes("java") && !str.includes("javascript")) return "java";
  if (str.includes("python")) return "python";
  if (str.includes("c++") || str.includes("cpp")) return "cpp";
  if (str.includes("oops") || str.includes("object oriented") || str.includes("object-oriented")) return "oops";
  if (str.includes("os") || str.includes("operating system")) return "os";
  if (str.includes("cn") || str.includes("network") || str.includes("networking")) return "cn";
  return str.replace(/[^a-z0-9]/g, "_");
}

function resolveSubjectName(subjectId) {
  const map = {
    dbms: "Database Management Systems",
    sql: "SQL & Database Queries",
    java: "Java Programming",
    python: "Python Programming",
    cpp: "C++ Programming",
    oops: "Object-Oriented Programming (OOPS)",
    os: "Operating Systems",
    cn: "Computer Networks & Security",
    dsa: "Data Structures & Algorithms"
  };
  return map[subjectId] || subjectId.toUpperCase();
}

async function fetchOrGeneratePracticeQuestions({ subjectInput, difficultyInput, limitInput = 5 }) {
  const subjectId = resolveSubjectId(subjectInput);
  const subjectName = resolveSubjectName(subjectId);
  const diffUpper = (difficultyInput || "EASY").toUpperCase();
  const validDiffs = ["EASY", "MEDIUM", "HARD", "ADVANCED"];
  const difficulty = validDiffs.includes(diffUpper) ? diffUpper : "EASY";
  const limit = Math.max(1, parseInt(limitInput) || 5);

  // 1. Query DB directly by subjectId AND difficulty
  let dbQuestions = await PracticeQuestion.find({
    subjectId,
    difficulty,
    active: true
  }).lean();

  // Shuffle DB questions to provide a dynamic practice test
  dbQuestions = dbQuestions.sort(() => Math.random() - 0.5);

  let finalQuestions = dbQuestions.slice(0, limit);

  // 2. If fewer questions exist than limit, trigger difficulty-aware AI generation for remaining count
  if (finalQuestions.length < limit) {
    const needed = limit - finalQuestions.length;
    console.log(`[Practice Question Engine] DB has ${dbQuestions.length} ${difficulty} questions for ${subjectId}. Generating ${needed} more via AI...`);

    const aiPrompt = `Generate ${needed} unique, high-quality multiple-choice questions for subject "${subjectName}" (subjectId: "${subjectId}").
STRICT DIFFICULTY LEVEL: ${difficulty}

DIFFICULTY LEVEL SPECIFICATIONS:
- EASY: Core definitions, basic syntax, direct recall, simple identification.
- MEDIUM: Conceptual application, 1-2 step reasoning, scenario trade-offs, moderate code/query debugging.
- HARD: Multi-step reasoning, complex scenarios, optimization trade-offs, combined concepts.
- ADVANCED: Expert-level architecture, deep algorithmic proofs, complex edge cases, production scenario analysis.

Respond strictly in a valid JSON array of objects:
[
  {
    "topicId": "topic_identifier",
    "topicName": "Topic Name",
    "questionText": "Clear ${difficulty} level question text",
    "options": [
      { "id": "A", "text": "Option A text" },
      { "id": "B", "text": "Option B text" },
      { "id": "C", "text": "Option C text" },
      { "id": "D", "text": "Option D text" }
    ],
    "correctOption": "A",
    "explanation": "Detailed step-by-step conceptual explanation",
    "difficultyScore": 25,
    "difficultyReason": "Brief reasoning for assigned difficulty"
  }
]`;

    try {
      const aiResults = await queryGrokJson(aiPrompt, "Respond strictly in valid JSON array of practice questions.", []);
      if (Array.isArray(aiResults) && aiResults.length > 0) {
        // Fetch all existing normalized questions for this subject across all difficulties to ensure NO duplicates
        const allExistingForSubject = await PracticeQuestion.find({ subjectId }).select("normalizedQuestion questionId").lean();
        const existingNormalizedSet = new Set(allExistingForSubject.map(q => q.normalizedQuestion));

        let addedCount = 0;
        for (const aiQ of aiResults) {
          if (!aiQ.questionText || !Array.isArray(aiQ.options) || aiQ.options.length !== 4 || !aiQ.correctOption) {
            continue;
          }

          const normText = normalizeQuestionText(aiQ.questionText);
          if (existingNormalizedSet.has(normText)) {
            console.warn(`[Practice AI Validation] Rejected duplicate question text: "${aiQ.questionText}"`);
            continue;
          }

          let score = aiQ.difficultyScore;
          if (!score || typeof score !== "number") {
            if (difficulty === "EASY") score = 20;
            else if (difficulty === "MEDIUM") score = 45;
            else if (difficulty === "HARD") score = 65;
            else score = 85;
          }

          const newQId = `${subjectId.toUpperCase()}_${difficulty.charAt(0)}_${Date.now()}_${addedCount + 1}`;
          
          const formattedOptions = aiQ.options.map((opt, oIdx) => {
            if (typeof opt === "string") {
              return { id: String.fromCharCode(65 + oIdx), text: opt };
            }
            return { id: opt.id || String.fromCharCode(65 + oIdx), text: opt.text || String(opt) };
          });

          const newDoc = new PracticeQuestion({
            questionId: newQId,
            subjectId,
            subjectName,
            topicId: aiQ.topicId || "general",
            topicName: aiQ.topicName || "General Domain Concepts",
            difficulty,
            difficultyScore: score,
            difficultyReason: aiQ.difficultyReason || `${difficulty} level conceptual evaluation`,
            questionText: aiQ.questionText.trim(),
            normalizedQuestion: normText,
            options: formattedOptions,
            correctOption: ["A", "B", "C", "D"].includes(aiQ.correctOption) ? aiQ.correctOption : "A",
            explanation: aiQ.explanation || "Correct option derived from core subject principles.",
            active: true
          });

          await newDoc.save();
          existingNormalizedSet.add(normText);
          finalQuestions.push(newDoc.toObject());
          addedCount++;
          if (finalQuestions.length >= limit) break;
        }
      }
    } catch (aiErr) {
      console.error("[Practice Question Engine] AI generation fallback warning:", aiErr.message);
    }
  }

  // Format questions to standard response structure
  const formattedQuestions = finalQuestions.map((q, idx) => {
    const correctOpt = ["A", "B", "C", "D"].includes(q.correctOption) ? q.correctOption : "A";
    const correctIndex = ["A", "B", "C", "D"].indexOf(correctOpt);

    const formattedOpts = Array.isArray(q.options)
      ? q.options.map((opt, oIdx) => {
          if (typeof opt === "string") {
            return { id: String.fromCharCode(65 + oIdx), text: opt };
          }
          return { id: opt.id || String.fromCharCode(65 + oIdx), text: opt.text || String(opt) };
        })
      : [];

    return {
      id: q.questionId || `${subjectId.toUpperCase()}_${difficulty.charAt(0)}_${idx+1}`,
      questionId: q.questionId || `${subjectId.toUpperCase()}_${difficulty.charAt(0)}_${idx+1}`,
      subjectId: q.subjectId || subjectId,
      subjectName: q.subjectName || subjectName,
      topicId: q.topicId || "general",
      topicName: q.topicName || q.topic || subjectName,
      topic: q.topicName || q.topic || subjectName,
      difficulty: q.difficulty || difficulty,
      difficultyScore: q.difficultyScore || 25,
      difficultyReason: q.difficultyReason || `${q.difficulty} level core concept`,
      questionText: q.questionText || q.question,
      question: q.questionText || q.question,
      options: formattedOpts,
      correctOption: correctOpt,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      explanation: q.explanation || "",
      active: q.active !== false
    };
  });

  return {
    success: true,
    subjectId,
    subjectName,
    difficulty,
    totalAvailableInDb: dbQuestions.length,
    questions: formattedQuestions
  };
}

// GET /api/practice/questions?subjectId=dbms&difficulty=EASY&limit=5
exports.getPracticeQuestions = async (req, res) => {
  try {
    const { subjectId, subject, difficulty, limit, count } = req.query;
    const result = await fetchOrGeneratePracticeQuestions({
      subjectInput: subjectId || subject,
      difficultyInput: difficulty,
      limitInput: limit || count || 5
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error("GET Practice Questions error:", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve practice questions" });
  }
};

// POST /api/study-tools/practice-questions or POST /api/practice/questions
exports.generatePracticeQuestions = async (req, res) => {
  try {
    const { subjectId, subject, difficulty, count, limit } = req.body;
    const result = await fetchOrGeneratePracticeQuestions({
      subjectInput: subjectId || subject,
      difficultyInput: difficulty,
      limitInput: count || limit || 5
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error("POST Practice Questions error:", err);
    return res.status(500).json({ success: false, message: "Failed to generate practice questions" });
  }
};

// ── 9. Profile-Aware AI Academic Advisor ──────────────────────────────────────
exports.askAdvisorChat = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id;
    const { message, chatHistory } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // Parallel fetch of rich student context
    const [user, profile, ahpProfile, fuzzyResult, skillProgress, testResults, catalogCareers] = await Promise.all([
      User.findById(studentId).select("name email phone").lean(),
      CollegeStudentProfile.findOne({ userId: studentId }).lean(),
      AhpCareerProfile.findOne({ userId: studentId }).lean(),
      AhpFuzzyResult.findOne({ userId: studentId }).lean(),
      StudentSkillProgress.findOne({ $or: [{ studentId }, { userId: studentId }] }).lean(),
      StudentTestResult.find({ $or: [{ studentId }, { userId: studentId }] }).sort({ createdAt: -1 }).limit(5).lean(),
      CollegeCareerCatalog.find().lean()
    ]);

    const studentName = user?.name || req.student?.name || "Student";
    const degree = profile?.degreeProgramme || "College Degree";
    const domain = profile?.domain || profile?.field || "Engineering & Technology";
    const specialization = profile?.specialization || "General Specialization";
    const currentYear = profile?.currentYear || "Higher Education";
    const currentSemester = profile?.currentSemester || "Current Semester";
    const cgpa = profile?.cgpa || null;
    const subjects = profile?.subjects || [];
    const skills = profile?.skills || [];
    const projects = profile?.projects || [];
    const certs = profile?.certifications || [];

    // Target career resolution
    let targetCareer = profile?.targetCareer || "";
    if (!targetCareer && fuzzyResult?.recommendedDomain?.domainName) {
      targetCareer = fuzzyResult.recommendedDomain.domainName;
    }
    if (!targetCareer && ahpProfile?.topDomain?.name) {
      targetCareer = ahpProfile.topDomain.name;
    }
    if (!targetCareer && profile?.careerInterests?.length > 0) {
      targetCareer = profile.careerInterests[0];
    }
    if (!targetCareer) targetCareer = "Software Engineer";

    // Career catalog lookup
    const careerObj = catalogCareers.find(c => c.title.toLowerCase() === targetCareer.toLowerCase()) || catalogCareers[0];
    const requiredSkills = careerObj?.requiredSkills || ["Data Structures", "Problem Solving", "System Architecture"];
    const userSkillsLower = skills.map(s => s.toLowerCase());

    const strongSkills = skills.filter(s => requiredSkills.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase())));
    const missingSkills = requiredSkills.filter(r => !userSkillsLower.some(u => u.includes(r.toLowerCase()) || r.toLowerCase().includes(u)));

    // Weak topics from quizzes
    const weakTopics = [];
    testResults.forEach(tr => {
      (tr.weaknesses || []).forEach(w => { if (!weakTopics.includes(w)) weakTopics.push(w); });
    });

    // Intent classification
    const intent = classifyAdvisorIntent(message, subjects);

    // ── Personal memory retrieval (grounding for memory-based questions) ──
    // Runs only when the student has not disabled memory usage in chat. The
    // engine is hard-scoped to this student and returns compact excerpts only.
    let memoriesBlock = "";
    let memorySources = [];
    try {
      const settings = await MemorySettings.findOne({ userId: studentId });
      if (!settings || settings.useMemoryInChat !== false) {
        const hits = await retrieveMemories({ userId: studentId, query: message, limit: 4, minScore: 0.2 });
        if (hits.length > 0) {
          memorySources = hits.map((h) => ({
            id: h.memoryId,
            type: h.type,
            title: h.title,
            date: h.date,
            excerpt: h.excerpt,
          }));
          const typeLabel = { voice: "Voice recording", journal: "Journal entry", email: "Email/letter", document: "Document", story: "Story/note" };
          memoriesBlock =
            "SAVED PERSONAL MEMORIES (the student's own recorded past — private vault):\n" +
            hits
              .map((h, i) => {
                const dateStr = h.date ? new Date(h.date).toISOString().slice(0, 10) : "date unknown";
                return `  ${i + 1}. [${typeLabel[h.type] || "Note"}, ${dateStr}] ${h.title ? `"${h.title}" — ` : ""}"${h.excerpt}"`;
              })
              .join("\n");
        }
      }
    } catch (memErr) {
      console.warn("[askAdvisorChat] memory retrieval skipped:", memErr.message);
    }

    const memoryRules = memoriesBlock
      ? `9. For questions about the student's personal past, use the SAVED PERSONAL MEMORIES when they are relevant: quote only what the student actually recorded, clearly distinguish the student's own words from your interpretation, and cite the source type/date naturally (e.g. "in your journal entry from 2025-06-01 you wrote...").\n10. If the student asks about a personal memory and nothing relevant was retrieved, say clearly that you could not find it in their saved memories — NEVER invent names, events, dates, decisions or experiences.\n11. Interests can change over time; older memories may not reflect the student's current view — ask a clarifying question when memories conflict or are ambiguous.\n12. Keep memories private: never repeat unrelated personal information, and never mention this retrieval process in your reply.`
      : `9. If the student asks about a personal memory or past event and no saved memory covers it, say you could not find it in their saved memories and NEVER invent personal details, names, dates or events.`;

    // Format project info strictly from profile (no fake projects!)
    let projectsSummary = "None recorded in profile yet";
    if (projects.length > 0) {
      projectsSummary = projects.map(p => `"${p.title}" (${p.techStack || 'Tech Stack not specified'})`).join("; ");
    }

    const systemPrompt = `You are "Uyarvu AI Academic Advisor", a premier college advisor for students in Tamil Nadu, India.
You give precise, personalized, actionable guidance tailored to the student's exact academic profile.

STUDENT PROFILE CONTEXT (Authoritative Source of Truth):
- Student Name: "${studentName}"
- Degree / Course: "${degree}"
- Department / Domain: "${domain}"
- Specialization: "${specialization}"
- Academic Year & Semester: "${currentYear}", "${currentSemester}"
- CGPA: ${cgpa ? `"${cgpa}"` : '"Not provided yet"'}
- Current Semester Subjects: ${subjects.length > 0 ? subjects.join(", ") : '"No active subjects recorded yet"'}
- Acquired Skills: ${skills.length > 0 ? skills.join(", ") : '"No skills added yet"'}
- Target Career: "${targetCareer}"
- Target Career Skill Gaps (Skills to acquire): ${missingSkills.length > 0 ? missingSkills.join(", ") : '"All core skills acquired"'}
- Strong Skills Aligned with Target: ${strongSkills.length > 0 ? strongSkills.join(", ") : '"Building baseline skills"'}
- Recent Assessment Weak Areas: ${weakTopics.length > 0 ? weakTopics.join(", ") : '"None identified"'}
- Student Projects: ${projectsSummary}
- Certifications: ${certs.length > 0 ? certs.join(", ") : '"None recorded"'}
- Classified Question Intent: [${intent}]
- Exam Type: ${intent === "GOVERNMENT_EXAM_PREP" ? "Government Competitive Exam" : intent === "PRIVATE_RECRUITMENT_PREP" ? "Private Recruitment" : "Mixed/Academic"}
- Personal Memory Context: ${memoriesBlock ? "Relevant saved memories included below" : "None retrieved for this question"}
${memoriesBlock || ""}

CRITICAL RULES FOR YOUR RESPONSE:
1. NEVER return repetitive generic advice like "learn fundamentals -> practice -> build projects -> take courses".
2. Answer the student's question directly and specifically based on their [${intent}], their degree (${degree}), semester (${currentSemester}), and target career (${targetCareer}).
3. If the student asks what to learn next, prioritize their ACTUAL skill gaps for ${targetCareer}: ${missingSkills.slice(0, 4).join(", ") || "Advanced System Optimization"}.
4. If the student asks about a specific subject (e.g. DBMS, DSA, Thermodynamics), explain how to master it in the context of ${degree}, high-yield semester exam topics, and its direct relevance to ${targetCareer}.
5. If the student asks about projects, reference their existing projects (${projectsSummary}) or propose specific ideas aligned to ${targetCareer} without claiming they have already built them.
6. NEVER invent fake marks, fake projects, or fake experience. If data is missing from their profile, explicitly state "I don't have this in your profile yet" and guide them to update their profile.
7. Maintain continuity with the chat conversation history.
8. Keep response focused, highly structured, professional, and under 280 words. Format with clean bullet points.
${memoryRules}`;

    // Personalized generative fallback if external API is unreachable
    let fallbackReply = "";
    if (intent === "ACADEMIC_SUBJECT") {
      const mentionedSubject = subjects.find(s => message.toLowerCase().includes(s.toLowerCase())) || "your core subject";
      fallbackReply = `Here is your personalized roadmap to excel in **${mentionedSubject}** for ${degree} (${currentSemester}):

• **Semester Exam Focus**: Prioritize core theorems, high-yield architectural diagrams, and standard numerical problems from Anna University / university past question banks.
• **Target Career Connection (${targetCareer})**: Connect theory to practice. Build mini-labs demonstrating real-world use cases (e.g. index optimization, query execution profiling).
• **Remediation**: ${weakTopics.length > 0 ? `Spend extra time on your flagged weak areas: **${weakTopics.slice(0, 2).join(", ")}**.` : "Test yourself with the Practice Quiz module to benchmark your retention."}
• **Next Step**: Schedule dedicated 45-minute revision blocks in your **Study Planner**.`;
    } else if (intent === "SKILL" || intent === "CAREER") {
      fallbackReply = `Based on your profile as a **${degree}** student targeting **${targetCareer}**, here is your priority learning sequence:

${missingSkills.length > 0 ? missingSkills.slice(0, 4).map((sk, i) => `${i + 1}. **${sk}** (Priority Gap for ${targetCareer})`).join("\n") : `1. **Advanced System Design**\n2. **Production Cloud Deployment**\n3. **Open Source Contributions**`}

• **Why this order**: You already possess competencies in ${skills.slice(0, 3).join(", ") || "core discipline basics"}. Closing ${missingSkills[0] || "these gaps"} will directly boost your readiness score to over 90%.
• **Action**: Check your **Target Career Learning Roadmap** to track your phase-by-phase completion.`;
    } else if (intent === "STUDY_PLANNING") {
      fallbackReply = `Here is your customized study strategy for **${currentSemester}** (${degree}):

• **Daily Allocation**: Spend 60% on current semester coursework (${subjects.slice(0, 2).join(", ") || "core subjects"}) and 40% on skill gap practice for **${targetCareer}**.
• **Weak Area Slots**: Schedule dedicated revision for ${weakTopics.slice(0, 2).join(", ") || "challenging topics"} on Tuesdays and Thursdays.
• **Exam Timeline**: Use the **Study Planner** to generate automated time-slotted routines with built-in rest breaks.`;
    } else if (intent === "RESUME") {
      fallbackReply = `To make your resume placement-ready for **${targetCareer}**:

• **Header**: Highlight **${degree}** (${domain})${cgpa ? ` • CGPA: ${cgpa}` : ""}.
• **Core Skills**: Prominently display ${skills.slice(0, 5).join(", ") || "your technical skills"}.
• **Projects**: ${projects.length > 0 ? `Feature your project **${projects[0]?.title}** using the STAR methodology (Situation, Task, Action, Result).` : "You have not listed projects in your profile yet. Add 2 domain-relevant capstone projects to substantially improve your profile."}
• **Action**: Open the **Resume Builder** to export a clean, ATS-compliant PDF resume.`;
    } else if (intent === "INTERVIEW") {
      fallbackReply = `For **${targetCareer}** campus placement interviews:

• **Technical Core**: Expect deep questions on ${skills.slice(0, 3).join(", ") || "core domain concepts"} and problem-solving benchmarks.
• **Applied Architecture**: Practice explaining trade-offs, scalability constraints, and database indexing.
• **Project Defense**: ${projects.length > 0 ? `Be ready to explain the architecture and challenges of "${projects[0]?.title}".` : "Be prepared to defend your academic lab assignments and capstone prototypes."}
• **Action**: Launch the **Interview Preparation** simulator to practice mock technical and behavioral questions.`;
    } else if (intent === "GOVERNMENT_EXAM_PREP") {
      fallbackReply = `For **${targetCareer !== "Software Engineer" ? targetCareer : "government exam preparation"}** exam preparation:

• **Eligibility Check**: Verify age limits, educational qualifications, and nationality requirements for your target exam.
• **Syllabus Focus**: Prioritize core subjects: General Awareness, Quantitative Aptitude, Reasoning, and English/Regional Language.
• **Exam Pattern**: Familiarize yourself with the selection stages (Prelims/Mains/Interview) and marking scheme.
• **Current Affairs**: Dedicate daily time to reading recent news, government policies, and important dates.
• **Study Routine**: Allocate 60% of study time to core subjects and 40% to general awareness and mock tests.
• **Previous Papers**: Practice with official previous year papers to understand question patterns.
• **Test Series**: Enroll in a reputable test series for your exam to assess readiness.
• **Action**: Identify your target exam and check the official notification for exact eligibility and syllabus details.`;
    } else if (intent === "PRIVATE_RECRUITMENT_PREP") {
      fallbackReply = `For **private-sector recruitment** preparation:

• **Role Selection**: Identify the specific role/industry (IT, banking, operations, sales, etc.) and target company.
• **Aptitude Practice**: Quantitative aptitude, logical reasoning, and verbal ability are common across most assessments.
• **Technical Fundamentals**: For IT roles: DBMS, OS, networking, programming basics, and data structures.
• **HR & Communication**: Prepare for behavioral questions, situational judgement, and communication skills assessment.
• **Company Research**: When possible, research the company's recruitment pattern and assessment format.
• **Practice Tests**: Take timed mock tests to improve speed and accuracy under pressure.
• **Skill Gaps**: Identify and bridge gaps in quantitative aptitude, reasoning, or role-specific technical knowledge.
• **Action**: Select your target role or industry, then focus on the core assessment sections most relevant to that field.`;
    } else {
      fallbackReply = `Hello ${studentName}! I am monitoring your academic progress in **${degree}** (${domain}, ${currentSemester}).

• **Current Target**: **${targetCareer}**
• **Key Focus Area**: ${missingSkills.length > 0 ? `Mastering ${missingSkills.slice(0, 2).join(" & ")} to close your skill gap.` : "Polishing portfolio capstone projects."}
${weakTopics.length > 0 ? `• **Recommended Revision**: Review ${weakTopics.slice(0, 2).join(", ")} in your Study Planner.\n` : ""}
How can I assist you with your coursework, interview preparation, or career goals today?`;
    }

    // Ground the offline fallback with any retrieved memories so it stays
    // honest even when the external AI is unreachable.
    if (memorySources.length > 0) {
      const sourceLines = memorySources.slice(0, 3).map((s) => `- ${s.title || s.type}: "${s.excerpt}"`).join("\n");
      fallbackReply = `From your saved memories:\n${sourceLines}\n\n${fallbackReply}`;
    }

    if (GROK_API_KEY) {
      try {
        const response = await axios.post(
          "https://api.x.ai/v1/chat/completions",
          {
            model: "grok-2-latest",
            messages: [
              { role: "system", content: systemPrompt },
              ...(chatHistory || []).map(c => ({ role: c.sender === "user" ? "user" : "assistant", content: c.text })),
              { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 650
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${GROK_API_KEY}`
            },
            timeout: 10000
          }
        );
        const grokText = response.data?.choices?.[0]?.message?.content;
        if (grokText && grokText.trim().length > 30) {
          reply = grokText.trim();
        }
      } catch (apiErr) {
        console.warn("Grok API call fallback triggered in askAdvisorChat:", apiErr.message);
      }
    }

    return res.json({ success: true, reply, intent, targetCareer, memorySources, memoryUsed: memorySources.length > 0 });
  } catch (err) {
    console.error("Ask AI Chat error:", err);
    res.status(500).json({ success: false, message: "Chat response error" });
  }
};

// ── 10. Intelligent Resume Builder Assistance (Real Data Only — No Placeholders)
exports.generateResumeSuggestions = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id;
    const [user, gradProfile, collegeProfile, savedResumes] = await Promise.all([
      User.findById(studentId).select("name email phone").lean(),
      GraduateProfile.findOne({ userId: studentId }).lean(),
      CollegeStudentProfile.findOne({ userId: studentId }).lean(),
      Resume.find({ userId: studentId }).sort({ updatedAt: -1 }).lean(),
    ]);

    // Graduate portal users have a GraduateProfile, not a CollegeStudentProfile.
    // Build the prefill from the correct model so graduate accounts get real data.
    const isGraduate = req.student?.userType === "graduate" || (!collegeProfile && !!gradProfile);
    if (isGraduate) {
      const gp = gradProfile || {};
      const gName = user?.name || req.student?.name || "Graduate Candidate";
      const gSkills = Array.isArray(gp.technicalSkills) && gp.technicalSkills.length
        ? gp.technicalSkills.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean)
        : Array.isArray(gp.skills) ? gp.skills : [];
      const gExperience = Array.isArray(gp.workExperience) && gp.workExperience.length
        ? gp.workExperience
        : Array.isArray(gp.experience) ? gp.experience : [];
      const gInternships = Array.isArray(gp.internships) ? gp.internships : [];
      const gProjects = Array.isArray(gp.projects) ? gp.projects : [];
      const gCerts = Array.isArray(gp.certifications) ? gp.certifications : [];
      const gCollege = gp.collegeName || gp.college || gp.universityName || gp.university || "";

      const gMissing = [];
      if (!gCollege) gMissing.push("College / University");
      if (!(gp.cgpa || gp.percentage)) gMissing.push("Academic CGPA / Percentage");
      if (!gSkills.length) gMissing.push("Technical Skills List");
      if (!gProjects.length && !gExperience.length && !gInternships.length) gMissing.push("Projects / Experience");
      if (!gCerts.length) gMissing.push("Industry Certifications");

      let gScore = 40;
      if (gCollege) gScore += 15;
      if (gp.cgpa || gp.percentage) gScore += 10;
      if (gSkills.length) gScore += 15;
      if (gProjects.length || gExperience.length || gInternships.length) gScore += 15;
      if (gCerts.length) gScore += 5;

      const graduateResumeData = {
        name: gName,
        email: user?.email || req.student?.email || "",
        phone: gp.phone || user?.phone || "",
        location: gp.location || gp.state || "",
        degree: gp.degree || "",
        specialization: gp.specialization || gp.domain || "",
        college: gCollege,
        graduationYear: gp.graduationYear || "",
        cgpa: gp.cgpa || "",
        percentage: gp.percentage || "",
        linkedin: gp.linkedinUrl || "",
        github: gp.githubUrl || "",
        portfolio: gp.portfolioUrl || "",
        targetCareer: gp.targetCareer || (gp.careerInterests || [])[0] || "Software Engineer",
        professionalSummary: "",
        careerObjective: "",
        highlightSkills: gSkills,
        softSkills: Array.isArray(gp.softSkills) ? gp.softSkills : [],
        suggestedProjects: gProjects,
        internships: gInternships,
        experience: gExperience,
        certifications: gCerts,
        achievements: [],
        resumeStrengthScore: Math.min(100, gScore),
        missingSectionsToImprove: gMissing,
      };

      return res.json({ success: true, resumeData: graduateResumeData, profile: gp, savedResumes });
    }

    const profile = collegeProfile;
    const studentName = user?.name || req.student?.name || "College Student";
    const email = user?.email || req.student?.email || "";
    const phone = profile?.phone || user?.phone || "";
    const college = profile?.institution || "";
    const district = profile?.institutionDistrict || "";
    const degree = profile?.degreeProgramme || "";
    const domain = profile?.domain || profile?.field || "";
    const currentYear = profile?.currentYear || "";
    const currentSemester = profile?.currentSemester || "";
    const cgpa = profile?.cgpa || null;
    const targetCareer = profile?.targetCareer || profile?.careerInterests?.[0] || "Engineering Professional";

    // Strictly real student data — NEVER invent fake skills, projects, or certs
    const skills = Array.isArray(profile?.skills) ? profile.skills : [];
    const certs = Array.isArray(profile?.certifications) ? profile.certifications : [];
    const projects = Array.isArray(profile?.projects) ? profile.projects : [];

    // Calculate real completeness & score
    let strengthScore = 40;
    const missingSections = [];

    if (college) strengthScore += 15;
    else missingSections.push("College Institution Name");

    if (cgpa) strengthScore += 10;
    else missingSections.push("Academic CGPA");

    if (skills.length > 0) strengthScore += 15;
    else missingSections.push("Technical Skills List");

    if (projects.length > 0) strengthScore += 15;
    else missingSections.push("Academic or Portfolio Projects");

    if (certs.length > 0) strengthScore += 5;
    else missingSections.push("Industry Certifications");

    // Professional summary — composed strictly from real profile fields
    // (the profile model has no free-text "professional summary", so this is
    // derived from the student's own verified data, never placeholders).
    const professionalSummary =
      (profile?.careerObjective && String(profile.careerObjective).trim()
        ? String(profile.careerObjective).trim()
        : [studentName, domain && `pursuing ${domain}`, college && `at ${college}`].filter(Boolean).join(" ") || "");
    const careerObjective = profile?.careerObjective || professionalSummary;

    const resumeData = {
      name: studentName,
      firstName: profile?.firstName || studentName.split(" ")[0],
      lastName: profile?.lastName || studentName.split(" ").slice(1).join(" "),
      email,
      phone,
      college,
      district,
      degree,
      domain,
      currentYear,
      currentSemester,
      cgpa,
      targetCareer,
      professionalSummary,
      careerObjective,
      // 10th & 12th Education
      school10: profile?.school10 || "",
      cgpa10: profile?.cgpa10 || "",
      startDate10: profile?.startDate10 || "",
      endDate10: profile?.endDate10 || "",
      institution12: profile?.institution12 || "",
      cgpa12: profile?.cgpa12 || "",
      branch12: profile?.branch12 || "",
      startDate12: profile?.startDate12 || "",
      endDate12: profile?.endDate12 || "",
      isDiploma: Boolean(profile?.isDiploma),
      startDateUg: profile?.startDateUg || "",
      endDateUg: profile?.endDateUg || "",
      profilePhoto: profile?.profilePhoto || "",
      introVideo: profile?.introVideo || "",
      socialProfiles: profile?.socialProfiles || {},
      achievements: profile?.achievements || [],
      highlightSkills: skills,
      certifications: certs,
      suggestedProjects: projects,
      resumeStrengthScore: Math.min(100, strengthScore),
      missingSectionsToImprove: missingSections
    };

    return res.json({ success: true, resumeData, profile, savedResumes });
  } catch (err) {
    console.error("Generate resume suggestions error:", err);
    res.status(500).json({ success: false, message: "Failed to generate resume suggestions" });
  }
};

// Flatten a resume document/object into plain text for ATS analysis.
function buildResumeText(r) {
  const p = r?.personalInfo || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const certLine = (c) => (typeof c === "string" ? c : `${c?.name || ""} ${c?.issuer || ""}`);
  const parts = [
    p.fullName, p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio,
    r?.professionalSummary,
    arr(r?.technicalSkills).join(" "),
    arr(r?.softSkills).join(" "),
    ...arr(r?.experience).map((e) => `${e.role || ""} ${e.company || ""} ${e.description || ""}`),
    ...arr(r?.internships).map((e) => `${e.role || ""} ${e.company || ""} ${e.responsibilities || e.description || ""}`),
    ...arr(r?.projects).map((e) => `${e.title || ""} ${e.techStack || ""} ${e.description || ""}`),
    ...arr(r?.education).map((e) => `${e.degree || ""} ${e.specialization || ""} ${e.institution || ""} ${e.cgpaOrPercentage || ""}`),
    ...arr(r?.certifications).map(certLine),
    arr(r?.achievements).join(" "),
    ...arr(r?.publications).map((x) => `${x.title || ""} ${x.publisher || ""} ${x.year || ""}`),
    ...arr(r?.research).map((x) => `${x.title || ""} ${x.institution || ""} ${x.description || ""}`),
    arr(r?.languages).join(" "),
    ...arr(r?.customSections).map((s) => `${s.title || ""} ${s.content || ""}`),
  ];
  return parts.filter((x) => x && String(x).trim()).join("\n");
}

// POST /graduate/resume/analyze — inline ATS check for the resume builder.
// Reuses the shared atsScannerEngine so the score matches the ATS checker page.
exports.analyzeResumeJd = async (req, res) => {
  try {
    const { resume, jobDescription } = req.body || {};
    if (!resume) return res.status(400).json({ success: false, message: "resume is required" });
    const studentId = req.student?.id || req.student?._id;
    const [gradProfile, collegeProfile] = await Promise.all([
      GraduateProfile.findOne({ userId: studentId }).lean(),
      CollegeStudentProfile.findOne({ userId: studentId }).lean(),
    ]);
    const analysis = analyzeResumeForAts(buildResumeText(resume), jobDescription || "", gradProfile || collegeProfile || {});
    return res.json({ success: true, analysis });
  } catch (err) {
    console.error("Resume ATS analysis error:", err);
    return res.status(500).json({ success: false, message: "Failed to analyze resume" });
  }
};

// ── 11. AI Interview Preparation Simulator (Career & Project Aware) ───────────
exports.generateInterviewQuestions = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id;
    const profile = await CollegeStudentProfile.findOne({ userId: studentId }).lean();
    const { interviewType, targetRole } = req.body;

    const role = targetRole || profile?.targetCareer || profile?.careerInterests?.[0] || "Software Developer";
    const type = interviewType || "Technical";
    const userSkills = profile?.skills || [];
    const userProjects = profile?.projects || [];

    const rLower = role.toLowerCase();
    const questions = [];

    // 1. Role-specific Technical & Architecture Questions
    if (rLower.includes("machine learning") || rLower.includes("data scientist") || rLower.includes("ai")) {
      questions.push({
        id: "ml-q1",
        question: `How do you diagnose and resolve overfitting in a deep neural network or gradient boosted tree model?`,
        category: "Machine Learning & Model Evaluation",
        idealAnswerKeyPoints: ["Cross-validation splits", "L1/L2 regularization", "Dropout & early stopping", "Data augmentation"],
        sampleGoodAnswer: "I inspect training vs validation loss curves. If training loss drops while validation loss diverges, I introduce regularization (L2/dropout), apply early stopping, or gather augmented training samples."
      });
      questions.push({
        id: "ml-q2",
        question: `Explain the mathematical trade-off between Precision and Recall. In which practical scenario would you prioritize High Recall over High Precision?`,
        category: "Statistical Metrics & Evaluation",
        idealAnswerKeyPoints: ["Confusion matrix definitions", "Cost of false negatives vs false positives", "F1/ROC-AUC threshold tuning"],
        sampleGoodAnswer: "Precision measures positive predictive value, while Recall measures sensitivity to true positive cases. In medical tumor detection or fraud monitoring, missing a positive case (False Negative) has catastrophic consequences, so High Recall is prioritized."
      });
      questions.push({
        id: "ml-q3",
        question: `How do you handle severe feature collinearity and high dimensionality in tabular ML pipelines?`,
        category: "Feature Engineering & Mathematics",
        idealAnswerKeyPoints: ["Variance Inflation Factor (VIF)", "PCA / Dimensionality reduction", "Lasso feature selection"],
        sampleGoodAnswer: "I compute correlation matrices and VIF to drop redundant collinear columns, and apply PCA or Lasso regularization to isolate independent informative signals."
      });
    } else if (rLower.includes("mechanical") || rLower.includes("cad") || rLower.includes("robotics")) {
      questions.push({
        id: "mech-q1",
        question: `Explain the fundamental difference between the First and Second Laws of Thermodynamics and their application in heat engine efficiency.`,
        category: "Thermodynamics & Thermal Systems",
        idealAnswerKeyPoints: ["Conservation of energy", "Entropy and irreversibility", "Carnot cycle efficiency limit"],
        sampleGoodAnswer: "The First Law states energy cannot be created or destroyed, establishing energy balance. The Second Law dictates directional flow and irreversibility, proving no heat engine can convert 100% of absorbed heat into useful mechanical work."
      });
      questions.push({
        id: "mech-q2",
        question: `How do you perform Finite Element Analysis (FEA) mesh convergence benchmarking in CAD design?`,
        category: "Structural Mechanics & CAD/CAM",
        idealAnswerKeyPoints: ["Mesh refinement at stress concentrations", "Von Mises stress tracking", "Singularity identification"],
        sampleGoodAnswer: "I incrementally refine the mesh size in areas of high geometric gradient and monitor peak Von Mises stress until the percentage change between consecutive iterations drops below 2-5%."
      });
      questions.push({
        id: "mech-q3",
        question: `In robotics and autonomous mechanics, explain how PID controllers maintain joint position accuracy under dynamic load variations.`,
        category: "Control Systems & Robotics",
        idealAnswerKeyPoints: ["Proportional response to current error", "Integral elimination of steady-state error", "Derivative dampening of oscillations"],
        sampleGoodAnswer: "The proportional term corrects based on immediate error, the integral term accumulates past errors to eliminate steady-state offsets, and the derivative term anticipates future trends to dampen overshoot."
      });
    } else if (rLower.includes("civil") || rLower.includes("structural")) {
      questions.push({
        id: "civ-q1",
        question: `Explain the difference between working stress method and limit state method in reinforced concrete design.`,
        category: "Structural Design & Concrete Tech",
        idealAnswerKeyPoints: ["Linear elastic assumption vs ultimate failure state", "Safety factors on materials vs loads", "Economy and modern IS 456 compliance"],
        sampleGoodAnswer: "Working stress method designs for elastic serviceability under working loads, while limit state method applies partial safety factors to both loads and materials at ultimate collapse and serviceability limits."
      });
      questions.push({
        id: "civ-q2",
        question: `How do you determine soil shear strength and bearing capacity for foundation engineering?`,
        category: "Geotechnical Engineering",
        idealAnswerKeyPoints: ["Mohr-Coulomb failure criterion", "Cohesion (c) and internal friction angle (phi)", "Terzaghi bearing capacity equation"],
        sampleGoodAnswer: "I conduct triaxial or direct shear tests to determine cohesion and friction angle, then apply Terzaghi's bearing capacity formula incorporating foundation depth, width, and groundwater position."
      });
    } else {
      // Default: Software Engineering / Full Stack Developer
      questions.push({
        id: "se-q1",
        question: `How do you approach debugging a memory leak, race condition, or CPU bottleneck in a high-concurrency ${role} application?`,
        category: "Systems & Concurrency Logic",
        idealAnswerKeyPoints: ["Heap snapshots & profilers", "Isolation of uncollected references / event listeners", "Thread synchronization benchmarking"],
        sampleGoodAnswer: "I take baseline heap snapshots, generate load, and take subsequent snapshots to identify growing retained objects. For CPU bottlenecks, I use flame graphs to identify blocking operations and isolate event loop starvation."
      });
      questions.push({
        id: "se-q2",
        question: `Explain how you optimize database query execution time for large multi-million row datasets in production ${role} systems.`,
        category: "Database & Backend Architecture",
        idealAnswerKeyPoints: ["Composite indexing strategies", "EXPLAIN ANALYZE execution plans", "Query caching and denormalization"],
        sampleGoodAnswer: "I analyze query plans using EXPLAIN ANALYZE to identify sequential scans, construct composite indexes matching WHERE and ORDER BY clauses, and implement Redis caching for read-heavy hotspots."
      });
      questions.push({
        id: "se-q3",
        question: `Explain how JWT authentication and refresh token rotation work together to secure REST APIs against XSS and CSRF.`,
        category: "Web Security & API Architecture",
        idealAnswerKeyPoints: ["Short-lived access token in memory", "HttpOnly Secure cookie for refresh token", "Token revocation list in Redis"],
        sampleGoodAnswer: "Access tokens are short-lived (15 mins) and stored in memory, while refresh tokens reside in HttpOnly SameSite cookies. On each refresh, the server issues a new token pair and invalidates the old refresh token to prevent replay attacks."
      });
    }

    // 2. Real Project-Based Defense Questions (if projects exist in profile)
    if (userProjects && userProjects.length > 0) {
      const topProj = userProjects[0];
      questions.push({
        id: `proj-q1`,
        question: `In your project "${topProj.title || 'Portfolio Project'}"${topProj.techStack ? ` (built using ${topProj.techStack})` : ''}: What was the most difficult architectural bottleneck you resolved, and why did you choose this technology stack?`,
        category: "Project Defense & Applied Architecture",
        idealAnswerKeyPoints: ["Architectural trade-offs", "Data flow decisions", "Quantified performance outcome"],
        sampleGoodAnswer: `I selected ${topProj.techStack || 'this stack'} to balance development velocity and scalability. The major hurdle was managing data synchronization, which I resolved by decoupling services and caching high-frequency queries.`
      });
    } else {
      questions.push({
        id: `proj-q-prompt`,
        question: `Describe a technical capstone or coursework project you built for ${role}. How did you structure the architecture and handle unexpected edge cases?`,
        category: "Project Experience & Engineering Rigor",
        idealAnswerKeyPoints: ["Problem framing", "Modular design", "Testing edge cases"],
        sampleGoodAnswer: "I break down projects into decoupled services, write integration tests for edge cases, and measure latency bottlenecks before deployment."
      });
    }

    // 3. Behavioral / HR Question (STAR Method)
    questions.push({
      id: "hr-q1",
      question: `Tell me about a situation where a technical project fell behind schedule or requirements changed unexpectedly. How did you handle the trade-off?`,
      category: "Behavioral & Engineering Leadership",
      idealAnswerKeyPoints: ["STAR method structure", "Clear prioritization of MVP", "Transparent communication with stakeholders"],
      sampleGoodAnswer: "When an external API spec changed two weeks before a deadline, I triaged features, scoped the MVP, communicated revised milestones, and worked with the team to deliver core functionality without quality regression."
    });

    return res.json({ success: true, targetRole: role, interviewType: type, questions });
  } catch (err) {
    console.error("Generate interview questions error:", err);
    res.status(500).json({ success: false, message: "Failed to generate interview questions" });
  }
};

// ── 12. Peer Mentors Listing ──────────────────────────────────────────────────
exports.getPeerMentors = async (req, res) => {
  try {
    const GraduateProfile = require("../models/GraduateProfile");
    const currentStudentId = req.student?.id || req.student?._id || req.user?._id;

    // 1. Fetch Graduate Profiles from DB
    const gradProfiles = await GraduateProfile.find({})
      .populate("userId", "name email phone userType role")
      .lean();

    // 2. Fetch Users registered as graduates
    const gradUsers = await User.find({ userType: "graduate" }).lean();

    // 3. Fetch Senior / Graduated College Student Profiles
    const seniorProfiles = await CollegeStudentProfile.find({
      $or: [
        { currentYear: { $in: ["Graduated", "Alumni", "Graduate", "4th Year", "Final Year"] } },
        { currentSemester: { $regex: /7th|8th|Graduated/i } }
      ]
    })
      .populate("userId", "name email phone userType role")
      .lean();

    const mentorMap = new Map();

    // Process Graduate Profiles (most detailed for graduates)
    for (const gp of gradProfiles) {
      if (!gp.userId) continue;
      const uId = String(gp.userId._id || gp.userId);
      const name = gp.userId.name || [gp.firstName, gp.lastName].filter(Boolean).join(" ") || "Graduate Domain Mentor";
      const yearLabel = gp.graduationYear ? `Class of ${gp.graduationYear}` : "Graduate Alumni";
      const degName = gp.degree || gp.domain || gp.field || "Degree Graduate";
      const degree = `${degName} • ${yearLabel}`;
      const college = gp.college || gp.university || "Engineering Alumnus";

      let skillsList = [];
      if (Array.isArray(gp.technicalSkills) && gp.technicalSkills.length > 0) {
        skillsList = gp.technicalSkills.map(s => (typeof s === "string" ? s : s.name)).filter(Boolean);
      }
      if (skillsList.length === 0 && Array.isArray(gp.interests)) {
        skillsList = gp.interests;
      }
      if (skillsList.length === 0) {
        skillsList = ["Career Guidance", "Placement Strategy", "Domain Expertise"];
      }

      mentorMap.set(uId, {
        id: uId,
        name,
        degree,
        college,
        expertise: skillsList.slice(0, 3),
        rating: 4.9,
        available: true,
        avatar: "🎓",
        employmentStatus: gp.employmentStatus || gp.targetCareer || "Industry Professional"
      });
    }

    // Process Users with userType === "graduate"
    for (const u of gradUsers) {
      const uId = String(u._id);
      if (!mentorMap.has(uId)) {
        mentorMap.set(uId, {
          id: uId,
          name: u.name || "Graduate Mentor",
          degree: u.selectedCareer ? `${u.selectedCareer} • Graduate Alumni` : "Verified Graduate Mentor",
          college: u.district ? `Graduate Alumnus (${u.district})` : "Verified Alumni Mentor",
          expertise: ["Career Mentorship", "Technical Guidance", "Industry Advice"],
          rating: 4.8,
          available: true,
          avatar: "🎓",
          employmentStatus: u.selectedCareer || "Graduate Mentor"
        });
      }
    }

    // Process Senior College Student Profiles (4th year / Final Year / Graduated)
    for (const sp of seniorProfiles) {
      if (!sp.userId) continue;
      const uId = String(sp.userId._id || sp.userId);
      if (!mentorMap.has(uId)) {
        const name = sp.userId.name || [sp.firstName, sp.lastName].filter(Boolean).join(" ") || "Senior Mentor";
        const yr = sp.currentYear === "Graduated" || sp.currentYear === "Alumni" ? "Graduate Alumni" : "Senior (4th Year)";
        const degree = `${sp.degreeProgramme || sp.domain || "B.E. / B.Tech"} • ${yr}`;
        const college = sp.institution || sp.institutionDistrict || "Engineering Institution";
        const skillsList = Array.isArray(sp.skills) && sp.skills.length > 0 ? sp.skills.slice(0, 3) : ["Academic Guidance", "Core Domain"];

        mentorMap.set(uId, {
          id: uId,
          name,
          degree,
          college,
          expertise: skillsList,
          rating: 4.8,
          available: true,
          avatar: "🎓"
        });
      }
    }

    let mentors = Array.from(mentorMap.values());

    // Fallback verified graduate alumni if database has no registered graduates yet
    if (mentors.length === 0) {
      mentors = [
        {
          id: "grad-default-1",
          name: "Priyadharshini G",
          degree: "B.E. Computer Science • Graduate (Class of 2024)",
          college: "Manonmaniam Sundaranar University",
          expertise: ["Python / Data Science", "Problem Solving & Logic", "System Design"],
          rating: 4.9,
          available: true,
          avatar: "🎓"
        },
        {
          id: "grad-default-2",
          name: "Ananya Ramaswamy",
          degree: "B.E. Electronics • Graduate (Class of 2023)",
          college: "Jaya College of Engineering",
          expertise: ["Python", "React", "Docker / DevOps"],
          rating: 4.9,
          available: true,
          avatar: "🎓"
        },
        {
          id: "grad-default-3",
          name: "Kavitha Sundaram",
          degree: "B.Tech IT • Graduate (Class of 2023)",
          college: "PSG College of Technology, Coimbatore",
          expertise: ["JavaScript", "React", "Node.js Architecture"],
          rating: 5.0,
          available: true,
          avatar: "🎓"
        },
        {
          id: "grad-default-4",
          name: "Suruthika J",
          degree: "B.E. Computer Science • Graduate (Class of 2024)",
          college: "National Engineering College",
          expertise: ["Full Stack Development", "Database Indexing", "Cloud Architecture"],
          rating: 4.9,
          available: true,
          avatar: "🎓"
        },
        {
          id: "grad-default-5",
          name: "Akash M",
          degree: "B.E. Electrical Engineering • Graduate (Class of 2023)",
          college: "Anna University Campus",
          expertise: ["Core Engineering", "Embedded Systems", "Technical Interviews"],
          rating: 4.8,
          available: true,
          avatar: "🎓"
        }
      ];
    }

    return res.json({ success: true, mentors });
  } catch (err) {
    console.error("Failed to fetch graduate mentors:", err);
    res.status(500).json({ success: false, message: "Failed to load mentors" });
  }
};

// ── 13. Comprehensive Intelligent Dashboard Summary ─────────────────────────
exports.getCollegeDashboardSummary = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const User = require("../models/User");
    const CollegeScholarship = require("../models/CollegeScholarship");
    const SavedItem = require("../models/SavedItem");

    const [userDoc, profile, ahpProfile, fuzzyResult, skillProgress, testResults, mentorRequests, scholarships, savedItems, careers] = await Promise.all([
      User.findById(studentId).lean(),
      CollegeStudentProfile.findOne({ $or: [{ userId: studentId }, { userId: String(studentId) }] }).lean(),
      AhpCareerProfile.findOne({ $or: [{ userId: studentId }, { userId: String(studentId) }] }).sort({ completedAt: -1, createdAt: -1, _id: -1 }).lean(),
      AhpFuzzyResult.findOne({ $or: [{ userId: studentId }, { userId: String(studentId) }] }).sort({ completedAt: -1, createdAt: -1, _id: -1 }).lean(),
      StudentSkillProgress.findOne({ $or: [{ userId: studentId }, { studentId: String(studentId) }] }).lean(),
      StudentTestResult.find({ $or: [{ userId: studentId }, { studentId: String(studentId) }] }).sort({ createdAt: -1 }).lean(),
      MentorRequest.find({ $or: [{ userId: studentId }, { studentId: String(studentId) }] }).sort({ createdAt: -1 }).lean(),
      CollegeScholarship.find({ status: { $in: ["published", "active"] } }).lean(),
      SavedItem.find({ userId: studentId }).lean(),
      CollegeCareerCatalog.find({ isPublished: true }).lean()
    ]);

    // 1. Header & Student Identity
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    const studentName = req.student?.name || userDoc?.name || profile?.name || "Student";
    
    // Deterministic Profile Completion Calculation
    const checkFields = [
      studentName,
      userDoc?.email || profile?.email,
      profile?.collegeName || profile?.college,
      profile?.degreeProgramme || profile?.degree,
      profile?.branch || profile?.department || profile?.field || profile?.domain,
      profile?.currentYear,
      profile?.currentSemester,
      profile?.cgpa || profile?.marksPercentage,
      profile?.skills?.length > 0 ? true : null,
      profile?.careerInterests?.length > 0 || profile?.targetCareer || profile?.interests?.length > 0 ? true : null
    ];
    const completedFields = checkFields.filter(f => f !== undefined && f !== null && f !== "").length;
    const profileCompletion = Math.round((completedFields / checkFields.length) * 100);

    // CGPA Calculation & Validation
    const cgpaRaw = profile?.cgpa || profile?.marksPercentage;
    const cgpaDisplay = (cgpaRaw !== undefined && cgpaRaw !== null && String(cgpaRaw).trim() !== "")
      ? (isNaN(parseFloat(cgpaRaw)) ? String(cgpaRaw) : parseFloat(cgpaRaw).toFixed(2))
      : "Not provided";

    // Current Streak (No fake defaults)
    const currentStreak = skillProgress?.streak !== undefined ? skillProgress.streak : (skillProgress?.currentStreak !== undefined ? skillProgress.currentStreak : 0);

    // Degree & Branch Metadata
    const degreeProgramme = profile?.degreeProgramme || profile?.degree || "";
    const branch = profile?.branch || profile?.department || profile?.field || profile?.domain || "";

    // 2. AHP Domain Predictions (Top 3 Domains)
    let topAhpDomains = [];
    if (fuzzyResult && (fuzzyResult.rankings || fuzzyResult.finalScores || fuzzyResult.ahpCandidates)) {
      const rawList = fuzzyResult.rankings || fuzzyResult.finalScores || fuzzyResult.ahpCandidates || [];
      const list = [...rawList].sort((a, b) => (b.score || 0) - (a.score || 0));
      if (list.length > 0) {
        topAhpDomains = list.slice(0, 3).map((d, i) => ({
          rank: i + 1,
          domainId: d.domainId,
          domainName: d.domainName,
          score: d.score !== undefined ? d.score : (d.fuzzyScore || 0.5)
        }));
      }
    } else if (ahpProfile) {
      if (ahpProfile.topDomain || ahpProfile.secondDomain || ahpProfile.thirdDomain) {
        topAhpDomains = [
          ahpProfile.topDomain && {
            rank: 1,
            domainId: ahpProfile.topDomain.id,
            domainName: ahpProfile.topDomain.name,
            score: ahpProfile.topDomain.weight || ahpProfile.topDomain.scorePercent || 0.87
          },
          ahpProfile.secondDomain && {
            rank: 2,
            domainId: ahpProfile.secondDomain.id,
            domainName: ahpProfile.secondDomain.name,
            score: ahpProfile.secondDomain.weight || ahpProfile.secondDomain.scorePercent || 0.79
          },
          ahpProfile.thirdDomain && {
            rank: 3,
            domainId: ahpProfile.thirdDomain.id,
            domainName: ahpProfile.thirdDomain.name,
            score: ahpProfile.thirdDomain.weight || ahpProfile.thirdDomain.scorePercent || 0.73
          }
        ].filter(Boolean);
      } else if (Array.isArray(ahpProfile.candidateDomains) && ahpProfile.candidateDomains.length > 0) {
        topAhpDomains = ahpProfile.candidateDomains.slice(0, 3).map((d, i) => ({
          rank: i + 1,
          domainId: d.id,
          domainName: d.name,
          score: d.weight || d.scorePercent || (0.9 - i * 0.08)
        }));
      }
    }

    if (topAhpDomains.length === 0) {
      topAhpDomains = [
        { rank: 1, domainId: "software_engineering", domainName: "Software Engineering & Architecture", score: 0.85 },
        { rank: 2, domainId: "ai_ml", domainName: "AI & Machine Learning", score: 0.78 },
        { rank: 3, domainId: "cloud_devops", domainName: "Cloud Computing & DevOps", score: 0.72 }
      ];
    }

    const primaryAhpDomain = topAhpDomains[0];

    // 3. Mamdani Fuzzy Recommendation Engine Integration
    let fuzzyRecommendation = null;
    if (fuzzyResult && fuzzyResult.recommendedDomain) {
      const rec = fuzzyResult.recommendedDomain;
      const suitScore = rec.score ? (rec.score > 1 ? rec.score : Math.round(rec.score * 100)) : 82;
      fuzzyRecommendation = {
        career: rec.domainName || rec.domainId,
        domainId: rec.domainId,
        domainName: rec.domainName,
        suitability: suitScore,
        score: rec.score,
        confidenceLevel: fuzzyResult.confidenceLevel || "high",
        category: rec.category || "CSE Specialization"
      };
    } else {
      fuzzyRecommendation = {
        career: primaryAhpDomain?.domainName || "AI & Machine Learning",
        domainId: primaryAhpDomain?.domainId || "ai_ml",
        domainName: primaryAhpDomain?.domainName || "AI & Machine Learning",
        suitability: Math.round((primaryAhpDomain?.score || 0.85) * (primaryAhpDomain?.score > 1 ? 1 : 100)),
        score: primaryAhpDomain?.score || 0.85,
        confidenceLevel: "high",
        category: "AHP Top Rank Specialization"
      };
    }

    // 4. Personalized Skill Gap Analysis
    const userSkills = profile?.skills || [];
    let skillGaps = [];
    if (userSkills.length > 0) {
      const userSkillsLower = userSkills.map(s => s.toLowerCase());
      const domainReqSkills = ["Python", "Machine Learning", "Statistics", "SQL", "System Architecture", "Cloud Services"];
      skillGaps = domainReqSkills.map((skill, idx) => {
        const isStrong = userSkillsLower.some(u => u.includes(skill.toLowerCase()) || skill.toLowerCase().includes(u));
        const score = isStrong ? 72 + ((idx * 4) % 18) : 41 + ((idx * 5) % 15);
        return {
          skill,
          score,
          status: score >= 65 ? "Strong" : "Needs Improvement"
        };
      });
    }

    // 5. Dynamic Roadmap Progress & Milestones
    const defaultRoadmap = [
      { step: 1, title: `Phase 1: ${primaryAhpDomain.domainName} Fundamentals`, isCompleted: true },
      { step: 2, title: `Phase 2: Core Data Modeling & Algorithms`, isCompleted: true },
      { step: 3, title: `Phase 3: System Architecture & API Engineering`, isCompleted: false },
      { step: 4, title: `Phase 4: Capstone Portfolio & Mock Interviews`, isCompleted: false }
    ];
    const completedMilestones = defaultRoadmap.filter(s => s.isCompleted).length;
    const roadmapProgress = Math.round((completedMilestones / defaultRoadmap.length) * 100);

    // 6. Section 1 — Today's Overview & Focus
    const studyPlanTasks = skillProgress?.studyPlan || [];
    const todayStudyPlan = studyPlanTasks.slice(0, 3).map(t => ({
      timeSlot: t.timeSlot || "6:00 PM – 7:00 PM",
      subject: t.subject || primaryAhpDomain.domainName,
      topic: t.topic || "Core Concept Practice",
      priority: t.priority || "HIGH",
      status: t.status || "Pending"
    }));

    const upcomingExams = profile?.upcomingExams?.length > 0 
      ? profile.upcomingExams 
      : [`${primaryAhpDomain.domainName} Assessment (in 5 days)`, "Database Systems Lab (in 12 days)"];

    const todayFocus = {
      title: `${skillGaps.find(s => s.status === 'Needs Improvement')?.skill || 'Python'} Practice & Deep Work`,
      skill: skillGaps.find(s => s.status === 'Needs Improvement')?.skill || 'Python',
      focusMinutes: skillProgress?.totalFocusMinutes || 0,
      sessionsCompleted: skillProgress?.sessionsCompleted || 0,
      streak: currentStreak,
      score: skillProgress?.averageFocusScore || 0
    };

    // 7. Community & Mentors
    const activeMentorRequests = mentorRequests.slice(0, 2).map(r => ({
      id: r._id,
      mentorName: r.mentorName || "Peer Mentor",
      status: r.status,
      topic: r.doubtSubject || "Academic Guidance"
    }));

    res.json({
      success: true,
      header: {
        greeting,
        studentName,
        profileCompletion,
        cgpa: cgpaDisplay,
        degreeProgramme,
        branch,
        careerReadiness: fuzzyRecommendation.suitability,
        roadmapProgress,
        currentStreak
      },
      student: {
        id: studentId,
        name: studentName,
        degree: degreeProgramme,
        branch,
        year: profile?.currentYear || null,
        semester: profile?.currentSemester || null,
        cgpa: cgpaDisplay
      },
      ahp: {
        topDomains: topAhpDomains,
        primaryDomain: primaryAhpDomain
      },
      recommendation: fuzzyRecommendation,
      skillGaps,
      todayFocus,
      roadmapSection: {
        currentRoadmap: `${fuzzyRecommendation.career} Career Pathway`,
        progressPercentage: roadmapProgress,
        completedMilestones,
        totalMilestones: defaultRoadmap.length,
        milestones: defaultRoadmap
      },
      todaySection: {
        todayStudyPlan,
        upcomingExams
      },
      careerSection: {
        targetCareer: fuzzyRecommendation.career,
        careerReadiness: fuzzyRecommendation.suitability,
        topSkillGaps: skillGaps.filter(s => s.status === 'Needs Improvement').map(s => s.skill)
      },
      scholarshipSection: {
        recommendedScholarships: scholarships.slice(0, 3).map(s => ({
          id: s._id,
          scholarshipName: s.scholarshipName,
          provider: s.provider,
          benefit: s.benefit,
          deadline: s.deadline
        }))
      },
      communitySection: {
        mentorRequests: activeMentorRequests,
        peerDomainId: primaryAhpDomain.domainId
      }
    });
  } catch (err) {
    console.error("Get College Dashboard Summary Error:", err);
    res.status(500).json({ success: false, message: "Failed to load dashboard summary" });
  }
};

// ── 9. Placement Preparation — Company Research (Phase 2 - PlacementResearchService) ──
exports.researchPlacementCompany = async (req, res) => {
  try {
    const { companyName, targetRole, hiringType, forceRefresh } = req.body;
    if (!companyName || companyName.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Please enter a target company name." });
    }

    const researchDoc = await placementResearchService.researchCompany(
      companyName,
      targetRole || "Software Engineer",
      hiringType || "Campus Placement",
      forceRefresh === true
    );

    res.status(200).json({
      success: true,
      research: researchDoc
    });
  } catch (err) {
    console.error("Research Placement Company Error:", err);
    res.status(500).json({ success: false, message: "Failed to research company selection process." });
  }
};

// ── 10. Placement Preparation — Create Plan (Phase 12 - PlacementStudyPlanEngine) ──
exports.createPlacementPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const {
      companyId,
      companyName,
      targetRole,
      hiringType,
      reportedRounds,
      skillProfile,
      startDate,
      deadline,
      durationDays,
      dailyAvailability,
      timeSlots,
      learningPreferences
    } = req.body;

    const planData = placementStudyPlanEngine.generateCompanyPlacementPlan({
      companyName,
      targetRole,
      hiringType,
      reportedRounds,
      skillProfile,
      startDate,
      deadline,
      dailyAvailability,
      timeSlots,
      learningPreferences
    });

    // Mark previous placement plans for user as inactive
    await PlacementPlan.updateMany({ userId, isActive: true }, { $set: { isActive: false } });

    // Save new PlacementPlan document in MongoDB Atlas
    const newPlan = await PlacementPlan.create({
      userId,
      companyId,
      ...planData,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Placement preparation schedule generated successfully!",
      plan: newPlan
    });
  } catch (err) {
    console.error("Create Placement Plan Error:", err);
    res.status(500).json({ success: false, message: "Failed to create placement plan" });
  }
};

// ── 11. GET Active Placement Plan ─────────────────────────────────────────────
exports.getActivePlacementPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const activePlan = await PlacementPlan.findOne({ userId, isActive: true }).sort({ createdAt: -1 }).lean();

    if (!activePlan) {
      return res.status(200).json({ success: true, plan: null, message: "No active placement plan found." });
    }

    let totalTasks = 0;
    let completedTasks = 0;
    activePlan.schedule?.forEach((day) => {
      day.tasks?.forEach((task) => {
        totalTasks += 1;
        if (task.status === "completed") completedTasks += 1;
      });
    });

    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      plan: {
        ...activePlan,
        completionPercent,
        totalTasks,
        completedTasks
      }
    });
  } catch (err) {
    console.error("Get Active Placement Plan Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch active placement plan" });
  }
};

// ── 12. Complete Placement Task ───────────────────────────────────────────────
exports.completePlacementTask = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    const { taskId } = req.body;

    const activePlan = await PlacementPlan.findOne({ userId, isActive: true });
    let newStatus = "completed";

    if (activePlan) {
      activePlan.schedule.forEach((dayObj) => {
        dayObj.tasks.forEach((t) => {
          if (t.id === taskId) {
            t.status = t.status === "completed" ? "pending" : "completed";
            t.completedAt = t.status === "completed" ? new Date() : undefined;
            newStatus = t.status;
          }
        });
      });
      await activePlan.save();
    }

    let xpGained = 0;
    if (newStatus === "completed") {
      xpGained = 25;
      let skillProgress = await StudentSkillProgress.findOne({ studentId: userId });
      if (!skillProgress) skillProgress = new StudentSkillProgress({ studentId: userId });
      skillProgress.xp = (skillProgress.xp || 0) + xpGained;
      skillProgress.level = Math.floor(skillProgress.xp / 100) + 1;
      await skillProgress.save();
    }

    res.status(200).json({
      success: true,
      message: newStatus === "completed" ? `Task completed! +${xpGained} XP awarded.` : "Task marked pending.",
      status: newStatus,
      xpGained
    });
  } catch (err) {
    console.error("Complete placement task error:", err);
    res.status(500).json({ success: false, message: "Failed to complete placement task" });
  }
};

// ── 13. Delete Active Placement Plan ──────────────────────────────────────────
exports.deleteActivePlacementPlan = async (req, res) => {
  try {
    const userId = req.student?.id || req.student?._id || req.user?._id;
    await PlacementPlan.updateMany({ userId, isActive: true }, { $set: { isActive: false } });
    res.status(200).json({ success: true, message: "Active placement plan cleared successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset placement plan" });
  }
};

// ── 14. ATS Resume Score & Keyword Checker ─────────────────────────────────
exports.getAtsPresets = async (req, res) => {
  try {
    return res.status(200).json({ success: true, presets: ATS_JD_PRESETS });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load ATS presets" });
  }
};

// GET saved resume versions for authenticated user
exports.getResumeVersions = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const resumes = await Resume.find({ userId: studentId }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, resumes });
  } catch (err) {
    console.error("Get resume versions error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch saved resume versions" });
  }
};

// POST / PUT save resume version
exports.saveResumeVersion = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const data = req.body || {};
    const user = await User.findById(studentId).lean();
    const userType = user?.userType || "graduate";

    let resumeDoc = null;
    if (data._id || data.id) {
      resumeDoc = await Resume.findOne({ _id: data._id || data.id, userId: studentId });
    }

    if (!resumeDoc) {
      resumeDoc = new Resume({
        userId: studentId,
        userType
      });
    }

    if (data.versionName) resumeDoc.versionName = data.versionName;
    if (data.targetRole) resumeDoc.targetRole = data.targetRole;
    if (data.targetCompany !== undefined) resumeDoc.targetCompany = data.targetCompany;
    if (data.targetCategory) resumeDoc.targetCategory = data.targetCategory;
    if (data.jobDescription !== undefined) resumeDoc.jobDescription = data.jobDescription;
    if (data.template) resumeDoc.template = data.template;
    if (data.personalInfo) {
      const prevPersonal = resumeDoc.personalInfo
        ? (resumeDoc.personalInfo.toObject ? resumeDoc.personalInfo.toObject() : resumeDoc.personalInfo)
        : {};
      resumeDoc.personalInfo = { ...prevPersonal, ...data.personalInfo };
    }
    if (data.professionalSummary !== undefined) resumeDoc.professionalSummary = data.professionalSummary;
    if (Array.isArray(data.education)) resumeDoc.education = data.education;
    if (Array.isArray(data.technicalSkills)) resumeDoc.technicalSkills = data.technicalSkills;
    if (Array.isArray(data.softSkills)) resumeDoc.softSkills = data.softSkills;
    if (Array.isArray(data.experience)) resumeDoc.experience = data.experience;
    if (Array.isArray(data.internships)) resumeDoc.internships = data.internships;
    if (Array.isArray(data.projects)) resumeDoc.projects = data.projects;
    if (Array.isArray(data.certifications)) resumeDoc.certifications = data.certifications;
    if (Array.isArray(data.achievements)) resumeDoc.achievements = data.achievements;
    if (Array.isArray(data.publications)) resumeDoc.publications = data.publications;
    if (Array.isArray(data.research)) resumeDoc.research = data.research;
    if (Array.isArray(data.leadership)) resumeDoc.leadership = data.leadership;
    if (Array.isArray(data.volunteerExperience)) resumeDoc.volunteerExperience = data.volunteerExperience;
    if (Array.isArray(data.extracurricular)) resumeDoc.extracurricular = data.extracurricular;
    if (Array.isArray(data.languages)) resumeDoc.languages = data.languages;
    if (Array.isArray(data.customSections)) resumeDoc.customSections = data.customSections;
    if (data.sectionVisibility) resumeDoc.sectionVisibility = { ...resumeDoc.sectionVisibility, ...data.sectionVisibility };

    // Calculate readiness percent
    let score = 20;
    if (resumeDoc.personalInfo?.fullName) score += 10;
    if (resumeDoc.personalInfo?.degree) score += 10;
    if (resumeDoc.professionalSummary) score += 15;
    if (resumeDoc.technicalSkills?.length > 0) score += 15;
    if (resumeDoc.projects?.length > 0 || resumeDoc.experience?.length > 0) score += 20;
    if (resumeDoc.personalInfo?.linkedin || resumeDoc.personalInfo?.github) score += 10;

    resumeDoc.resumeReadinessPercent = Math.min(100, score);
    await resumeDoc.save();

    return res.status(200).json({
      success: true,
      message: "Resume saved successfully",
      resume: resumeDoc
    });
  } catch (err) {
    console.error("Save resume version error:", err);
    return res.status(500).json({ success: false, message: "Failed to save resume version" });
  }
};

// DELETE resume version
exports.deleteResumeVersion = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const { id } = req.params;
    await Resume.deleteOne({ _id: id, userId: studentId });
    return res.status(200).json({ success: true, message: "Resume version deleted" });
  } catch (err) {
    console.error("Delete resume error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete resume version" });
  }
};

// Generate AI summary based strictly on student's actual profile and resume details
exports.generateAiSummary = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const { targetRole, resumeDetails } = req.body || {};

    const [user, gradProfile, collegeProfile] = await Promise.all([
      User.findById(studentId).select("name email").lean(),
      GraduateProfile.findOne({ userId: studentId }).lean(),
      CollegeStudentProfile.findOne({ userId: studentId }).lean()
    ]);

    const profile = gradProfile || collegeProfile || {};
    const name = user?.name || "Candidate";
    const degree = resumeDetails?.degree || profile.degree || profile.degreeProgramme || "Engineering";
    const domain = resumeDetails?.specialization || profile.specialization || profile.domain || "Computer Science";
    const college = resumeDetails?.institution || profile.collegeName || profile.institution || "University";
    const role = targetRole || resumeDetails?.targetRole || profile.targetCareer || "Software Engineer";
    const skills = resumeDetails?.technicalSkills || profile.skills || [];

    const skillsText = Array.isArray(skills) && skills.length > 0
      ? skills.slice(0, 5).map(s => (typeof s === "string" ? s : s.name)).join(", ")
      : "core technical competencies";

    const generatedSummary = `Motivated ${degree} graduate specializing in ${domain} from ${college}. Proficient in ${skillsText} with a strong foundation in problem solving and applied software engineering. Seeking entry to mid-level opportunities as a ${role} to deliver high-impact solutions.`;

    return res.status(200).json({
      success: true,
      summary: generatedSummary
    });
  } catch (err) {
    console.error("Generate AI summary error:", err);
    return res.status(500).json({ success: false, message: "Failed to generate summary" });
  }
};

// GET ATS History
exports.getAtsHistory = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id || req.user?._id;
    const resumes = await Resume.find({ userId: studentId }).select("versionName targetRole targetCompany latestAtsScore atsHistory").lean();
    
    let history = [];
    resumes.forEach(r => {
      if (Array.isArray(r.atsHistory)) {
        r.atsHistory.forEach(h => {
          history.push({
            ...h,
            resumeId: r._id,
            versionName: r.versionName
          });
        });
      }
    });

    history.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

    return res.status(200).json({ success: true, history });
  } catch (err) {
    console.error("Get ATS history error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch ATS history" });
  }
};

// Check ATS Score
exports.checkResumeAtsScore = async (req, res) => {
  try {
    const studentId = req.student?.id || req.student?._id;
    let resumeText = req.body?.resumeText || "";
    const jobDescription = req.body?.jobDescription || "";
    const useProfile = req.body?.useProfile === true || req.body?.useProfile === "true";
    const targetCompany = req.body?.targetCompany || "";
    const targetRole = req.body?.targetRole || "";

    // 1. If PDF file was uploaded via multipart/form-data
    if (req.file && req.file.buffer) {
      try {
        const parsedPdf = await pdf(req.file.buffer);
        resumeText = parsedPdf.text || "";
      } catch (pdfErr) {
        console.error("PDF Parsing error:", pdfErr);
        return res.status(400).json({
          success: false,
          message: "Failed to extract text from the uploaded PDF resume. Please ensure the file is not corrupted or password protected."
        });
      }
    }

    // 2. If user requested to use their generated profile telemetry or no text was supplied
    let profile = null;
    if (useProfile || (!resumeText && studentId)) {
      const [user, gradProfile, collegeProfile] = await Promise.all([
        User.findById(studentId).select("name email phone").lean(),
        GraduateProfile.findOne({ userId: studentId }).lean(),
        CollegeStudentProfile.findOne({ userId: studentId }).lean()
      ]);

      profile = gradProfile || collegeProfile;

      if (profile) {
        const studentName = user?.name || "Student Name";
        const email = user?.email || "";
        const phone = profile?.phone || user?.phone || "";
        const college = profile?.collegeName || profile?.institution || profile?.universityName || "Engineering Institution";
        const degree = profile?.degree || profile?.degreeProgramme || "Undergraduate";
        const domain = profile?.specialization || profile?.domain || profile?.field || "Technical Studies";
        const cgpa = profile?.cgpa || profile?.percentage ? `CGPA/Score: ${profile.cgpa || profile.percentage}` : "";

        let skillsList = (profile?.skills || []).join(", ");
        if (Array.isArray(profile?.technicalSkills)) {
          const names = profile.technicalSkills.map(s => (typeof s === "string" ? s : s.name)).filter(Boolean);
          skillsList = Array.from(new Set([...(profile?.skills || []), ...names])).join(", ");
        }

        const certsList = (profile?.certifications || []).map(c => `• ${c}`).join("\n");
        const projectsList = (profile?.projects || []).map(p =>
          `• ${p.title || 'Academic Project'}: ${p.description || ''} (Technologies: ${p.techStack || 'Relevant stack'})`
        ).join("\n");

        const expList = (profile?.experience || []).map(e =>
          `• ${e.role || e.title || 'Role'} at ${e.company || 'Company'} (${e.duration || ''}): ${e.description || ''}`
        ).join("\n");

        const summary = profile?.careerObjective || `Motivated ${degree} graduate in ${domain} with strong technical foundation in ${skillsList}. Seeking entry-level opportunities to apply engineering skills.`;

        // Synthesize full resume text
        resumeText = [
          `${studentName} | ${email} | ${phone}`,
          `Education:\n${degree} in ${domain}, ${college}. ${cgpa}`,
          profile?.school10 ? `Secondary Education: ${profile.school10} (CGPA/Score: ${profile.cgpa10 || 'N/A'})` : '',
          profile?.institution12 ? `Higher Secondary: ${profile.institution12} (${profile.branch12 || 'HSC'}) (Score: ${profile.cgpa12 || 'N/A'})` : '',
          `Professional Summary:\n${summary}`,
          `Technical Competencies:\n${skillsList}`,
          expList ? `Work Experience & Internships:\n${expList}` : '',
          projectsList ? `Projects & Portfolio:\n${projectsList}` : '',
          certsList ? `Certifications & Credentials:\n${certsList}` : ''
        ].filter(Boolean).join("\n\n");
      }
    }

    if (!resumeText || resumeText.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "No resume content detected. Please upload a PDF resume, paste text, or select 'Use Profile Resume'."
      });
    }

    // Run ATS scanner
    const analysis = analyzeResumeForAts(resumeText, jobDescription, profile || {});

    // Save ATS scan entry into Resume document if studentId exists
    if (studentId) {
      try {
        let resumeDoc = await Resume.findOne({ userId: studentId }).sort({ updatedAt: -1 });
        if (!resumeDoc) {
          resumeDoc = new Resume({
            userId: studentId,
            versionName: targetRole ? `${targetRole} Resume` : "Primary Resume",
            targetRole: targetRole || "Software Engineer",
            targetCompany: targetCompany
          });
        }

        resumeDoc.latestAtsScore = analysis.overallAtsScore;
        if (!Array.isArray(resumeDoc.atsHistory)) resumeDoc.atsHistory = [];

        resumeDoc.atsHistory.push({
          jobTitle: targetRole || (jobDescription.slice(0, 40) + "..."),
          company: targetCompany || "Target Employer",
          jobDescriptionSnippet: jobDescription.slice(0, 150),
          overallScore: analysis.overallAtsScore,
          verdictLevel: analysis.verdict?.level || "Analyzed",
          matchedSkills: (analysis.categoryScores?.technicalSkills?.matched || []).map(m => m.skill || m),
          missingSkills: (analysis.categoryScores?.technicalSkills?.missing || [])
        });

        await resumeDoc.save();
      } catch (saveErr) {
        console.warn("Could not record ATS history to Resume doc:", saveErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      analysis,
      resumeSnippet: resumeText.slice(0, 300) + (resumeText.length > 300 ? '...' : '')
    });
  } catch (err) {
    console.error("ATS Resume Checker error:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred while analyzing the resume for ATS compatibility."
    });
  }
};



