const GraduateExam = require("../models/GraduateExam");

const parseDate = (value) => {
  if (!value || typeof value !== "string") return null;
  const t = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return null; // only ISO-like dates are trusted
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Conservative eligibility assessment. Never claims "Eligible" unless the
 * exam's published criteria clearly match the user's degree/qualification.
 * Missing or ambiguous data yields "Possibly eligible — additional
 * information required". A clear mismatch yields "Not eligible".
 */
const assessEligibility = (profile, exam) => {
  const degree = String(profile.degree || "").toLowerCase().trim();
  const specialization = String(profile.specialization || "").toLowerCase().trim();
  const domain = String(profile.domain || "").toLowerCase().trim();
  const degrees = (exam.eligibleDegrees || []).map((d) => String(d).toLowerCase());
  const qualification = String(exam.qualification || "").toLowerCase();

  const degreeMatchesList =
    degree && degrees.some((d) => d.includes(degree) || degree.includes(d));
  const degreeMatchesText = degree && qualification && qualification.includes(degree);
  const domainMatches =
    (specialization && qualification.includes(specialization)) ||
    (domain && qualification.includes(domain));

  if (degreeMatchesList || degreeMatchesText) {
    return { status: "Eligible", reasons: ["Your degree matches the published eligibility."] };
  }
  if (degrees.length > 0 || qualification) {
    if (domainMatches) {
      return {
        status: "Possibly eligible — additional information required",
        reasons: ["Your department/domain appears related; confirm degree requirements in the official notification."],
      };
    }
    return {
      status: "Not eligible",
      reasons: ["Published qualification criteria do not list your degree. Check the official notification for exact requirements."],
    };
  }
  return {
    status: "Possibly eligible — additional information required",
    reasons: ["No published eligibility criteria available for this record. Refer to the official notification."],
  };
};

const computeRecommendations = async (profile) => {
  const exams = await GraduateExam.find({ isActive: true })
    .populate("organization", "name")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const preferredLocations = (profile.preferredLocations || []).map((l) =>
    String(l).toLowerCase()
  );
  const interests = (profile.careerInterests || []).map((s) => String(s).toLowerCase());
  const wantsCentral =
    interests.length === 0 ||
    interests.some((i) => i.includes("central") || i.includes("both"));
  const wantsState =
    interests.length === 0 ||
    interests.some((i) => i.includes("state") || i.includes("both"));
  const targetState = String(profile.targetState || "").toLowerCase();

  const scored = exams
    .filter((ex) => ex.status !== "Archived")
    .filter((ex) =>
      ex.governmentType === "Central" ? wantsCentral : wantsState
    )
    .map((ex) => {
      const eligibility = assessEligibility(profile, ex);
      let score = 0;
      if (eligibility.status === "Eligible") score += 3;
      else if (eligibility.status.startsWith("Possibly")) score += 1;
      if (targetState && (ex.state || "").toLowerCase().includes(targetState)) score += 2;
      if (
        preferredLocations.length === 0 ||
        preferredLocations.some((l) => (ex.state || "").toLowerCase().includes(l)) ||
        ex.governmentType === "Central"
      ) {
        score += 1;
      }
      return { ex, eligibility, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  const toItem = ({ ex, eligibility }) => ({
    _id: ex._id,
    examName: ex.examName,
    shortName: ex.shortName,
    governmentType: ex.governmentType,
    state: ex.state,
    organization: ex.organization?.name || "",
    category: ex.category,
    qualification: ex.qualification,
    applicationEndDate: ex.applicationEndDate,
    examDate: ex.examDate,
    status: ex.status,
    applicationUrl: ex.applicationUrl,
    officialWebsite: ex.officialWebsite,
    notificationUrl: ex.notificationUrl,
    eligibility,
  });

  return {
    central: scored.filter((s) => s.ex.governmentType === "Central").map(toItem),
    state: scored.filter((s) => s.ex.governmentType !== "Central").map(toItem),
  };
};

module.exports = { parseDate, assessEligibility, computeRecommendations };
