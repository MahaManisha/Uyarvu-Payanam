const AhpFuzzyQuestion = require("../models/AhpFuzzyQuestion");
const AhpFuzzyResult = require("../models/AhpFuzzyResult");
const AhpCareerProfile = require("../models/AhpCareerProfile");
const CollegeStudentProfile = require("../models/CollegeStudentProfile");
const { evaluateAdaptiveFuzzy } = require("../utils/ahpFuzzyEngine");
const { seedCseCareerDiscoveryQuestions } = require("../seeders/seedCseCareerDiscoveryQuestions");
const { NORMALIZED_DOMAINS } = require("../config/domainMappingConfig");

// Sanitize question document before sending to frontend (Section 21 Security Rule)
const sanitizeQuestionForClient = (qDoc, clientBranch) => {
  const q = qDoc.toObject ? qDoc.toObject() : qDoc;

  const sanitizedOptions = (q.options || []).map((opt, idx) => ({
    id: opt.id || opt.optionId || String.fromCharCode(65 + idx),
    text: opt.text
  }));

  return {
    _id: q._id,
    questionId: q.questionId,
    branch: clientBranch || q.branch || "CSE",
    domainId: q.domainId || q.domain,
    domainName: q.domainName || q.category || q.domain,
    difficulty: q.difficulty,
    questionText: q.questionText,
    questionType: q.questionType || "scenario",
    options: sanitizedOptions,
    skillDimensions: q.skillDimensions || q.skillVariables || [],
    xp: q.xp || (q.difficulty === "easy" ? 10 : q.difficulty === "medium" ? 20 : 30),
    active: q.active !== undefined ? q.active : true
  };
};

const DOMAIN_ALIAS_MAP = {
  // CSE Domains & Aliases
  'full_stack': 'full_stack',
  'Full Stack & Software Engineering': 'full_stack',
  'Full Stack Web & Mobile Development': 'full_stack',
  'software_engineering': 'software_engineering',
  'Software Engineering & Architecture': 'software_engineering',
  'ai_ml': 'ai_ml',
  'AI & Machine Learning': 'ai_ml',
  'Artificial Intelligence & Machine Learning': 'ai_ml',
  'data_science': 'data_science',
  'Data Science & Big Data Analytics': 'data_science',
  'cyber_security': 'cyber_security',
  'Cyber Security & Ethical Hacking': 'cyber_security',
  'cloud_devops': 'cloud_devops',
  'Cloud Computing & DevOps': 'cloud_devops',
  'algorithms_systems': 'algorithms_systems',
  'Algorithms & System Programming': 'algorithms_systems',

  // 17 B.E. ECE Domains & Aliases
  'vlsi_chip_design': 'vlsi_chip_design',
  'VLSI & Chip Design': 'vlsi_chip_design',
  'vlsi_design': 'vlsi_chip_design',
  'VLSI & Semiconductor Chip Design': 'vlsi_chip_design',
  'embedded_systems': 'embedded_systems',
  'Embedded Systems': 'embedded_systems',
  'Embedded Systems & Microcontrollers': 'embedded_systems',
  'embedded_iot': 'embedded_systems',
  'Embedded Systems & IoT': 'embedded_systems',
  'iot': 'iot',
  'IoT': 'iot',
  'IoT & Smart Sensor Systems': 'iot',
  'communication_telecom': 'communication_telecom',
  'Communication / Telecom': 'communication_telecom',
  'Communication/Telecom': 'communication_telecom',
  'Wireless Communication & 5G/6G Networks': 'communication_telecom',
  'rf_microwave': 'rf_microwave',
  'RF & Microwave': 'rf_microwave',
  'RF & Microwave Engineering': 'rf_microwave',
  'signal_processing': 'signal_processing',
  'Signal Processing': 'signal_processing',
  'Signal Processing & Image Analysis': 'signal_processing',
  'image_processing_cv': 'image_processing_cv',
  'Image Processing / Computer Vision': 'image_processing_cv',
  'Image Processing/Computer Vision': 'image_processing_cv',
  'automation_control': 'automation_control',
  'Automation & Control': 'automation_control',
  'robotics': 'robotics',
  'Robotics': 'robotics',
  'robotics_automation': 'robotics',
  'Robotics & Automation Engineering': 'robotics',
  'hardware_pcb_design': 'hardware_pcb_design',
  'Hardware / PCB Design': 'hardware_pcb_design',
  'Hardware/PCB Design': 'hardware_pcb_design',
  'automotive_electronics': 'automotive_electronics',
  'Automotive Electronics': 'automotive_electronics',
  'power_electronics': 'power_electronics',
  'Power Electronics': 'power_electronics',
  'medical_electronics': 'medical_electronics',
  'Medical Electronics': 'medical_electronics',
  'satellite_aerospace_avionics': 'satellite_aerospace_avionics',
  'Satellite / Aerospace / Avionics': 'satellite_aerospace_avionics',
  'Satellite/Aerospace/Avionics': 'satellite_aerospace_avionics',
  'semiconductor_testing': 'semiconductor_testing',
  'Semiconductor Testing': 'semiconductor_testing',
  'aiml_ece': 'aiml_ece',
  'AI / ML for ECE': 'aiml_ece',
  'AI/ML for ECE': 'aiml_ece',
  'software_it': 'software_it',
  'Software / IT': 'software_it',
  'Software/IT': 'software_it',

  // Other Core Engineering Mappings
  'ev_powertrain': 'ev_powertrain',
  'Electric Vehicle & Power Systems': 'ev_powertrain',
  'cad_structural': 'cad_structural',
  'CAD Modeling & Structural Engineering': 'cad_structural'
};

// GET /api/onboarding/discovery/questions & POST /api/assessment/start
const getAhpFuzzyQuestions = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?.id || req.user?._id;
    const { branch, domains, domainId, difficulty, limit } = req.query;
    const bodyDomains = req.body?.domains || req.body?.domainIds;

    // 1. Ensure seedPdfMasterQuestionBank is populated in MongoDB (105 CSE + 255 ECE = 360 total)
    const { seedPdfMasterQuestionBank } = require("../seeders/seedPdfMasterQuestionBank");
    const countTotal = await AhpFuzzyQuestion.countDocuments({ source: "master-question-bank-pdf", active: true });
    if (countTotal < 360) {
      await seedPdfMasterQuestionBank();
    }

    // Resolve branch strictly based on parameter, body, or logged-in student profile
    let rawBranch = branch || req.body?.branch;
    if (!rawBranch && userId) {
      const studentProfile = await CollegeStudentProfile.findOne({ userId });
      if (studentProfile && studentProfile.domain) {
        rawBranch = studentProfile.domain;
      } else {
        const ahpProfile = await AhpCareerProfile.findOne({ userId });
        if (ahpProfile && ahpProfile.branchId) {
          rawBranch = ahpProfile.branchId;
        }
      }
    }

    const branchStr = (rawBranch || "CSE").toString().toLowerCase();
    const isECE = branchStr.includes("ece") || branchStr.includes("electronics") || branchStr.includes("communication");
    const isIT = branchStr.includes("it (") || branchStr === "it" || branchStr.includes("information technology");
    const isAIDS = branchStr.includes("ai & ds") || branchStr.includes("artificial intelligence") || branchStr.includes("aids");
    const normalizedBranch = isECE ? "ECE" : (isIT ? "IT" : (isAIDS ? "AI & DS" : "CSE"));
    // Strict branch isolation: ECE students get ONLY ECE questions; Computing students (CSE, IT, AI & DS) access the unified 7-domain question pool
    const branchFilter = isECE ? { $in: ["ECE", "ece"] } : { $in: ["CSE", "cse", "IT", "it", "AI & DS", "ai & ds", "AIDS", "aids"] };

    console.log("[DISCOVERY API] rawBranch:", rawBranch, "normalizedBranch:", normalizedBranch);
    console.log("[DISCOVERY API] userId:", userId || "guest");

    // 2. STEP 1 & STEP 2: Determine Top 3 Ranked Domains from AHP prediction or query parameters
    let rankedDomains = [];

    // Priority A: Explicit domain query or body parameters (if user requested specific preview)
    const rawDomainsInput = domains || domainId || bodyDomains;
    if (rawDomainsInput) {
      let domainList = [];
      if (Array.isArray(rawDomainsInput)) domainList = rawDomainsInput;
      else if (typeof rawDomainsInput === "string") domainList = rawDomainsInput.split(",").map(s => s.trim()).filter(Boolean);

      domainList.forEach((rawD, idx) => {
        const canonicalId = DOMAIN_ALIAS_MAP[rawD] || rawD;
        if (!DOMAIN_ALIAS_MAP[rawD]) {
          console.warn(`[AHP-DISCOVERY] Domain alias mapping warning: "${rawD}" unmapped.`);
        }
        const normMeta = NORMALIZED_DOMAINS[canonicalId] || { name: rawD.replace(/_/g, " ") };
        rankedDomains.push({
          domainId: canonicalId,
          domainName: normMeta.name || rawD.replace(/_/g, " "),
          rank: idx + 1,
          ahpScore: Number((1.0 - (idx * 0.1)).toFixed(2))
        });
      });
    }

    // Priority B: Authenticated student's saved AHP profile from Step 5
    if (rankedDomains.length === 0 && userId) {
      const ahpProfile = await AhpCareerProfile.findOne({ userId });
      if (ahpProfile) {
        const candidateList = ahpProfile.candidateDomainsForStep6 || ahpProfile.candidateDomains || [];
        if (candidateList.length > 0) {
          // Sort by AHP priority weight descending
          const sortedCandidates = [...candidateList].sort((a, b) => (b.weight || b.score || 0) - (a.weight || a.score || 0));
          sortedCandidates.slice(0, 3).forEach((cand, idx) => {
            const domainKey = cand.id || cand.domainId || cand.name || cand.domainName;
            const canonicalId = DOMAIN_ALIAS_MAP[domainKey] || domainKey;
            const normMeta = NORMALIZED_DOMAINS[canonicalId] || {};
            rankedDomains.push({
              domainId: canonicalId,
              domainName: cand.name || cand.domainName || normMeta.name || canonicalId,
              rank: idx + 1,
              ahpScore: Number((cand.weight || cand.score || 0.8 - (idx * 0.1)).toFixed(4))
            });
          });
        } else if (ahpProfile.topDomain) {
          const topList = [ahpProfile.topDomain, ahpProfile.secondDomain, ahpProfile.thirdDomain].filter(Boolean);
          topList.forEach((cand, idx) => {
            const domainKey = cand.id || cand.domainId || cand.name || cand.domainName;
            const canonicalId = DOMAIN_ALIAS_MAP[domainKey] || domainKey;
            const normMeta = NORMALIZED_DOMAINS[canonicalId] || {};
            rankedDomains.push({
              domainId: canonicalId,
              domainName: cand.name || cand.domainName || normMeta.name || canonicalId,
              rank: idx + 1,
              ahpScore: Number((cand.weight || 0.8 - (idx * 0.1)).toFixed(4))
            });
          });
        }
      }
    }

    // Priority C: Fallback default Top 3 domains in AHP order tailored specifically to selected branch
    if (rankedDomains.length === 0) {
      if (isECE) {
        rankedDomains = [
          { domainId: "vlsi_chip_design", domainName: "VLSI & Chip Design", rank: 1, ahpScore: 0.40 },
          { domainId: "embedded_systems", domainName: "Embedded Systems", rank: 2, ahpScore: 0.35 },
          { domainId: "iot", domainName: "IoT", rank: 3, ahpScore: 0.25 }
        ];
      } else {
        rankedDomains = [
          { domainId: "software_engineering", domainName: "Software Engineering & Architecture", rank: 1, ahpScore: 0.40 },
          { domainId: "ai_ml", domainName: "Artificial Intelligence & Machine Learning", rank: 2, ahpScore: 0.35 },
          { domainId: "cloud_devops", domainName: "Cloud Computing & DevOps", rank: 3, ahpScore: 0.25 }
        ];
      }
    }

    // Take strictly the TOP 3 domains according to AHP ranking
    const top3Domains = rankedDomains.slice(0, 3);
    console.log("[AHP-DISCOVERY] TOP 3 AHP RANKED DOMAINS:", top3Domains.map(d => `${d.rank}. ${d.domainName} (${d.domainId})`));

    // 3. STEP 3 & STEP 5 & STEP 7: Query SeedMaster (AhpFuzzyQuestion) in EXACT AHP Domain Rank Order
    const QUESTIONS_PER_DOMAIN = parseInt(process.env.QUESTIONS_PER_DOMAIN || "5", 10);
    const selectedQuestions = [];

    for (let domainIdx = 0; domainIdx < top3Domains.length; domainIdx++) {
      const dObj = top3Domains[domainIdx];
      const canonicalId = dObj.domainId;

      // Query SeedMaster for questions belonging to this domain
      let domainQuestions = await AhpFuzzyQuestion.find({
        branch: branchFilter,
        source: "master-question-bank-pdf",
        $or: [
          { domainId: canonicalId },
          { domain: canonicalId },
          { domainName: new RegExp(canonicalId.replace(/_/g, " "), "i") }
        ],
        active: true
      });

      const easyQs = domainQuestions.filter(q => (q.difficulty || "").toLowerCase() === "easy");
      const medQs = domainQuestions.filter(q => (q.difficulty || "").toLowerCase() === "medium");
      const hardQs = domainQuestions.filter(q => (q.difficulty || "").toLowerCase() === "hard");

      let easyTarget = 2;
      let medTarget = 2;
      let hardTarget = 1;

      if (domainIdx === 1) {
        easyTarget = 2;
        medTarget = 1;
        hardTarget = 2;
      } else if (domainIdx === 2) {
        easyTarget = 1;
        medTarget = 2;
        hardTarget = 2;
      }

      const pickedEasy = easyQs.slice(0, easyTarget);
      const pickedMed = medQs.slice(0, medTarget);
      const pickedHard = hardQs.slice(0, hardTarget);

      let chosenForDomain = [...pickedEasy, ...pickedMed, ...pickedHard];

      // Fallback search if domain has fewer than QUESTIONS_PER_DOMAIN
      if (chosenForDomain.length < QUESTIONS_PER_DOMAIN) {
        const chosenIds = new Set(chosenForDomain.map(q => q._id.toString()));
        const remaining = domainQuestions.filter(q => !chosenIds.has(q._id.toString()));
        chosenForDomain = [...chosenForDomain, ...remaining.slice(0, QUESTIONS_PER_DOMAIN - chosenForDomain.length)];
      }

      // Sanitize questions (STEP 9: Hide correctOption from client payload)
      selectedQuestions.push(...chosenForDomain.map(q => sanitizeQuestionForClient(q, normalizedBranch)));
    }

    const assessmentId = `sess_${userId ? userId.toString() : "guest"}_${Date.now()}`;

    const easyCount = selectedQuestions.filter(q => q.difficulty === "easy").length;
    const mediumCount = selectedQuestions.filter(q => q.difficulty === "medium").length;
    const hardCount = selectedQuestions.filter(q => q.difficulty === "hard").length;

    res.status(200).json({
      success: true,
      assessmentId,
      domains: top3Domains,
      count: selectedQuestions.length,
      difficultyBreakdown: {
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount
      },
      candidateDomains: top3Domains.map(d => d.domainId),
      questions: selectedQuestions
    });
  } catch (error) {
    console.error("Get Discovery Questions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch discovery questions" });
  }
};

// POST /api/onboarding/discovery/answer & /api/onboarding/discovery/evaluate
const evaluateStudentAssessment = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?.id || req.user?._id;
    const { answers, answer, questionId, selectedOption, optionId, ahpPriorityWeights, behavioralSignals, validateOnly, requiredQuestionIds } = req.body;

    let userAnswers = [];

    if (Array.isArray(answers)) {
      userAnswers = answers;
    } else if (answer || (questionId && (selectedOption || optionId))) {
      userAnswers = [{
        questionId: questionId || answer.questionId,
        selectedOption: selectedOption || optionId || answer.selectedOption || answer.optionId,
        optionId: selectedOption || optionId || answer.selectedOption || answer.optionId
      }];
    }

    if (userAnswers.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide student answers for evaluation." });
    }

    // ── BACKEND VALIDATION: Check all required questions have been answered ───
    if (Array.isArray(requiredQuestionIds) && requiredQuestionIds.length > 0) {
      const answeredIds = new Set(userAnswers.map(a => a.questionId || a._id).filter(Boolean));
      const unansweredQuestionIds = requiredQuestionIds.filter(qId => !answeredIds.has(qId));

      if (unansweredQuestionIds.length > 0) {
        return res.status(422).json({
          success: false,
          code: "INCOMPLETE_ASSESSMENT",
          message: `Please answer all ${requiredQuestionIds.length} questions before submitting. ${unansweredQuestionIds.length} question(s) unanswered.`,
          unansweredQuestionIds,
          answeredCount: answeredIds.size,
          totalRequired: requiredQuestionIds.length
        });
      }
    }

    // If validateOnly flag, just confirm all questions answered without running fuzzy eval
    if (validateOnly) {
      return res.status(200).json({
        success: true,
        message: "All required questions answered. Ready for evaluation.",
        answeredCount: userAnswers.length
      });
    }

    const mongoose = require("mongoose");
    const rawQuestionIds = userAnswers.map(a => a.questionId || a._id).filter(Boolean);
    const validObjectIds = rawQuestionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const stringQuestionIds = rawQuestionIds.map(id => String(id));

    const orConditions = [
      { questionId: { $in: stringQuestionIds } },
      { domainId: { $in: stringQuestionIds } }
    ];
    if (validObjectIds.length > 0) {
      orConditions.push({ _id: { $in: validObjectIds } });
    }

    const questions = await AhpFuzzyQuestion.find({ $or: orConditions });

    // Check if user has an existing AHP Profile to get authentic AHP priority weights & candidate domains for Step 6
    let effectiveAhpWeights = ahpPriorityWeights || {};
    let step6CandidateDomains = [];
    if (userId) {
      const ahpProfile = await AhpCareerProfile.findOne({ userId });
      if (ahpProfile) {
        if (Object.keys(effectiveAhpWeights).length === 0 && ahpProfile.priorityWeights) {
          effectiveAhpWeights = ahpProfile.priorityWeights;
        }
        if (Array.isArray(ahpProfile.candidateDomainsForStep6) && ahpProfile.candidateDomainsForStep6.length > 0) {
          step6CandidateDomains = ahpProfile.candidateDomainsForStep6.map(d => d.id || d.domainId || d.name).filter(Boolean);
        }
      }
    }

    const evaluation = evaluateAdaptiveFuzzy({
      userAnswers,
      questions,
      ahpPriorityWeights: effectiveAhpWeights,
      behavioralSignals: behavioralSignals || {},
      candidateDomains: step6CandidateDomains.length > 0 ? step6CandidateDomains : undefined
    });

    const isAssessmentCompleted = userAnswers.length >= 15 || (Array.isArray(requiredQuestionIds) && userAnswers.length >= requiredQuestionIds.length);

    let savedResult = null;

    // PART 11 & PART 13: If assessment is evaluated and user logged in, persist the recommendation
    if (userId && evaluation.recommendedDomain) {
      const isEceAssessed = questions.some(q => q.branch === "ECE");
      const detectedBranch = isEceAssessed ? "ECE" : (rawBranch || "CSE");
      const resultData = {
        userId,
        studentId: userId.toString(),
        branch: detectedBranch,
        ahpCandidates: evaluation.ahpCandidates,
        fuzzyScores: evaluation.fuzzyScores,
        finalScores: evaluation.finalScores,
        rankings: evaluation.rankings,
        recommendedDomain: evaluation.recommendedDomain,
        confidenceLevel: evaluation.confidenceLevel,
        scoreDiff: evaluation.scoreDiff,
        strongDimensions: evaluation.strongSkillSignals,
        totalQuestionsAnswered: userAnswers.length,
        assessmentCompleted: true,
        answers: userAnswers,
        completedAt: new Date()
      };

      savedResult = await AhpFuzzyResult.findOneAndUpdate(
        { userId },
        resultData,
        { upsert: true, new: true }
      );

      // PART 15: Update CollegeStudentProfile so dashboard & profile use recommendedDomain
      await CollegeStudentProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            domain: evaluation.recommendedDomain.domainName,
            specialization: evaluation.recommendedDomain.domainName,
            targetCareer: evaluation.recommendedDomain.domainName,
            isCompleted: true,
            currentStep: 7
          }
        },
        { upsert: true, new: true }
      );

      try {
        const User = require("../models/User");
        await User.findByIdAndUpdate(userId, {
          $set: {
            domain: evaluation.recommendedDomain.domainName,
            targetCareer: evaluation.recommendedDomain.domainName
          }
        });
      } catch (e) {
        console.warn("User domain update notice:", e.message);
      }
    }

    res.status(200).json({
      success: true,
      assessmentCompleted: isAssessmentCompleted,
      answeredCount: userAnswers.length,
      totalQuestions: 15,
      evaluation,
      savedResult
    });
  } catch (error) {
    console.error("Evaluate Discovery Questions error:", error);
    res.status(500).json({ success: false, message: "Fuzzy evaluation error" });
  }
};

// GET /api/onboarding/discovery/result (PART 12)
const getDiscoveryResult = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Student token missing." });
    }

    // Search for saved AhpFuzzyResult first
    let result = await AhpFuzzyResult.findOne({ userId });

    if (!result) {
      // Fallback: check if AHP profile exists to generate/preview result
      const ahpProfile = await AhpCareerProfile.findOne({ userId });
      const studentProfile = await CollegeStudentProfile.findOne({ userId });

      if (ahpProfile && ahpProfile.topDomain) {
        const topD = ahpProfile.topDomain;
        const candidateDomains = ahpProfile.candidateDomainsForStep6 || ahpProfile.candidateDomains || [];

        const ahpCandidates = candidateDomains.map(d => ({
          domainId: d.id,
          domainName: d.name,
          score: Number((d.weight || d.scorePercent / 100 || 0.5).toFixed(4))
        }));

        const studentBranchRaw = studentProfile?.domain || ahpProfile?.branchId || "CSE";
        const isEceStudent = /ece|electronics|communication/i.test(studentBranchRaw);
        const detectedBranch = isEceStudent ? "ECE" : studentBranchRaw;

        result = {
          userId,
          studentId: userId.toString(),
          branch: detectedBranch,
          ahpCandidates,
          fuzzyScores: ahpCandidates.map(c => ({ ...c, score: Number((c.score * 0.9).toFixed(4)) })),
          finalScores: ahpCandidates.map(c => ({ ...c, score: Number((c.score).toFixed(4)) })),
          recommendedDomain: {
            domainId: topD.id,
            domainName: topD.name,
            score: Number((topD.weight || topD.scorePercent / 100 || 0.75).toFixed(4)),
            category: topD.category || "CSE Specialization",
            icon: topD.icon || "🧠"
          },
          confidenceLevel: "high",
          scoreDiff: 0.15,
          strongDimensions: ["Problem Solving", "Analytical Thinking", "Technical Aptitude"],
          assessmentCompleted: studentProfile ? (studentProfile.isCompleted || studentProfile.currentStep >= 6) : false,
          completedAt: ahpProfile.completedAt || new Date()
        };
      } else {
        return res.status(404).json({
          success: false,
          message: "No career discovery result found. Please complete the assessment."
        });
      }
    }

    const rankings = result.rankings || result.finalScores || [];
    const sortedRankings = [...rankings].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Ensure strictly the top 3 candidate domains evaluated for Step 6 are returned
    const topRankings = sortedRankings.slice(0, 3);
    const topAhpCandidates = (result.ahpCandidates || []).slice(0, 3);
    const topFuzzyScores = (result.fuzzyScores || []).slice(0, 3);
    const topFinalScores = (result.finalScores || []).slice(0, 3);

    res.status(200).json({
      success: true,
      assessmentCompleted: result.assessmentCompleted !== false,
      recommendedDomain: result.recommendedDomain,
      rankings: topRankings,
      ahpCandidates: topAhpCandidates,
      fuzzyScores: topFuzzyScores,
      finalScores: topFinalScores,
      confidenceLevel: result.confidenceLevel || "high",
      scoreDiff: result.scoreDiff || 0,
      strongDimensions: result.strongDimensions || [],
      completedAt: result.completedAt
    });
  } catch (error) {
    console.error("Get Discovery Result error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch discovery result" });
  }
};

// POST /api/question-bank/import or /api/onboarding/discovery/import-pdf
const importQuestionBankPdf = async (req, res) => {
  try {
    const { questions } = req.body;
    let questionsToImport = [];

    if (Array.isArray(questions) && questions.length > 0) {
      questionsToImport = questions;
    } else {
      const { PDF_MASTER_QUESTION_BANK } = require("../seeders/seedPdfMasterQuestionBank");
      questionsToImport = PDF_MASTER_QUESTION_BANK;
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const q of questionsToImport) {
      if (!q.questionText || !q.options || (!q.domainId && !q.domain)) {
        failed++;
        errors.push({ questionId: q.questionId || "UNKNOWN", reason: "Missing required fields (questionText, options, domainId)" });
        continue;
      }

      const domainKey = q.domainId || q.domain || "general";
      const qDoc = {
        questionId: q.questionId || `q_${domainKey}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        branch: q.branch || "CSE",
        domainId: domainKey,
        domainName: q.domainName || domainKey,
        domain: domainKey,
        difficulty: (q.difficulty || "medium").toLowerCase(),
        questionType: q.questionType || "scenario",
        questionText: q.questionText,
        options: (q.options || []).map(opt => ({
          id: opt.id || opt.optionId || "A",
          optionId: opt.id || opt.optionId || "A",
          text: opt.text
        })),
        correctOption: q.correctOption || q.correctAnswer || "A",
        explanation: q.explanation || "",
        skillDimensions: q.skillDimensions || ["analytical_thinking"],
        source: "master-question-bank-pdf",
        active: true
      };

      const result = await AhpFuzzyQuestion.updateOne(
        { questionId: qDoc.questionId },
        { $set: qDoc },
        { upsert: true }
      );

      const isNew = result.upsertedId !== null && result.upsertedId !== undefined;
      if (isNew) inserted++;
      else updated++;
    }

    res.status(200).json({
      success: true,
      totalQuestions: questionsToImport.length,
      inserted,
      updated,
      failed,
      errors
    });
  } catch (error) {
    console.error("Import Question Bank PDF error:", error);
    res.status(500).json({ success: false, message: "PDF import failed" });
  }
};

module.exports = {
  getAhpFuzzyQuestions,
  evaluateStudentAssessment,
  getDiscoveryResult,
  importQuestionBankPdf
};
