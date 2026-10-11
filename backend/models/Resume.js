const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    userType: {
      type: String,
      enum: ["school_student", "college_student", "graduate"],
      default: "graduate"
    },
    versionName: {
      type: String,
      default: "Primary Resume"
    },
    targetRole: {
      type: String,
      default: "Software Engineer"
    },
    targetCompany: {
      type: String,
      default: ""
    },
    targetCategory: {
      type: String,
      enum: ["JOB", "GOVERNMENT", "HIGHER_STUDIES", "RESEARCH", "INTERNSHIP"],
      default: "JOB"
    },
    jobDescription: {
      type: String,
      default: ""
    },
    template: {
      type: String,
      enum: [
        "ATS CLASSIC",
        "MODERN ATS",
        "TECHNICAL",
        "ACADEMIC",
        "RESEARCH",
        "EXPERIENCED PROFESSIONAL"
      ],
      default: "ATS CLASSIC"
    },
    personalInfo: {
      fullName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      location: { type: String, default: "" },
      degree: { type: String, default: "" },
      specialization: { type: String, default: "" },
      institution: { type: String, default: "" },
      graduationYear: { type: String, default: "" },
      cgpa: { type: String, default: "" },
      percentage: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      portfolio: { type: String, default: "" },
      // Optional profile photo stored as a small (client-resized) data URL so
      // it travels with the resume version and embeds directly in the PDF.
      photoUrl: { type: String, default: "" }
    },
    professionalSummary: {
      type: String,
      default: ""
    },
    education: [
      {
        institution: { type: String, default: "" },
        degree: { type: String, default: "" },
        specialization: { type: String, default: "" },
        duration: { type: String, default: "" },
        cgpaOrPercentage: { type: String, default: "" }
      }
    ],
    technicalSkills: [{ type: String }],
    softSkills: [{ type: String }],
    experience: [
      {
        company: { type: String, default: "" },
        role: { type: String, default: "" },
        location: { type: String, default: "" },
        type: { type: String, default: "Full-time" }, // Full-time, Part-time, Internship, Freelance, Research
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        description: { type: String, default: "" },
        technologies: [{ type: String }],
        achievements: [{ type: String }]
      }
    ],
    internships: [
      {
        company: { type: String, default: "" },
        role: { type: String, default: "" },
        duration: { type: String, default: "" },
        responsibilities: { type: String, default: "" },
        technologies: [{ type: String }],
        achievements: [{ type: String }]
      }
    ],
    projects: [
      {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        techStack: { type: String, default: "" },
        role: { type: String, default: "" },
        githubUrl: { type: String, default: "" },
        liveUrl: { type: String, default: "" },
        achievements: [{ type: String }]
      }
    ],
    certifications: [{ type: String }],
    achievements: [{ type: String }],
    publications: [
      {
        title: { type: String, default: "" },
        publisher: { type: String, default: "" },
        year: { type: String, default: "" },
        url: { type: String, default: "" }
      }
    ],
    research: [
      {
        title: { type: String, default: "" },
        institution: { type: String, default: "" },
        advisor: { type: String, default: "" },
        description: { type: String, default: "" }
      }
    ],
    leadership: [{ type: String }],
    volunteerExperience: [{ type: String }],
    extracurricular: [{ type: String }],
    languages: [{ type: String }],
    customSections: [
      {
        title: { type: String, default: "" },
        content: { type: String, default: "" }
      }
    ],
    sectionVisibility: {
      summary: { type: Boolean, default: true },
      education: { type: Boolean, default: true },
      skills: { type: Boolean, default: true },
      experience: { type: Boolean, default: true },
      internships: { type: Boolean, default: true },
      projects: { type: Boolean, default: true },
      certifications: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true },
      publications: { type: Boolean, default: true },
      research: { type: Boolean, default: true },
      leadership: { type: Boolean, default: true },
      volunteer: { type: Boolean, default: true },
      extracurricular: { type: Boolean, default: true },
      languages: { type: Boolean, default: true },
      custom: { type: Boolean, default: true }
    },
    atsHistory: [
      {
        jobTitle: { type: String, default: "" },
        company: { type: String, default: "" },
        jobDescriptionSnippet: { type: String, default: "" },
        overallScore: { type: Number, default: 0 },
        verdictLevel: { type: String, default: "" },
        matchedSkills: [{ type: String }],
        missingSkills: [{ type: String }],
        scannedAt: { type: Date, default: Date.now }
      }
    ],
    latestAtsScore: {
      type: Number,
      default: 0
    },
    resumeReadinessPercent: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);
