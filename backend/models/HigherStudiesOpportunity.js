const mongoose = require("mongoose");

const higherStudiesOpportunitySchema = new mongoose.Schema(
  {
    // ── Basic Course Information ───────────────────────────────────
    courseName: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    courseCategory: {
      type: String,
      enum: [
        "Engineering & Technology",
        "Medical Exams",
        "Management & MBA Exams",
        "Science Exams",
        "Central University & Academic Exams",
        "Pharmacy Exams",
        "Law Exams",
      ],
      required: true,
      index: true,
    },
    definition: { type: String, default: "", trim: true },
    detailedContent: { type: String, default: "", trim: true },
    duration: { type: String, default: "" },
    targetAcademicBackground: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    officialCourseUrl: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },

    // ── Eligibility ─────────────────────────────────────────────────
    eligibleDegree: { type: String, default: "" },
    eligibleStreams: [{ type: String }],
    minimumMarks: { type: String, default: "" },
    requiredSubjects: { type: String, default: "" },
    workExperience: { type: String, default: "" },
    additionalConditions: { type: String, default: "" },
    eligibilityNotes: { type: String, default: "" },

    // ── Exams (multiple per course) ─────────────────────────────────
    exams: [
      {
        examName: { type: String, default: "" },
        examDefinition: { type: String, default: "" },
        eligibility: { type: String, default: "" },
        examPattern: { type: String, default: "" },
        syllabus: { type: String, default: "" },
        officialExamUrl: { type: String, default: "" },
        examInfo: { type: String, default: "" },
      },
    ],

    // ── Specialisations (multiple per course) ───────────────────────
    specialisations: [
      {
        name: { type: String, default: "" },
        description: { type: String, default: "" },
        skills: [{ type: String }],
      },
    ],

    // ── Career Path ─────────────────────────────────────────────────
    careerPath: {
      overview: { type: String, default: "" },
      jobRoles: [
        {
          role: { type: String, default: "" },
          skillsRequired: { type: String, default: "" },
        },
      ],
      furtherStudy: { type: String, default: "" },
    },

    // ── Best Suited For ─────────────────────────────────────────────
    bestSuitedFor: {
      overview: { type: String, default: "" },
      recommendedBackground: { type: String, default: "" },
      careerGoals: { type: String, default: "" },
      interests: { type: String, default: "" },
      whoShouldConsider: { type: String, default: "" },
      considerations: { type: String, default: "" },
    },

    // ── Additional Information ─────────────────────────────────────
    studyMode: { type: String, enum: ["Online", "Offline", "Hybrid"], default: "Offline" },
    fees: { type: String, default: "" },
    recognition: { type: String, default: "" },
    additionalNotes: { type: String, default: "" },

    // ── System Fields ─────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Draft", "Published", "Archived"],
      default: "Draft",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

higherStudiesOpportunitySchema.index({ status: 1, courseCategory: 1 });
higherStudiesOpportunitySchema.index({ courseName: "text", definition: "text" });

module.exports = mongoose.model("HigherStudiesOpportunity", higherStudiesOpportunitySchema);
