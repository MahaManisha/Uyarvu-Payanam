const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");
const GraduateProfile = require("../models/GraduateProfile");
const ResumeVersion = require("../models/ResumeVersion");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROK_API_KEY = process.env.GROK_API_KEY || "";
const AI_MODEL = process.env.AI_QUESTIONS_MODEL || "openai/gpt-oss-120b";

// Load the authenticated user + graduate profile used to prefill a resume.
async function loadUserAndProfile(req) {
  const userId = req.student?._id || req.student?.id;
  const [user, profile] = await Promise.all([
    User.findById(userId).select("name email").lean(),
    GraduateProfile.findOne({ userId }).lean(),
  ]);
  return { user, profile };
}

function contactFrom(user, profile) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: profile?.phone || "",
    location: profile?.location || "",
    linkedin: profile?.linkedinUrl || "",
    github: profile?.githubUrl || "",
    portfolio: profile?.portfolioUrl || "",
  };
}

// ── GET /api/graduate/resume/default  – prefill from real profile data only
exports.getDefaultResume = async (req, res) => {
  try {
    const { user, profile } = await loadUserAndProfile(req);
    if (!profile) {
      return res.json({
        success: true,
        warning: "Complete your profile setup first to auto-fill name, skills, projects and education.",
        resume: null,
      });
    }
    res.json({
      success: true,
      resume: {
        contact: contactFrom(user, profile),
        summary: "",
        skills: (profile.technicalSkills || []).map((s) => s.name || s),
        education: [
          {
            degree: profile.degree ? `${profile.degree}${profile.specialization ? " – " + profile.specialization : ""}` : "",
            institution: profile.college || profile.university || "",
            year: profile.graduationYear || "",
            score: profile.cgpa ? `CGPA: ${profile.cgpa}` : profile.percentage ? `${profile.percentage}%` : "",
          },
        ],
        projects: (profile.projects || []).map((p) => ({
          title: p.title || "",
          description: p.description || "",
          techStack: p.techStack || "",
          url: p.projectUrl || "",
        })),
        experience: [
          ...(profile.workExperience || []).map((w) => ({
            company: w.company || "",
            role: w.role || "",
            duration: w.duration || "",
            description: w.description || "",
          })),
          ...(profile.internships || []).map((w) => ({
            company: w.company || "",
            role: w.role || "",
            duration: w.duration || "",
            description: w.description || "",
          })),
        ],
        certifications: (profile.certifications || []).map((c) => ({
          name: c.name || "",
          issuer: c.issuer || "",
          year: c.issueYear || "",
        })),
        achievements: [],
      },
      profile,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load profile data" });
  }
};

// ── AI resume generation (Groq / xAI), keys stay on the server ─────────────
async function callAI(prompt, systemMsg) {
  const apiKey = GROQ_API_KEY || GROK_API_KEY;
  if (!apiKey) return { used: false, text: null, reason: "No AI provider configured (set GROQ_API_KEY or GROK_API_KEY)." };
  const endpoint = GROQ_API_KEY ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";
  const modelName = GROQ_API_KEY ? AI_MODEL : "grok-2-latest";
  const response = await axios.post(
    endpoint,
    {
      model: modelName,
      messages: [
        { role: "system", content: systemMsg || "You are an ATS resume optimizer. Respond strictly in valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    },
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, timeout: 25000 }
  );
  let clean = (response.data?.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/gi, "").trim();
  try {
    return { used: true, text: JSON.parse(clean) };
  } catch {
    return { used: true, text: null, reason: "AI returned a non-JSON response." };
  }
}

exports.generateResume = async (req, res) => {
  try {
    const { targetRole, jobDescription } = req.body || {};
    if (!targetRole) return res.status(400).json({ success: false, message: "Target role is required" });
    const { user, profile } = await loadUserAndProfile(req);
    if (!profile) return res.status(404).json({ success: false, message: "Complete your graduate profile first." });

    const summaryData = {
      degree: profile.degree, domain: profile.domain, specialization: profile.specialization,
      graduationYear: profile.graduationYear, skills: (profile.technicalSkills || []).map((s) => s.name || s),
      projects: (profile.projects || []).map((p) => `${p.title}: ${p.description}`),
      internships: (profile.internships || []).map((i) => `${i.role} at ${i.company}: ${i.description}`),
      workExperience: (profile.workExperience || []).map((w) => `${w.role} at ${w.company}: ${w.description}`),
      certifications: (profile.certifications || []).map((c) => c.name),
    };

    const prompt = `Target role: ${targetRole}
Job description (may be empty): ${jobDescription || "(none provided)"}
Candidate real data: ${JSON.stringify(summaryData)}

Return JSON: {"summary": string, "highlightedSkills": string[], "projectBullets": [{"title": string, "bullets": string[]}], "experienceBullets": [{"role": string, "company": string, "bullets": string[]}], "missingKeywords": string[]}
Rules: only use skills/projects/experience given above; bullets must be achievement-oriented with metrics only if present in the data; never invent employers, degrees, or skills.`;

    const ai = await callAI(prompt);
    if (!ai.used) {
      return res.json({ success: true, aiUsed: false, message: ai.reason, data: null });
    }
    if (!ai.text) {
      return res.json({ success: true, aiUsed: true, warning: ai.reason, data: null });
    }
    res.json({ success: true, aiUsed: true, data: ai.text });
  } catch (e) {
    console.error("Resume AI generation error:", e?.message);
    res.status(502).json({ success: false, message: "AI resume generation failed. Your existing data is preserved — please try again." });
  }
};

// ── ATS analysis (explainable, no fabricated scores) ───────────────────────
const STOP = new Set(["the","and","for","with","you","your","our","are","will","we","a","an","to","of","in","on","is","as","or","by","at","be","this","that","have","has","from","role","job","work","team"]);
function keywords(text) {
  return Array.from(new Set((String(text).toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []).filter((w) => !STOP.has(w))));
}
exports.analyzeAts = async (req, res) => {
  try {
    const { resume, jobDescription } = req.body || {};
    if (!resume) return res.status(400).json({ success: false, message: "resume is required" });
    if (!jobDescription || !jobDescription.trim()) {
      return res.json({ success: true, analysis: { note: "Provide a job description to get a keyword match analysis." } });
    }
    const resumeText = [
      resume.summary, (resume.skills || []).join(" "),
      JSON.stringify(resume.projects || []), JSON.stringify(resume.experience || []),
      JSON.stringify(resume.education || []), JSON.stringify(resume.certifications || []),
    ].join(" ");
    const jdKws = keywords(jobDescription);
    const resumeKws = new Set(keywords(resumeText));
    const matched = jdKws.filter((k) => resumeKws.has(k));
    const missing = jdKws.filter((k) => !resumeKws.has(k));

    const checks = [];
    if (!resume.summary) checks.push("Add a professional summary tailored to the role.");
    if ((resume.skills || []).length < 5) checks.push("List at least 5 genuine technical skills.");
    if (!(resume.education || []).length) checks.push("Add your education details.");
    if (!(resume.experience || []).length && !(resume.projects || []).length) checks.push("Add internships, projects, or experience.");

    // ── Explainable, documented scoring (0–100) ─────────────────────────
    // Job Description Match =
    //   60% keyword coverage of JD terms in the resume,
    //   15% education completeness,
    //   15% evidence of requirement-relevant skills in projects/experience,
    //   10% structure/readability (all core sections present).
    const keywordScore = jdKws.length ? (matched.length / jdKws.length) * 60 : 0;
    const educationScore = (resume.education || []).length ? 15 : 0;
    const evidenceText = [JSON.stringify(resume.projects || []), JSON.stringify(resume.experience || [])].join(" ").toLowerCase();
    const evidenceHits = matched.filter((k) => evidenceText.includes(k)).length;
    const evidenceScore = matched.length ? (evidenceHits / matched.length) * 15 : 0;
    const structureScore = checks.length === 0 ? 10 : Math.max(0, 10 - checks.length * 2.5);
    const matchPercent = Math.round(keywordScore + educationScore + evidenceScore + structureScore);

    const skillsToHighlight = (resume.skills || []).filter((s) =>
      jdKws.includes(String(s).toLowerCase())
    );

    const suggestions = [];
    if (missing.length) suggestions.push(`Consider adding these genuinely-held skills/keywords: ${missing.slice(0, 8).join(", ")}.`);
    if (!resume.summary) suggestions.push("Write a 2–3 sentence summary mentioning the target role.");
    if (evidenceScore < 8) suggestions.push("Strengthen project/experience bullets with measurable outcomes where true.");
    if (!suggestions.length) suggestions.push("Your resume covers the key requirements well.");

    res.json({
      success: true,
      analysis: {
        mode: "job_description_match",
        keywordMatchPercent: matchPercent,
        breakdown: {
          keywordCoverage: Math.round(keywordScore),
          education: educationScore,
          evidenceInProjects: Math.round(evidenceScore),
          structure: Math.round(structureScore),
        },
        matchedKeywords: matched,
        missingKeywords: missing,
        skillsToHighlight,
        formattingChecks: checks.length ? checks : ["Resume structure looks complete for an entry-level single-column layout."],
        suggestions,
        note: `Score = 60% keyword coverage + 15% education + 15% project/experience evidence + 10% structure. ${matched.length} of ${jdKws.length} job-description keywords appear in your resume. This is keyword coverage only — it does not guarantee ATS selection.`,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "ATS analysis failed" });
  }
};

// Readiness assessment when no job description is provided.
exports.resumeReadiness = async (req, res) => {
  try {
    const { resume } = req.body || {};
    if (!resume) return res.status(400).json({ success: false, message: "resume is required" });
    const c = resume.contact || {};
    const contactScore = c.name && c.email ? 20 : (c.name || c.email ? 10 : 0);
    const educScore = (resume.education || []).length ? 20 : 0;
    const skillScore = (resume.skills || []).length >= 5 ? 20 : (resume.skills || []).length ? 10 : 0;
    const expScore = (resume.experience || []).length ? 20 : (resume.projects || []).length ? 12 : 0;
    const fmtScore = resume.summary ? 20 : 8;
    const score = contactScore + educScore + skillScore + expScore + fmtScore;
    res.json({
      success: true,
      analysis: {
        mode: "resume_readiness",
        readinessScore: score,
        breakdown: { contact: contactScore, education: educScore, skills: skillScore, experienceOrProjects: expScore, summaryFormatting: fmtScore },
        missingSections: [
          !c.name || !c.email ? "Contact information" : null,
          !(resume.education || []).length ? "Education" : null,
          !(resume.skills || []).length ? "Technical skills" : null,
          !(resume.experience || []).length && !(resume.projects || []).length ? "Projects / experience" : null,
          !resume.summary ? "Professional summary" : null,
        ].filter(Boolean),
        note: "Resume Readiness measures completeness of your resume sections. Paste a job description to get a Job Description Match score.",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Readiness analysis failed" });
  }
};

// ── Resume version CRUD (all owner-scoped) ─────────────────────────────────
exports.listResumes = async (req, res) => {
  try {
    const items = await ResumeVersion.find({ userId: req.student._id }).sort({ updatedAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to list resumes" });
  }
};
exports.createResume = async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: "Title is required" });
    const created = await ResumeVersion.create({ ...req.body, userId: req.student._id, title });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to create resume", error: e.message });
  }
};
exports.getResume = async (req, res) => {
  try {
    const doc = await ResumeVersion.findOne({ _id: req.params.id, userId: req.student._id });
    if (!doc) return res.status(404).json({ success: false, message: "Resume not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load resume" });
  }
};
exports.updateResume = async (req, res) => {
  try {
    const update = { ...req.body };
    delete update.userId; // ownership is never reassignable
    const doc = await ResumeVersion.findOneAndUpdate(
      { _id: req.params.id, userId: req.student._id },
      { $set: update },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Resume not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update resume", error: e.message });
  }
};
exports.deleteResume = async (req, res) => {
  try {
    const doc = await ResumeVersion.findOneAndDelete({ _id: req.params.id, userId: req.student._id });
    if (!doc) return res.status(404).json({ success: false, message: "Resume not found" });
    res.json({ success: true, message: "Resume deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete resume" });
  }
};
