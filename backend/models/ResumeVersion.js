const mongoose = require("mongoose");

/**
 * ResumeVersion – one private-sector resume belonging to exactly one user.
 * Content mirrors the graduate profile fields the resume builder edits, so a
 * version is a self-contained snapshot tied to a target role.
 */
const resumeVersionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true }, // e.g. "Full Stack Developer Resume"
    targetRole: { type: String, trim: true, default: "" },
    jobDescription: { type: String, default: "" },
    contact: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      location: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      portfolio: { type: String, default: "" },
    },
    summary: { type: String, default: "" },
    skills: [{ type: String }],
    education: [
      {
        degree: { type: String, default: "" },
        institution: { type: String, default: "" },
        year: { type: String, default: "" },
        score: { type: String, default: "" },
      },
    ],
    projects: [
      {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        techStack: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    experience: [
      {
        company: { type: String, default: "" },
        role: { type: String, default: "" },
        duration: { type: String, default: "" },
        description: { type: String, default: "" },
      },
    ],
    certifications: [
      {
        name: { type: String, default: "" },
        issuer: { type: String, default: "" },
        year: { type: String, default: "" },
      },
    ],
    achievements: [{ type: String }],
    sectionOrder: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResumeVersion", resumeVersionSchema);
