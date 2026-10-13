const GraduateProfile = require("../models/GraduateProfile");
const axios = require("axios");

const GROK_API_KEY = process.env.GROK_API_KEY || "";

// Fallback response engine tailored to graduate profile
const generateFallbackAdvisorResponse = (profile, question) => {
  const degree = profile?.degree || "your degree";
  const domain = profile?.domain || "your branch";
  const direction = profile?.primaryCareerDirection || "your chosen career path";
  const qLower = question.toLowerCase();

  if (qLower.includes("gate") || qLower.includes("exam")) {
    return `For ${degree} (${domain}) graduates aiming for ${direction}, preparing for competitive exams like GATE is an excellent path if you target PSU public sector jobs or M.Tech research at premier institutes (IITs/NITs). If your priority is immediate industry experience, focus on project portfolio building and target entry-level roles first while keeping exam preparation part-time.`;
  }

  if (qLower.includes("mba") || qLower.includes("management")) {
    return `Pursuing an MBA after ${degree} in ${domain} is one of the most effective ways to transition into product management, consulting, and business leadership. Having technical domain grounding paired with business acumen makes graduates highly competitive in corporate strategy roles.`;
  }

  if (qLower.includes("skill") || qLower.includes("learn") || qLower.includes("data") || qLower.includes("software")) {
    return `To accelerate your transition towards ${direction}, prioritize building hands-on portfolio evidence. Rather than just collecting certificates, recruiters value 2–3 deployed projects demonstrating practical problem solving, clean documentation on GitHub, and clear communication of your architectural choices.`;
  }

  if (qLower.includes("resume") || qLower.includes("interview")) {
    return `When tailoring your resume as a ${degree} graduate, highlight your capstone projects and internships prominently using the STAR (Situation, Task, Action, Result) methodology. Quantify your achievements (e.g. 'optimized processing speed by 25%' or 'built full-stack application supporting 50+ users') to stand out in screening.`;
  }

  return `As a graduate in ${degree} (${domain}) focused on ${direction}, the most strategic next step is aligning your existing competencies with market requirements. Build structured hands-on projects to close any skill gaps, keep your resume focused on real problem-solving evidence, and systematically apply to curated graduate entry roles.`;
};

exports.chatWithGraduateAdvisor = async (req, res) => {
  try {
    const userId = req.student?._id || req.user?._id || req.student?.id;
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Question is required" });
    }

    const profile = await GraduateProfile.findOne({ userId });

    const graduateContext = `
GRADUATE PROFILE CONTEXT:
- Name: ${req.student?.name || "Graduate"}
- Completed Degree: ${profile?.degree || "Degree"}
- Domain / Branch: ${profile?.domain || "General"}
- Specialization: ${profile?.specialization || "None"}
- Graduation Year: ${profile?.graduationYear || "Recent"}
- CGPA / Score: ${profile?.cgpa || "Good Academic Record"}
- Current Employment Status: ${profile?.employmentStatus || "Seeking Opportunities"}
- Primary Career Direction: ${profile?.primaryCareerDirection || "Career Growth"}
- Technical Skills: ${(profile?.technicalSkills || []).map(s => `${s.name} (${s.proficiency})`).join(", ") || "General Skills"}
- Soft Skills: ${(profile?.softSkills || []).join(", ") || "Communication, Problem Solving"}
- Tools: ${(profile?.tools || []).join(", ") || "Modern Tools"}
- Career Priorities: ${profile?.careerPriority || "Growth"}
- Competitive Exam Interest: ${profile?.examInterest || "Exploring"}
- Higher Studies Interest: ${profile?.higherStudyInterest || "Exploring"}
- Preferred Roles: ${(profile?.preferredRoles || []).join(", ") || "Relevant Industry Roles"}
`;

    const systemPrompt = `You are the Uyarvu-Payanam AI Graduate Career Advisor — an expert career coach, higher education advisor, and competitive exam strategist specifically advising university graduates.
Always give actionable, constructive, realistic advice based on the graduate's exact degree, skills, and goals. Never be generic or give vague platitudes.
Keep responses clear, well-structured, encouraging, and focused on practical next steps.

${graduateContext}
`;

    if (GROK_API_KEY) {
      try {
        const messagesPayload = [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-6).map(m => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text
          })),
          { role: "user", content: message }
        ];

        const grokResponse = await axios.post(
          "https://api.x.ai/v1/chat/completions",
          {
            model: "grok-2-latest",
            messages: messagesPayload,
            temperature: 0.7,
            max_tokens: 800
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${GROK_API_KEY}`
            },
            timeout: 10000
          }
        );

        const aiReply = grokResponse.data?.choices?.[0]?.message?.content?.trim();
        if (aiReply) {
          return res.status(200).json({
            success: true,
            reply: aiReply,
            source: "xAI Grok API"
          });
        }
      } catch (apiErr) {
        console.warn("Graduate AI Advisor Grok API error, using fallback engine:", apiErr.message);
      }
    }

    // Fallback response engine
    const fallbackReply = generateFallbackAdvisorResponse(profile, message);
    return res.status(200).json({
      success: true,
      reply: fallbackReply,
      source: "Uyarvu-Payanam Graduate Intelligence Engine"
    });
  } catch (error) {
    console.error("Graduate Advisor error:", error);
    res.status(500).json({ success: false, message: "AI Advisor service error" });
  }
};
