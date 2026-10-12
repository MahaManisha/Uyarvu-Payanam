const CollegeStudentProfile = require("../models/CollegeStudentProfile");
const User = require("../models/User");
const COLLEGE_FIELDS_DATA = require("../config/collegeFieldsData");
const AhpCareerProfile = require("../models/AhpCareerProfile");
const AhpFuzzyResult = require("../models/AhpFuzzyResult");
const StudentSkillProgress = require("../models/StudentSkillProgress");
const StudentTestResult = require("../models/StudentTestResult");
const SavedItem = require("../models/SavedItem");
const CollegeCareerCatalog = require("../models/CollegeCareerCatalog");
const StudentProfile = require("../models/StudentProfile");

// ── Get Metadata (Fields, Degrees, Domains, Certifications) ──────────────────
const getMetadata = (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: COLLEGE_FIELDS_DATA
    });
  } catch (error) {
    console.error("Get college metadata error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch metadata" });
  }
};

// ── Get Current Student Profile ───────────────────────────────────────────────
const getMyProfile = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let profile = await CollegeStudentProfile.findOne({ userId });
    
    if (!profile) {
      // Create empty draft profile if not found
      profile = new CollegeStudentProfile({
        userId,
        currentStep: 1,
        profileCompletion: 0,
        isCompleted: false
      });
      await profile.save();
    }

    res.status(200).json({
      success: true,
      profile
    });
  } catch (error) {
    console.error("Get my college profile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Save / Update College Profile Step ───────────────────────────────────────
const saveProfile = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      institution,
      institutionDistrict,
      currentYear,
      studyMode,
      field,
      degreeProgramme,
      domain,
      specialization,
      certifications,
      academicInterests,
      careerInterests,
      skills,
      strengths,
      // ── New fields (Task 02 & Gradious Reference Profile) ──
      currentSemester,
      cgpa,
      subjects,
      targetCareer,
      completedCourses,
      projects,
      phone,
      // Personal Info
      firstName,
      lastName,
      dob,
      address,
      profilePhoto,
      introVideo,
      careerObjective,
      // Parent Info
      parentName,
      parentPhone,
      parentOccupation,
      parentEmail,
      // Class 10
      school10,
      cgpa10,
      startDate10,
      endDate10,
      // Class 12 / Diploma
      institution12,
      cgpa12,
      branch12,
      startDate12,
      endDate12,
      isDiploma,
      // UG Dates
      startDateUg,
      endDateUg,
      // Achievements & Social
      achievements,
      socialProfiles,
      // ── Wizard tracking ──
      currentStep,
      isFinalStep
    } = req.body;

    let profile = await CollegeStudentProfile.findOne({ userId });

    if (!profile) {
      profile = new CollegeStudentProfile({ userId });
    }

    // Update existing fields if provided
    if (institution !== undefined) profile.institution = institution;
    if (institutionDistrict !== undefined) profile.institutionDistrict = institutionDistrict;
    if (currentYear !== undefined && currentYear.trim() !== '') profile.currentYear = currentYear;
    if (studyMode !== undefined) profile.studyMode = studyMode;
    if (field !== undefined) profile.field = field;
    if (degreeProgramme !== undefined) profile.degreeProgramme = degreeProgramme;
    if (domain !== undefined) profile.domain = domain;
    if (specialization !== undefined) profile.specialization = specialization;
    if (certifications !== undefined) profile.certifications = certifications;
    if (academicInterests !== undefined) profile.academicInterests = academicInterests;
    if (careerInterests !== undefined) profile.careerInterests = careerInterests;
    if (skills !== undefined) profile.skills = skills;
    if (strengths !== undefined) profile.strengths = strengths;

    // Update new fields (Task 02)
    if (currentSemester !== undefined && currentSemester.trim() !== '') profile.currentSemester = currentSemester;
    if (cgpa !== undefined) profile.cgpa = cgpa;
    if (subjects !== undefined) profile.subjects = subjects;
    if (targetCareer !== undefined) profile.targetCareer = targetCareer;
    if (completedCourses !== undefined) profile.completedCourses = completedCourses;
    if (projects !== undefined) profile.projects = projects;
    if (phone !== undefined) profile.phone = phone;

    // Personal Info
    if (firstName !== undefined) profile.firstName = firstName;
    if (lastName !== undefined) profile.lastName = lastName;
    if (dob !== undefined) profile.dob = dob;
    if (address !== undefined) profile.address = address;
    if (profilePhoto !== undefined) profile.profilePhoto = profilePhoto;
    if (introVideo !== undefined) profile.introVideo = introVideo;
    if (careerObjective !== undefined) profile.careerObjective = careerObjective;

    // Parent Info
    if (parentName !== undefined) profile.parentName = parentName;
    if (parentPhone !== undefined) profile.parentPhone = parentPhone;
    if (parentOccupation !== undefined) profile.parentOccupation = parentOccupation;
    if (parentEmail !== undefined) profile.parentEmail = parentEmail;

    // Class 10
    if (school10 !== undefined) profile.school10 = school10;
    if (cgpa10 !== undefined) profile.cgpa10 = cgpa10;
    if (startDate10 !== undefined) profile.startDate10 = startDate10;
    if (endDate10 !== undefined) profile.endDate10 = endDate10;

    // Class 12 / Diploma
    if (institution12 !== undefined) profile.institution12 = institution12;
    if (cgpa12 !== undefined) profile.cgpa12 = cgpa12;
    if (branch12 !== undefined) profile.branch12 = branch12;
    if (startDate12 !== undefined) profile.startDate12 = startDate12;
    if (endDate12 !== undefined) profile.endDate12 = endDate12;
    if (isDiploma !== undefined) profile.isDiploma = isDiploma;

    // UG Dates
    if (startDateUg !== undefined) profile.startDateUg = startDateUg;
    if (endDateUg !== undefined) profile.endDateUg = endDateUg;

    // Achievements & Social
    if (achievements !== undefined) profile.achievements = achievements;
    if (socialProfiles !== undefined) {
      profile.socialProfiles = { ...profile.socialProfiles, ...socialProfiles };
    }

    if (currentStep !== undefined) {
      profile.currentStep = Math.max(profile.currentStep, currentStep);
    }

    // ── Richer Completion Percentage (weighted across all fields) ──
    profile.profileCompletion = calculateProfileCompletion(profile);

    if (isFinalStep || profile.profileCompletion >= 85) {
      profile.isCompleted = true;
      // Mark onboarding completed and ensure userType is college_student on User document
      await User.findByIdAndUpdate(userId, { onboardingCompleted: true, userType: "college_student" });
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "College profile saved successfully",
      profile
    });
  } catch (error) {
    console.error("Save college profile error:", error);
    res.status(500).json({ success: false, message: "Failed to save profile" });
  }
};

// ── Partial Update (Patch) — For modules to update individual fields ──────────
const patchProfile = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Whitelist of patchable fields
    const PATCHABLE = [
      "currentSemester", "cgpa", "subjects", "targetCareer",
      "completedCourses", "projects", "phone", "skills", "strengths",
      "certifications", "academicInterests", "careerInterests",
      "grokAssessmentScore", "grokAssessmentResults"
    ];

    let profile = await CollegeStudentProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found. Complete onboarding first." });
    }

    // Apply only whitelisted fields
    for (const key of PATCHABLE) {
      if (req.body[key] !== undefined) {
        profile[key] = req.body[key];
      }
    }

    // Recalculate completion
    profile.profileCompletion = calculateProfileCompletion(profile);

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Profile updated",
      profile
    });
  } catch (error) {
    console.error("Patch college profile error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// ── Profile Completion Calculator ─────────────────────────────────────────────
function calculateProfileCompletion(profile) {
  let score = 0;
  const weights = {
    institution: 10,
    currentYear: 8,
    field: 10,
    degreeProgramme: 10,
    domain: 8,
    specialization: 5,
    skills: 10,
    currentSemester: 6,
    cgpa: 6,
    subjects: 5,
    targetCareer: 7,
    academicInterests: 5,
    careerInterests: 5,
    completedCourses: 5,
    projects: 5,
    certifications: 5
  };

  if (profile.institution) score += weights.institution;
  if (profile.currentYear) score += weights.currentYear;
  if (profile.field) score += weights.field;
  if (profile.degreeProgramme) score += weights.degreeProgramme;
  if (profile.domain) score += weights.domain;
  if (profile.specialization) score += weights.specialization;
  if (profile.skills && profile.skills.length > 0) score += weights.skills;
  if (profile.currentSemester) score += weights.currentSemester;
  if (profile.cgpa) score += weights.cgpa;
  if (profile.subjects && profile.subjects.length > 0) score += weights.subjects;
  if (profile.targetCareer) score += weights.targetCareer;
  if (profile.academicInterests && profile.academicInterests.length > 0) score += weights.academicInterests;
  if (profile.careerInterests && profile.careerInterests.length > 0) score += weights.careerInterests;
  if (profile.completedCourses && profile.completedCourses.length > 0) score += weights.completedCourses;
  if (profile.projects && profile.projects.length > 0) score += weights.projects;
  if (profile.certifications && profile.certifications.length > 0) score += weights.certifications;

  return Math.min(100, score);
}

// ── GET Central Consolidated Student Context ──────────────────────────────────
// Returns the authoritative, shared data layer used by all college features:
// Profile + AHP + Fuzzy + Progress + Career Catalog + Skill Gap + Saved Items + Historical School Context
const getMyContext = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Parallel fetch of all student data including historical school profile
    const [user, profile, ahpProfile, fuzzyResult, skillProgress, testResults, savedItems, schoolProfile] = await Promise.all([
      User.findById(userId).select("name email phone role userType academicJourney transitionStatus classLevel").lean(),
      CollegeStudentProfile.findOne({ userId }).lean(),
      AhpCareerProfile.findOne({ userId }).lean(),
      AhpFuzzyResult.findOne({ userId }).lean(),
      StudentSkillProgress.findOne({ $or: [{ studentId: userId }, { userId }] }).lean(),
      StudentTestResult.find({ $or: [{ studentId: userId }, { userId }] }).sort({ createdAt: -1 }).limit(10).lean(),
      SavedItem.find({ userId }).lean(),
      StudentProfile.findOne({ userId }).lean()
    ]);

    const activeProfile = profile || {
      userId,
      field: "",
      degreeProgramme: "",
      domain: "",
      skills: [],
      subjects: [],
      projects: [],
      certifications: [],
      careerInterests: [],
      academicInterests: [],
      profileCompletion: 0,
      isCompleted: false
    };

    // 1. Authoritative Target Career Resolution
    // Priority: Explicit profile.targetCareer -> Fuzzy Result domain -> AHP top domain -> Catalog fallback
    let targetCareer = activeProfile.targetCareer || "";
    if (!targetCareer && fuzzyResult?.recommendedDomain?.domainName) {
      targetCareer = fuzzyResult.recommendedDomain.domainName;
    }
    if (!targetCareer && ahpProfile?.topDomain?.name) {
      targetCareer = ahpProfile.topDomain.name;
    }
    if (!targetCareer && activeProfile.careerInterests?.length > 0) {
      targetCareer = activeProfile.careerInterests[0];
    }

    // 2. Fetch Catalog details for the Target Career
    let careerCatalogItem = null;
    if (targetCareer) {
      careerCatalogItem = await CollegeCareerCatalog.findOne({
        $or: [
          { title: new RegExp(`^${targetCareer}$`, "i") },
          { slug: targetCareer.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
          { title: new RegExp(targetCareer, "i") }
        ]
      }).lean();
    }
    if (!careerCatalogItem) {
      careerCatalogItem = await CollegeCareerCatalog.findOne({
        $or: [
          { requiredDomains: new RegExp(activeProfile.domain || "Computer Science", "i") },
          { requiredFields: activeProfile.field || "engineering" }
        ]
      }).lean();
    }
    if (careerCatalogItem && !targetCareer) {
      targetCareer = careerCatalogItem.title;
    }
    if (!targetCareer) {
      targetCareer = "Software Engineer";
    }

    // 3. Compute Real Skill Gap Analysis against Target Career
    const userSkills = (activeProfile.skills || []).map(s => s.toLowerCase());
    const userSubjects = (activeProfile.subjects || []).map(s => s.toLowerCase());

    const catalogCore = careerCatalogItem?.coreSkills?.map(s => s.name) || careerCatalogItem?.requiredSkills || [];
    const catalogAdv = careerCatalogItem?.advancedSkills?.map(s => s.name) || [];
    const catalogOpt = careerCatalogItem?.optionalSkills?.map(s => s.name) || [];

    const allRequiredSkills = [...new Set([...catalogCore, ...catalogAdv, ...catalogOpt])];

    const strong = [];
    const developing = [];
    const missing = [];

    allRequiredSkills.forEach(reqSkill => {
      const rLower = reqSkill.toLowerCase();
      const hasExactSkill = userSkills.some(u => u.includes(rLower) || rLower.includes(u));
      const hasSubject = userSubjects.some(sub => sub.includes(rLower) || rLower.includes(sub));

      if (hasExactSkill) {
        strong.push(reqSkill);
      } else if (hasSubject) {
        developing.push(reqSkill);
      } else {
        missing.push(reqSkill);
      }
    });

    const totalReq = allRequiredSkills.length || 1;
    const readinessScore = Math.min(100, Math.round(((strong.length * 1.0 + developing.length * 0.5) / totalReq) * 100));

    // 4. Aggregate Weak and Strong Topics from Test Results
    const weakTopics = [];
    const strongTopics = [];
    testResults.forEach(tr => {
      if (Array.isArray(tr.weaknesses)) {
        tr.weaknesses.forEach(w => { if (!weakTopics.includes(w)) weakTopics.push(w); });
      }
      if (Array.isArray(tr.strengths)) {
        tr.strengths.forEach(s => { if (!strongTopics.includes(s)) strongTopics.push(s); });
      }
    });

    // 5. Aggregate Saved Items by Type
    const savedCounts = {
      Course: 0,
      College: 0,
      Scholarship: 0,
      Exam: 0,
      ClassContent: 0,
      CareerPath: 0,
      LearningResource: 0
    };
    (savedItems || []).forEach(item => {
      if (savedCounts[item.contentType] !== undefined) {
        savedCounts[item.contentType] += 1;
      } else {
        savedCounts[item.contentType] = 1;
      }
    });

    // 6. Roadmap Calculation
    const defaultMilestones = careerCatalogItem?.recommendedRoadmap || [
      { phase: "Phase 1: Academic & Core Fundamentals", title: "Core Theory & Discipline Mastery", items: ["Core Programming", "Data Structures", "Database Systems"], defaultStatus: strong.length > 2 ? "completed" : "current" },
      { phase: "Phase 2: Applied Technical Skills", title: "Specialization & Frameworks", items: catalogAdv.length > 0 ? catalogAdv : ["Applied Frameworks", "System Design"], defaultStatus: strong.length > 4 ? "completed" : "current" },
      { phase: "Phase 3: Portfolio & Real-world Projects", title: "Industry Capstone Projects", items: ["End-to-End Capstone Project", "API Integration"], defaultStatus: "upcoming" },
      { phase: "Phase 4: Placement & Certification", title: "Career Readiness & Certification", items: ["Mock Technical Assessment", "Resume Polish"], defaultStatus: "upcoming" }
    ];

    const completedMilestonesCount = (skillProgress?.completedSteps || []).filter(step => step.startsWith("roadmap_") || step.startsWith("m-")).length;
    const roadmapProgressPercent = Math.min(100, Math.round((completedMilestonesCount / Math.max(1, defaultMilestones.length)) * 100));

    // 7. Profile Completeness Verification
    const checks = {
      hasCollege: Boolean(activeProfile.institution),
      hasCourse: Boolean(activeProfile.degreeProgramme),
      hasYear: Boolean(activeProfile.currentYear),
      hasSemester: Boolean(activeProfile.currentSemester),
      hasSpecialisation: Boolean(activeProfile.specialization),
      hasDomain: Boolean(activeProfile.domain),
      hasTargetCareer: Boolean(targetCareer),
      hasSkills: Boolean(activeProfile.skills && activeProfile.skills.length > 0),
      hasProjects: Boolean(activeProfile.projects && activeProfile.projects.length > 0),
      hasCertifications: Boolean(activeProfile.certifications && activeProfile.certifications.length > 0),
      hasCgpa: Boolean(activeProfile.cgpa),
      hasSubjects: Boolean(activeProfile.subjects && activeProfile.subjects.length > 0),
      hasAhpOrFuzzy: Boolean(ahpProfile || fuzzyResult)
    };

    const completionPercent = activeProfile.profileCompletion || calculateProfileCompletion(activeProfile);

    // Consolidated Student Context Object
    const studentContext = {
      userId: user?._id || userId,
      name: user?.name || "Student",
      email: user?.email || "",
      phone: activeProfile.phone || user?.phone || "",
      activeStage: user?.userType || "school_student",
      academicJourney: user?.academicJourney || [],
      schoolProfile: schoolProfile ? {
        schoolName: schoolProfile.schoolName || "",
        classLevel: schoolProfile.classLevel || user?.classLevel || "12th",
        stream: schoolProfile.stream || "",
        board: schoolProfile.board || "",
        marksPercentage: schoolProfile.marksPercentage || null,
        careerInterest: schoolProfile.careerInterest || "",
        strongSubjects: schoolProfile.strongSubjects || []
      } : null,
      college: activeProfile.institution || "",
      district: activeProfile.institutionDistrict || "",
      department: activeProfile.domain || activeProfile.field || "",
      degree: activeProfile.degreeProgramme || "",
      course: activeProfile.degreeProgramme || "",
      academicYear: activeProfile.currentYear || "",
      semester: activeProfile.currentSemester || "",
      specialisation: activeProfile.specialization || "",
      domain: activeProfile.domain || "",
      subjects: activeProfile.subjects || [],
      skills: activeProfile.skills || [],
      strengths: activeProfile.strengths || [],
      interests: [...new Set([...(activeProfile.academicInterests || []), ...(activeProfile.careerInterests || [])])],
      academicInterests: activeProfile.academicInterests || [],
      careerInterests: activeProfile.careerInterests || [],
      targetCareer,
      targetCareerDomain: careerCatalogItem?.category || activeProfile.domain || "",
      targetCareerDetails: careerCatalogItem ? {
        title: careerCatalogItem.title,
        slug: careerCatalogItem.slug,
        category: careerCatalogItem.category,
        shortDescription: careerCatalogItem.shortDescription,
        coreSkills: careerCatalogItem.coreSkills || [],
        advancedSkills: careerCatalogItem.advancedSkills || [],
        optionalSkills: careerCatalogItem.optionalSkills || [],
        suggestedSubjects: careerCatalogItem.suggestedSubjects || [],
        suggestedNextSteps: careerCatalogItem.suggestedNextSteps || [],
        relatedCertifications: careerCatalogItem.relatedCertifications || [],
        growthOutlook: careerCatalogItem.growthOutlook || "High Demand"
      } : null,
      ahpResults: ahpProfile ? {
        topDomain: ahpProfile.topDomain,
        secondDomain: ahpProfile.secondDomain,
        thirdDomain: ahpProfile.thirdDomain,
        candidateDomains: ahpProfile.candidateDomains,
        consistencyStatus: ahpProfile.consistencyStatus,
        isConsistent: ahpProfile.isConsistent,
        completedAt: ahpProfile.completedAt
      } : null,
      fuzzyResults: fuzzyResult ? {
        recommendedDomain: fuzzyResult.recommendedDomain,
        finalScores: fuzzyResult.finalScores,
        strongDimensions: fuzzyResult.strongDimensions,
        confidenceLevel: fuzzyResult.confidenceLevel,
        completedAt: fuzzyResult.completedAt
      } : null,
      academicPerformance: {
        cgpa: activeProfile.cgpa || "",
        grokAssessmentScore: activeProfile.grokAssessmentScore || null,
        recentTests: testResults.map(t => ({
          id: t._id,
          date: t.createdAt,
          percentage: t.totalScore?.percentage || 0,
          performanceLevel: t.performanceLevel || "Average",
          strengths: t.strengths || [],
          weaknesses: t.weaknesses || []
        }))
      },
      studyProgress: {
        xp: skillProgress?.xp || 0,
        level: skillProgress?.level || 1,
        streak: skillProgress?.streak || 0,
        lastActivityDate: skillProgress?.lastActivityDate || null,
        completedSteps: skillProgress?.completedSteps || []
      },
      completedCourses: activeProfile.completedCourses || [],
      projects: activeProfile.projects || [],
      certifications: activeProfile.certifications || [],
      quizPerformance: {
        weakTopics,
        strongTopics,
        totalQuizzesTaken: testResults.length
      },
      skillGap: {
        strong,
        developing,
        missing,
        readinessScore,
        totalRequired: allRequiredSkills.length
      },
      roadmapProgress: {
        totalMilestones: defaultMilestones.length,
        completedMilestones: completedMilestonesCount,
        progressPercent: roadmapProgressPercent,
        milestones: defaultMilestones
      },
      savedResources: {
        total: savedItems.length,
        countsByType: savedCounts
      },
      profileCompleteness: {
        score: completionPercent,
        isComplete: activeProfile.isCompleted || completionPercent >= 75,
        checks
      }
    };

    res.status(200).json({
      success: true,
      studentContext,
      profile: activeProfile
    });
  } catch (error) {
    console.error("Get student context error:", error);
    res.status(500).json({ success: false, message: "Failed to assemble student context", error: error.message });
  }
};

module.exports = {
  getMetadata,
  getMyProfile,
  getMyContext,
  saveProfile,
  patchProfile
};
