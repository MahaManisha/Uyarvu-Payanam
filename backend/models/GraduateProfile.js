const mongoose = require("mongoose");

const graduateProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    // ── PERSONAL / ACADEMIC INFORMATION ──────────────────────────────────
    degree: { type: String, trim: true, default: "B.E." },
    degreeId: { type: String, trim: true, default: "be" },
    specialization: { type: String, trim: true, default: "Computer Science" },
    specializationId: { type: String, trim: true, default: "cse" },
    collegeName: { type: String, trim: true, default: "" },
    universityName: { type: String, trim: true, default: "" },
    college: { type: String, trim: true, default: "" }, // alias
    university: { type: String, trim: true, default: "" }, // alias
    graduationYear: { type: String, trim: true, default: "2026" },
    graduationStatus: { type: String, trim: true, default: "Completed" }, // "Completed", "Final Year", etc.
    cgpa: { type: String, trim: true, default: "8.0" },
    percentage: { type: String, trim: true, default: "80%" },
    state: { type: String, trim: true, default: "Tamil Nadu" },
    location: { type: String, trim: true, default: "Chennai" },
    hasBacklogs: { type: Boolean, default: false },
    backlogCount: { type: Number, default: 0 },
    employmentStatus: {
      type: String,
      default: "Fresher / Not currently working"
    },

    // ── CAREER INTERESTS & DOMAINS ──────────────────────────────────────
    careerInterests: [{ type: String }], // Higher Studies, Government Exams, PSU / Government Jobs, Private Jobs, Research, Entrepreneurship, Teaching / Academia, International Studies, Other
    preferredDomains: [{ type: String }], // Software Engineering, AI / ML, Data Science, Cyber Security, Cloud / DevOps, Core Engineering, Electronics, Management, Research, Finance, Government Administration, Other
    field: { type: String, trim: true, default: "Engineering" },
    domain: { type: String, trim: true, default: "Computer Science" },

    // ── SKILLS & EXPERIENCE ─────────────────────────────────────────────
    skills: [{ type: String }],
    technicalSkills: [
      {
        name: { type: String, required: true },
        proficiency: {
          type: String,
          enum: ["Beginner", "Intermediate", "Advanced"],
          default: "Intermediate"
        }
      }
    ],
    softSkills: [{ type: String }],
    tools: [{ type: String }],
    experience: [
      {
        title: { type: String },
        company: { type: String },
        duration: { type: String },
        description: { type: String }
      }
    ],

    // ── CAREER DIRECTION & PREFERENCES ──────────────────────────────────
    primaryCareerDirection: {
      type: String,
      default: "Get a Job"
    },
    secondaryDirections: [{ type: String }],
    preferredWorkType: { type: String, default: "Technical" },
    preferredEnvironment: { type: String, default: "Office / Hybrid" },
    targetCareer: { type: String, trim: true },

    // ── Interest-based onboarding preferences ──────────────────────────
    careerInterests: [
      {
        type: String,
        enum: [
          "Central Government Exams",
          "State Government Exams",
          "Private-Sector Jobs",
          "Both Government and Private Opportunities"
        ]
      }
    ],
    targetState: { type: String, trim: true, default: "" },
    examPreparation: {
      type: String,
      enum: ["", "Yes", "No", "Planning to start"],
      default: ""
    },
    ageRange: { type: String, trim: true, default: "" },

    // ── STAGE 4: Competitive Exams ─────────────────────────────────────────
    examInterest: {
      type: String,
      enum: ["Yes", "Maybe", "No"],
      default: "No"
    },
    selectedExams: [
      {
        examName: { type: String },
        category: { type: String },
        targetYear: { type: String },
        preparationStatus: { type: String, default: "Exploring" }
      }
    ],
    higherStudyInterest: { type: String, enum: ["Yes", "Maybe", "No"], default: "Yes" },
    preferredHigherDegrees: [{ type: String }],
    targetCountries: [{ type: String }],
    upskillingFocusAreas: [{ type: String }],

    // ── PLACEMENT & RESUME ────────────────────────────────────────────────
    lookingForOpportunity: { type: String, default: "Full-time job" },
    preferredRoles: [{ type: String }],
    preferredIndustries: [{ type: String }],
    preferredLocations: [{ type: String }],
    resumeUrl: { type: String, default: "" },

    // ── Portfolio, Projects & Experience ───────────────────────────────────
    projects: [
      {
        title: { type: String },
        description: { type: String },
        techStack: { type: String },
        projectUrl: { type: String }
      }
    ],
    internships: [
      {
        company: { type: String },
        role: { type: String },
        duration: { type: String },
        description: { type: String }
      }
    ],
    certifications: [
      {
        name: { type: String },
        issuer: { type: String },
        issueYear: { type: String }
      }
    ],
    workExperience: [
      {
        company: { type: String },
        role: { type: String },
        duration: { type: String },
        description: { type: String }
      }
    ],
    resumeUrl: { type: String },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    githubUrl: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },

    // ── Telemetry & Scores ─────────────────────────────────────────────────
    currentStep: { type: Number, default: 1 },
    profileCompletion: { type: Number, default: 0 },
    careerReadinessScore: { type: Number, default: 40 },
    onboardingCompleted: { type: Boolean, default: false },

    cachedRecommendations: {
      bestFitCareers: [{ type: mongoose.Schema.Types.Mixed }],
      skillGap: { type: mongoose.Schema.Types.Mixed },
      roadmap: [{ type: mongoose.Schema.Types.Mixed }],
      suggestedExams: [{ type: mongoose.Schema.Types.Mixed }],
      higherStudies: [{ type: mongoose.Schema.Types.Mixed }]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GraduateProfile", graduateProfileSchema);
