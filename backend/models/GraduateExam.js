const mongoose = require("mongoose");

/**
 * Exam pattern sub-document — mirrors the structured pattern object used by
 * the graduate career pages (mode, duration, question count, marks, subjects).
 */
const examPatternSchema = new mongoose.Schema(
  {
    mode: { type: String, default: "" },
    duration: { type: String, default: "" },
    questions: { type: String, default: "" },
    marks: { type: String, default: "" },
    subjects: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * GraduateExam — one managed government examination (a single database record,
 * not a hardcoded catalogue entry). Volatile recruiting details (dates, live
 * status, current vacancies) are deliberately NOT fabricated: they stay empty
 * until the admin fills them from the latest official notification.
 */
const graduateExamSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
      default: "",
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    governmentType: {
      type: String,
      required: [true, "Government type is required"],
      enum: ["State", "Central"],
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecruitmentOrganization",
      required: [true, "Recruitment organization is required"],
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    // ── Eligibility ───────────────────────────────────────────
    qualification: { type: String, default: "" },
    eligibleDegrees: { type: [String], default: [] },
    minimumAge: { type: String, default: "" },
    maximumAge: { type: String, default: "" },
    ageRelaxation: { type: String, default: "" },
    additionalEligibility: { type: String, default: "" },
    applicationFee: { type: String, default: "" },
    // ── Recruitment information ───────────────────────────────
    posts: { type: [String], default: [] },
    salary: { type: String, default: "" },
    selectionProcess: { type: [String], default: [] },
    examPattern: { type: examPatternSchema, default: () => ({ subjects: [] }) },
    syllabus: { type: [String], default: [] },
    // ── Dates (free-form 'YYYY-MM-DD' or empty — never fabricated) ──
    notificationDate: { type: String, default: "" },
    applicationStartDate: { type: String, default: "" },
    applicationEndDate: { type: String, default: "" },
    examDate: { type: String, default: "" },
    resultDate: { type: String, default: "" },
    // ── Additional source-extracted info (synced records) ─────
    // Short factual snippets taken verbatim from the source page's
    // Vacancy / Admit Card / Result / Cutoff sections. Never fabricated:
    // they stay empty when the source does not publish the information.
    vacancyInfo: { type: String, default: "" },
    admitCardInfo: { type: String, default: "" },
    resultInfo: { type: String, default: "" },
    cutoffInfo: { type: String, default: "" },
    // Plain-text digest of the source's "Dates" section — kept as context
    // when dates are published as text ("May – June 2026") rather than as
    // exact calendar dates.
    datesNotes: { type: String, default: "" },
    // ── Links ─────────────────────────────────────────────────
    officialWebsite: { type: String, trim: true, default: "" },
    notificationUrl: { type: String, trim: true, default: "" },
    applicationUrl: { type: String, trim: true, default: "" },
    sourceUrl: { type: String, trim: true, default: "" },
    // ── Source tracking (synced records) ──────────────────────
    // sourceWebsite + sourceUrl form the stable upsert key for synced
    // records; sourceLastChecked is bumped on every sync run while
    // updatedAt (lastUpdated) only moves when real data changed.
    sourceWebsite: { type: String, trim: true, default: "" },
    sourceLastChecked: { type: String, default: "" },
    // Body name exactly as published by the source (organisation above
    // remains the managed, admin-editable grouping).
    conductingBody: { type: String, default: "" },
    // ── Status & lifecycle ────────────────────────────────────
    status: {
      type: String,
      enum: [
        "",
        "TBA",
        "Upcoming",
        "Application Open",
        "Application Closed",
        "Exam Scheduled",
        "Result Released",
        "Archived",
      ],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

graduateExamSchema.index({ slug: 1 }, { unique: true, sparse: true });
graduateExamSchema.index({ organization: 1, examName: 1 }, { unique: true });

module.exports = mongoose.model("GraduateExam", graduateExamSchema);