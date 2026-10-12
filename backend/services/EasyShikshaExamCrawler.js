/**
 * EasyShiksha Exam Crawler
 * Dynamically discovers and fetches government exam information from EasyShiksha.com
 * and persists the results to the existing Exam database.
 */

const axios = require("axios");
const Exam = require("../models/Exam");

const EASYSHIKSHA_BASE = "https://easyshiksha.com";
const EASYSHIKSHA_GOVt_EXAM = `${EASYSHIKSHA_BASE}/govt-exam`;

const CATEGORIES = [
  "Banking",
  "Defence",
  "PSU",
  "Railway",
  "SSC",
  "Teaching",
  "UPSC",
  "State PSC"
];

/**
 * Fetches a page with proper error handling and timeout
 */
async function safeFetch(url, options = {}) {
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      ...options,
    });
    return { success: true, data: response.data, status: response.status };
  } catch (err) {
    console.warn(`[EasyShikshaCrawler] Fetch error for ${url}:`, err.message);
    return { success: false, data: null, status: 0 };
  }
}

/**
 * Extracts exam links from a category page on EasyShiksha
 */
async function extractExamLinksFromCategoryPage(html) {
  const $ = cheerio.load(html);
  const examLinks = [];

  // Exam cards typically have specific classes on EasyShiksha
  // Look for exam title links in the government exams section
  $(".exam-card, .exam-title, .exam-link, .course-card, .exam-item").each((idx, elem) => {
    const $elem = $(elem);
    const link = $elem.find("a").first().attr("href");
    const title = $elem.find("a").first().text().trim() || $elem.text().trim();

    if (link && title) {
      const fullLink = link.startsWith("http") ? link : `${EASYSHIKSHA_BASE}${link}`;
      // Filter out non-exam links
      if (fullLink.includes("/govt-exam/") || fullLink.includes("/exam/")) {
        examLinks.push({
          title: title.replace(/\s+/g, " "),
          link: fullLink,
        });
      }
    }
  });

  // Also look for specific exam names in the page
  $(".exam-name, .exam-title, h3, h4, h5").each((idx, elem) => {
    const text = $(elem).text().trim();
    // Common exam patterns
    const examPatterns = [
      /SSC[-\s]?CGL/i,
      /UPSC[-\s]?CSE/i,
      /GATE[-\s]?CSE/i,
      /CAT/i,
      /IBPS[-\s]?PO/i,
      /SBI[-\s]?PO/i,
      /RRB[-\s]?NTPC/i,
      /CDS/i,
      /NDA/i,
      /AFCAT/i,
      /TNPSC/i,
    ];

    for (const pattern of examPatterns) {
      if (pattern.test(text)) {
        examLinks.push({
          title: text,
          link: `${EASYSHIKSHA_BASE}/govt-exam`,
        });
        break;
      }
    }
  });

  // Deduplicate by title
  const seen = new Set();
  return examLinks.filter((el) => {
    const key = el.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extracts detailed exam information from an exam detail page
 */
async function extractExamDetails(html) {
  const $ = cheerio.load(html);
  const details = {};

  // Extract exam name/title
  details.name = $("h1, .exam-name, .page-title").first().text().trim() || "";
  details.shortName = details.name
    .split(/[\s/]+/)
    .filter((part) => /[A-Z]{2,}/.test(part))
    .join(" ") || "";

  // Extract conducting organization
  details.conductingOrganization = $("span:contains('Conducting'), .conducting-org, .org-name")
    .first()
    .text()
    .replace(/Conducting[:\s]/i, "")
    .trim() || "";

  // Extract description/purpose
  details.description = $("meta[name=description]").attr("content") || "";
  details.purpose = $(":contains('Purpose')").first().next().text().trim() || "";

  // Extract eligibility criteria
  const eligibilitySection = $(":contains('Eligibility')").first().parent();
  if (eligibilitySection.length) {
    details.eligibility = {
      qualificationRequirements: $(":contains('Qualification')")
        .first()
        .next()
        .text()
        .trim()
        .substring(0, 500) || "",
      minDegree: $(":contains('Minimum Degree')")
        .first()
        .next()
        .text()
        .trim()
        .substring(0, 200) || "",
      minPercentage: $(":contains('Minimum Percentage')")
        .first()
        .next()
        .text()
        .trim()
        .substring(0, 100) || "",
      ageRequirements: $(":contains('Age Limit')")
        .first()
        .next()
        .text()
        .trim()
        .substring(0, 200) || "",
      nationality: $(":contains('Nationality')")
        .first()
        .next()
        .text()
        .trim()
        .substring(0, 200) || "",
    };
  }

  // Extract exam pattern/stages
  details.stages = [];
  $(".stage, .exam-stage, .phase").each((idx, stage) => {
    const $stage = $(stage);
    details.stages.push({
      stageName: $stage.find("h4, .stage-name, .title").first().text().trim() || `Stage ${idx + 1}`,
      durationMinutes: parseInt($stage.find(".duration, .time").first().text()) || 120,
      totalQuestions: parseInt($stage.find(".questions, .q-count").first().text()) || 100,
      totalMarks: parseInt($stage.find(".marks, .m-count").first().text()) || 200,
      negativeMarking: $stage.find(".negative, .neg-mark").length > 0,
      sections: [],
    });
  });

  // Extract syllabus topics
  details.syllabusTopics = [];
  $(":contains('Syllabus')").nextUntil("h3, h4, .section").each((idx, topic) => {
    const text = $(topic).text().trim();
    if (text && text.length > 5) {
      details.syllabusTopics.push(text.substring(0, 200));
    }
  });

  // Extract career opportunities
  details.careerOpportunities = $(":contains('Career')")
    .nextUntil("h3")
    .text()
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0) || [];

  // Extract salary information
  details.salary = $(":contains('Salary')")
    .parent()
    .text()
    .substring(0, 300) || "";

  // Extract job profile
  details.jobProfile = $(":contains('Job Profile')")
    .parent()
    .text()
    .substring(0, 500) || "";

  // Source metadata
  details.sourceUrl = $("link[rel=canonical]").attr("href") || "";
  details.sourceTitle = $("title").text().trim() || "";

  return details;
}

/**
 * Determines the category for an exam based on its title and conducting organization
 */
function determineCategory(title, conductingOrg) {
  const titleLower = (title || "").toLowerCase();
  const orgLower = (conductingOrg || "").toLowerCase();

  // Central government exams
  const centralKeywords = ["upsc", "ssc", "upsc", "ias", "ifos", "epfo", "cms"];
  if (centralKeywords.some((k) => titleLower.includes(k) || orgLower.includes(k))) {
    return "Central Examination";
  }

  // Banking
  const bankingKeywords = ["ibps", "sbi", "rbi", "bank", "po", "clerk", "so"];
  if (bankingKeywords.some((k) => titleLower.includes(k))) {
    return "Banking";
  }

  // Defence
  const defenceKeywords = ["cds", "nda", "afcat", "military", "army", "navy", "air force"];
  if (defenceKeywords.some((k) => titleLower.includes(k))) {
    return "Defence";
  }

  // PSU
  const psuKeywords = ["isro", "psu", "onccl", "nuclear", "bhel", "gaIL", "oil", "gas"];
  if (psuKeywords.some((k) => titleLower.includes(k) || orgLower.includes(k))) {
    return "PSU";
  }

  // Railway
  const railwayKeywords = ["rrb", "railway", "metro"];
  if (railwayKeywords.some((k) => titleLower.includes(k))) {
    return "Railway";
  }

  // Teaching
  const teachingKeywords = ["ctet", "net", "set", "tet", "teacher", "professor"];
  if (teachingKeywords.some((k) => titleLower.includes(k))) {
    return "Teaching";
  }

  // State PSC
  const statePscKeywords = ["psc", "pcs", "tpsc", "mpsc", "ppsc", "wpsc", "opscc"];
  if (statePscKeywords.some((k) => titleLower.includes(k))) {
    return "State PSC";
  }

  // Management
  const managementKeywords = ["cat", "mmat", "xat", "cem", "management", "mba"];
  if (managementKeywords.some((k) => titleLower.includes(k))) {
    return "Management";
  }

  // Engineering
  const engineeringKeywords = ["gate", "gre", "gre", "gmat", "engineering", "technical"];
  if (engineeringKeywords.some((k) => titleLower.includes(k))) {
    return "Engineering";
  }

  // Higher Studies
  const higherStudiesKeywords = ["cuet", "gre", "gmat", "mba", "ms", "phd"];
  if (higherStudiesKeywords.some((k) => titleLower.includes(k))) {
    return "Higher Studies";
  }

  return "Central Examination"; // default
}

/**
 * Main crawler function - fetches exams from EasyShiksha and saves to database
 */
async function crawlExamData() {
  console.log("[EasyShikshaCrawler] Starting dynamic exam fetch from EasyShiksha...");

  // Step 1: Fetch the main govt-exam page
  const mainPage = await safeFetch(EASYSHIKSHA_GOVt_EXAM);
  if (!mainPage.success || !mainPage.data) {
    console.error("[EasyShikshaCrawler] Failed to fetch main govt-exam page");
    return { success: false, error: "Failed to fetch main page" };
  }

  console.log(
    `[EasyShikshaCrawler] Fetched main page: ${mainPage.data.length} bytes`
  );

  // Step 2: Extract exam links from all categories
  const allExams = [];

  for (const category of CATEGORIES) {
    console.log(
      `[EasyShikshaCrawler] Processing category: ${category}`
    );

    // Look for category-specific links on the page
    // EasyShiksha organizes exams by category - look for category links
    const categoryLinks = [];

    // Try to find links related to this category
    $(mainPage.data).find(`a[href*="${category.toLowerCase()}"], a:contains('${category}')`).each(
      (idx, elem) => {
        const $elem = $(elem);
        const href = $elem.attr("href");
        const text = $elem.text().trim();

        if (href && text.includes(category)) {
          const fullLink = href.startsWith("http")
            ? href
            : `${EASYSHIKSHA_BASE}${href}`;
          categoryLinks.push({
            title: text,
            link: fullLink,
            category,
          });
        }
      }
    );

    // If no specific category links found, use the main page links
    if (categoryLinks.length === 0) {
      $(mainPage.data)
        .find(".exam-card, .exam-link, .exam-item")
        .each((idx, elem) => {
          const $elem = $(elem);
          const link = $elem.find("a").first().attr("href");
          const title = $elem.find("a").first().text().trim();

          if (link && title) {
            const fullLink = link.startsWith("http") ? link : `${EASYSHIKSHA_BASE}${link}`;
            const examCategory = determineCategory(title, "");
            if (examCategory === category) {
              categoryLinks.push({
                title,
                link: fullLink,
                category,
              });
            }
          }
        });
    }

    // Add discovered exams to the pool
    allExams.push(...categoryLinks);
    console.log(
      `[EasyShikshaCrawler] Category ${category}: found ${categoryLinks.length} exams`
    );
  }

  // Step 3: Deduplicate exams by title
  const seenTitles = new Set();
  const uniqueExams = allExams.filter((exam) => {
    const key = exam.title.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  console.log(
    `[EasyShikshaCrawler] Total unique exams discovered: ${uniqueExams.length}`
  );

  // Step 4: Fetch each exam detail page and extract information
  const examsToSave = [];

  for (const exam of uniqueExams.slice(0, 50)) { // Limit to 50 exams to avoid timeout
    try {
      console.log(
        `[EasyShikshaCrawler] Fetching exam: ${exam.title} (${exam.link})`
      );

      const detailPage = await safeFetch(exam.link);
      if (!detailPage.success || !detailPage.data) {
        console.warn(
          `[EasyShikshaCrawler] Failed to fetch detail page for ${exam.title}`
        );
        continue;
      }

      const extractedDetails = extractExamDetails(detailPage.data);

      // Build the exam document for database
      const examDoc = {
        examId: exam.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        name: exam.title,
        shortName: extractedDetails.shortName || exam.title.split(" ").slice(0, 3).join(" "),
        category: exam.category || determineCategory(exam.title, ""),
        subCategory: "National", // Will be refined from source
        conductingOrganization: extractedDetails.conductingOrganization || "",
        description: extractedDetails.description || "",
        purpose: extractedDetails.purpose || "",
        careerOpportunities: extractedDetails.careerOpportunities || [],
        eligibleDegrees: [
          "B.E.",
          "B.Tech",
          "B.Sc",
          "B.Com",
          "B.A.",
          "Degree in any discipline",
        ],
        eligibleBranches: ["All Specializations"],
        minimumQualification: "Bachelor Degree",
        eligibility: {
          qualificationRequirements: extractedDetails.eligibility?.qualificationRequirements || "",
          minDegree: extractedDetails.eligibility?.minDegree || "Bachelor Degree",
          minPercentage: extractedDetails.eligibility?.minPercentage || "Passing Marks",
          ageRequirements: extractedDetails.eligibility?.ageRequirements || "18 to 30 years",
          nationality: extractedDetails.eligibility?.nationality || "Indian Citizen",
        },
        selectionProcess: [],
        applicationStartDate: null,
        applicationEndDate: null,
        examDate: null,
        importantDates: {
          notificationDate: "",
          applicationStart: "",
          applicationDeadline: "",
          examDate: "",
          resultDate: "",
        },
        applicationUrl: "",
        officialWebsite: "",
        notificationUrl: "",
        syllabusUrl: "",
        examPatternUrl: "",
        status: "NOT_VERIFIED",
        sourceType: "EasyShiksha Dynamic Crawl",
        sourceUrl: exam.link,
        sourceConfidence: "MEDIUM", // Will be updated after verification
        lastVerifiedAt: new Date(),
        active: true,

        // Structured Exam Intelligence
        stages: extractedDetails.stages || [],
        previousPapers: [], // Will be populated later
        sources: [
          {
            title: "EasyShiksha - " + exam.title,
            url: exam.link,
            sourceType: "EDUCATIONAL_PORTAL",
            confidence: "MEDIUM",
            description: "Dynamic crawl from EasyShiksha government exams page",
          },
        ],
      };

      examsToSave.push(examDoc);
      console.log(
        `[EasyShikshaCrawler] Prepared exam: ${examDoc.name} (${examDoc.examId})`
      );

      // Be respectful - small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(
        `[EasyShikshaCrawler] Error processing exam ${exam.title}:`,
        err.message
      );
    }
  }

  // Step 5: Save to database
  if (examsToSave.length > 0) {
    try {
      for (const examDoc of examsToSave) {
        // Use examId as the unique key - upsert to avoid duplicates
        await Exam.findOneAndUpdate(
          { examId: examDoc.examId },
          { $set: examDoc },
          { upsert: true, new: true }
        );
      }
      console.log(
        `[EasyShikshaCrawler] Successfully saved ${examsToSave.length} exams to database`
      );
    } catch (err) {
      console.error("[EasyShikshaCrawler] Database save error:", err.message);
      return { success: false, error: "Database save error" };
    }
  } else {
    console.warn("[EasyShikshaCrawler] No exams were extracted to save");
  }

  // Step 6: Return summary
  return {
    success: true,
    totalDiscovered: uniqueExams.length,
    totalSaved: examsToSave.length,
    categoriesCovered: [...new Set(examsToSave.map((e) => e.category))],
    message: `Dynamic exam fetch completed. ${examsToSave.length} exams saved from ${uniqueExams.length} discovered.`,
  };
}

module.exports = {
  crawlExamData,
  extractExamDetails,
  determineCategory,
  CATEGORIES,
};