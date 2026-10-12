const mongoose = require("mongoose");
const RecruitmentOrganization = require("../models/RecruitmentOrganization");
const GraduateExam = require("../models/GraduateExam");
const slugify = require("../utils/slugify");
const {
  syncCentralExams: runCentralSync,
  SourceFetchError,
} = require("../services/easyShikshaExamService");

const VALID_STATUSES = [
  "",
  "TBA",
  "Upcoming",
  "Application Open",
  "Application Closed",
  "Exam Scheduled",
  "Result Released",
  "Archived",
];

/* ─────────────────────────────────────────────────────────────────────────────
   Validation helpers
   ───────────────────────────────────────────────────────────────────────────── */

const isHttpUrl = (value) => {
  if (!value) return true
  const s = String(value).trim()
  if (s === 'Not mentioned' || s === 'Page content unreliable') return true
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(s)
}

// Accepts ISO date, free text with dates/markers, or Not mentioned.
const isValidDateStr = (value) => {
  if (!value) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (s === 'Not mentioned' || s === 'Page content unreliable') return true;
  if (s.includes('CONFLICT - verify on official site')) return true;
  if (s.includes('(tentative)')) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime());
  }
  if (/\d{4}/.test(s)) return true;
  if (/^[A-Za-z0-9:,\-\/()\s]+$/.test(s) && s.length <= 200) return true;
  return false;
};

const toNullIfEmpty = (value) => (value === "" || value === null || value === undefined ? null : value);

const pickNumber = (value) => {
  const v = toNullIfEmpty(value);
  if (v === null) return null;
  const s = String(v).trim();
  if (s === 'Not mentioned' || s === 'Page content unreliable' || s.includes('CONFLICT')) return s;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0) return n;
  // allow numeric strings like "18"
  if (/^\d+$/.test(s)) return s;
  return s || '';
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((x) => x.trim()).filter(Boolean);
  return [];
};

/* ─────────────────────────────────────────────────────────────────────────────
   Slug helpers
   ───────────────────────────────────────────────────────────────────────────── */

async function makeUniqueSlug(Model, baseSlug, excludeId) {
  let slug = baseSlug || "item";
  let candidate = slug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = { slug: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await Model.findOne(q).select("_id").lean();
    if (!exists) return candidate;
    candidate = `${slug}-${n}`;
    n += 1;
  }
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

async function resolveOrganization(value) {
  if (!value) return null;
  const q = validId(value) ? { $or: [{ _id: value }, { slug: String(value).toLowerCase() }] } : { slug: String(value).toLowerCase() };
  return RecruitmentOrganization.findOne(q);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Organizations — RecruitmentOrganization CRUD
   ───────────────────────────────────────────────────────────────────────────── */

// @desc    Get organizations (public read; optional admin includeInactive)
// @route   GET /api/graduate-exams/organizations
exports.getOrganizations = async (req, res) => {
  try {
    const { governmentType, state, search, includeInactive } = req.query;
    const query = {};
    if (!includeInactive) query.isActive = true;
    if (governmentType) query.governmentType = governmentType;
    if (state) query.state = { $regex: String(state).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (search && String(search).trim()) {
      query.$or = [
        { name: { $regex: String(search).trim(), $options: "i" } },
        { description: { $regex: String(search).trim(), $options: "i" } },
      ];
    }
    const organizations = await RecruitmentOrganization.find(query).sort({ governmentType: 1, name: 1 });
    res.status(200).json({ success: true, count: organizations.length, data: organizations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organizations", error: error.message });
  }
};

// @desc    Get single organization
// @route   GET /api/graduate-exams/organizations/:id
exports.getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await (validId(id)
      ? RecruitmentOrganization.findById(id)
      : RecruitmentOrganization.findOne({ slug: String(id).toLowerCase() }));
    if (!organization || (!organization.isActive && !req.query.includeInactive)) {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }
    res.status(200).json({ success: true, data: organization });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organization", error: error.message });
  }
};

// @desc    Create organization
// @route   POST /api/graduate-exams/organizations
exports.createOrganization = async (req, res) => {
  try {
    const { name, governmentType, state, description, officialWebsite, sourceUrl, referenceSource } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Organization name is required" });
    }
    if (!["State", "Central"].includes(governmentType)) {
      return res.status(400).json({ success: false, message: "Government type must be State or Central" });
    }
    if (!isHttpUrl(officialWebsite)) {
      return res.status(400).json({ success: false, message: "Official website must be a valid http(s) URL" });
    }
    if (!isHttpUrl(sourceUrl)) {
      return res.status(400).json({ success: false, message: "Source URL must be a valid http(s) URL" });
    }
    if (!isHttpUrl(referenceSource)) {
      return res.status(400).json({ success: false, message: "Reference source must be a valid http(s) URL" });
    }
    const slug = await makeUniqueSlug(RecruitmentOrganization, slugify(name));
    const organization = await RecruitmentOrganization.create({
      name: String(name).trim(),
      slug,
      governmentType,
      state: state ? String(state).trim() : "",
      description: description || "",
      officialWebsite: (officialWebsite || "").trim(),
      sourceUrl: (sourceUrl || "").trim(),
      referenceSource: (referenceSource || "").trim(),
    });
    res.status(201).json({ success: true, message: "Organization created successfully", data: organization });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create organization", error: error.message });
  }
};

// @desc    Update organization
// @route   PUT /api/graduate-exams/organizations/:id
exports.updateOrganization = async (req, res) => {
  try {
    const organization = await RecruitmentOrganization.findById(req.params.id);
    if (!organization) return res.status(404).json({ success: false, message: "Organization not found" });

    const { name, governmentType, state, description, officialWebsite, sourceUrl, referenceSource } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Organization name cannot be empty" });
    }
    if (governmentType !== undefined && !["State", "Central"].includes(governmentType)) {
      return res.status(400).json({ success: false, message: "Government type must be State or Central" });
    }
    if (officialWebsite !== undefined && !isHttpUrl(officialWebsite)) {
      return res.status(400).json({ success: false, message: "Official website must be a valid http(s) URL" });
    }
    if (sourceUrl !== undefined && !isHttpUrl(sourceUrl)) {
      return res.status(400).json({ success: false, message: "Source URL must be a valid http(s) URL" });
    }
    if (referenceSource !== undefined && !isHttpUrl(referenceSource)) {
      return res.status(400).json({ success: false, message: "Reference source must be a valid http(s) URL" });
    }

    // Keep the stable slug (public URLs rely on it) unless the caller explicitly
    // supplies a new one.
    if (name !== undefined && name.trim()) organization.name = String(name).trim();
    if (governmentType !== undefined) organization.governmentType = governmentType;
    if (state !== undefined) organization.state = String(state).trim();
    if (description !== undefined) organization.description = description;
    if (officialWebsite !== undefined) organization.officialWebsite = String(officialWebsite).trim();
    if (sourceUrl !== undefined) organization.sourceUrl = String(sourceUrl).trim();
    if (referenceSource !== undefined) organization.referenceSource = String(referenceSource).trim();
    if (req.body.isActive !== undefined) organization.isActive = !!req.body.isActive;

    await organization.save();
    res.status(200).json({ success: true, message: "Organization updated successfully", data: organization });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update organization", error: error.message });
  }
};

// @desc    Soft-delete organization (hides it and its exams from students)
// @route   DELETE /api/graduate-exams/organizations/:id
exports.deleteOrganization = async (req, res) => {
  try {
    const organization = await RecruitmentOrganization.findById(req.params.id);
    if (!organization) return res.status(404).json({ success: false, message: "Organization not found" });

    organization.isActive = false;
    await organization.save();
    await GraduateExam.updateMany({ organization: organization._id }, { $set: { isActive: false } });

    res.status(200).json({ success: true, message: "Organization archived", data: organization });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to archive organization", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Exams — GraduateExam CRUD
   ───────────────────────────────────────────────────────────────────────────── */

// Validate + normalize the shared exam body; returns {exam, error} where error
// is a 400 message string (or null when valid).
function validateExamBody(body, existing) {
  const { examName, governmentType, organization, min, max } = body;

  const trimStr = (v) => (v === undefined || v === null ? "" : String(v).trim());

  if (body.organization === undefined) {
    return { error: "Recruitment organization is required" };
  }

  const result = {
    examName: examName !== undefined && !String(examName).trim() ? null : examName,
    shortName: body.shortName,
    governmentType: body.governmentType,
    state: body.state,
    organization: body.organization,
    category: body.category,
    description: body.description,
    qualification: body.qualification,
    eligibleDegrees: body.eligibleDegrees,
    minimumAge: body.minimumAge,
    maximumAge: body.maximumAge,
    ageRelaxation: body.ageRelaxation,
    additionalEligibility: body.additionalEligibility,
    posts: body.posts,
    salary: body.salary,
    selectionProcess: body.selectionProcess,
    examPattern: body.examPattern,
    syllabus: body.syllabus,
    notificationDate: body.notificationDate,
    applicationStartDate: body.applicationStartDate,
    applicationEndDate: body.applicationEndDate,
    examDate: body.examDate,
    resultDate: body.resultDate,
    officialWebsite: body.officialWebsite,
    notificationUrl: body.notificationUrl,
    applicationUrl: body.applicationUrl,
    sourceUrl: body.sourceUrl,
    status: body.status,
    isActive: body.isActive,
  };

  if (result.examName === null) return { error: "Exam name is required" };
  if (governmentType !== undefined && !["State", "Central"].includes(governmentType)) {
    return { error: "Government type must be State or Central" };
  }

  for (const field of ["officialWebsite", "notificationUrl", "applicationUrl", "sourceUrl"]) {
    if (result[field] !== undefined && !isHttpUrl(result[field])) {
      return { error: `${field} must be a valid http(s) URL` };
    }
  }

  const minAge = result.minimumAge === undefined ? undefined : pickNumber(result.minimumAge);
  const maxAge = result.maximumAge === undefined ? undefined : pickNumber(result.maximumAge);
  if (minAge !== undefined && Number.isNaN(minAge)) return { error: "Minimum age must be a number" };
  if (maxAge !== undefined && Number.isNaN(maxAge)) return { error: "Maximum age must be a number" };
  if (minAge !== undefined && maxAge !== undefined && minAge !== null && maxAge !== null && maxAge < minAge) {
    return { error: "Maximum age cannot be less than minimum age" };
  }

  for (const field of ["notificationDate", "applicationStartDate", "applicationEndDate", "examDate", "resultDate"]) {
    if (result[field] !== undefined && !isValidDateStr(result[field])) {
      return { error: `${field} must be a valid date (YYYY-MM-DD)` };
    }
  }
  if (
    result.applicationStartDate &&
    result.applicationEndDate &&
    String(result.applicationEndDate).trim() < String(result.applicationStartDate).trim()
  ) {
    return { error: "Application end date cannot be before the application start date" };
  }

  if (result.status !== undefined && !VALID_STATUSES.includes(result.status)) {
    return { error: "Invalid status value" };
  }

  return { exam: result };
}

// @desc    Get exams (public read; filter + search)
// @route   GET /api/graduate-exams
exports.getExams = async (req, res) => {
  try {
    const { search, governmentType, state, organization, status, category, includeInactive } = req.query;
    const query = {};
    if (!includeInactive) query.isActive = true;
    if (governmentType) query.governmentType = governmentType;
    if (state) query.state = { $regex: String(state).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (status && String(status).trim()) query.status = String(status).trim();
    if (category && String(category).trim()) query.category = String(category).trim();

    if (organization) {
      const org = await resolveOrganization(organization);
      if (!org) return res.status(200).json({ success: true, count: 0, data: [] });
      query.organization = org._id;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { examName: { $regex: term, $options: "i" } },
        { shortName: { $regex: term, $options: "i" } },
        { category: { $regex: term, $options: "i" } },
      ];
    }

    const exams = await GraduateExam.find(query)
      .populate("organization", "name slug governmentType state officialWebsite sourceUrl referenceSource description")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: exams.length, data: exams });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch exams", error: error.message });
  }
};

// @desc    Get exam by ObjectId or slug (public read)
// @route   GET /api/graduate-exams/:idOrSlug
exports.getExamByIdOrSlug = async (req, res) => {
  try {
    const key = String(req.params.idOrSlug);
    const query = validId(key) ? { _id: key } : { slug: key.toLowerCase() };
    const exam = await GraduateExam.findOne(query).populate(
      "organization",
      "name slug governmentType state officialWebsite sourceUrl referenceSource description"
    );
    if (!exam || (!exam.isActive && !req.query.includeInactive)) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch exam", error: error.message });
  }
};

// @desc    Create exam
// @route   POST /api/graduate-exams
exports.createExam = async (req, res) => {
  try {
    const { exam, error } = validateExamBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const organization = await resolveOrganization(exam.organization);
    if (!organization || !organization.isActive) {
      return res.status(400).json({ success: false, message: "Recruitment organization not found" });
    }

    // Duplicate check — same exam name under the same organization.
    const dup = await GraduateExam.findOne({
      organization: organization._id,
      examName: { $regex: `^${String(exam.examName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (dup) return res.status(400).json({ success: false, message: "An exam with this name already exists for this organization" });

    // The organization is the source of truth for governmentType/state.
    const governmentType = exam.governmentType || organization.governmentType;
    const state = exam.state || organization.state;
    if (governmentType !== organization.governmentType) {
      return res.status(400).json({ success: false, message: "Government type does not match the organization" });
    }

    const slug = await makeUniqueSlug(GraduateExam, slugify(exam.examName));

    const created = await GraduateExam.create({
      examName: String(exam.examName).trim(),
      shortName: String(exam.shortName || "").trim(),
      slug,
      governmentType,
      state,
      organization: organization._id,
      category: exam.category || "",
      description: exam.description || "",
      qualification: exam.qualification || "",
      eligibleDegrees: toArray(exam.eligibleDegrees),
      minimumAge: exam.minimumAge,
      maximumAge: exam.maximumAge,
      ageRelaxation: exam.ageRelaxation || "",
      additionalEligibility: exam.additionalEligibility || "",
      posts: toArray(exam.posts),
      salary: exam.salary || "",
      selectionProcess: toArray(exam.selectionProcess),
      examPattern: {
        mode: exam.examPattern?.mode || "",
        duration: exam.examPattern?.duration || "",
        questions: exam.examPattern?.questions || "",
        marks: exam.examPattern?.marks || "",
        subjects: toArray(exam.examPattern?.subjects),
      },
      syllabus: toArray(exam.syllabus),
      notificationDate: exam.notificationDate || "",
      applicationStartDate: exam.applicationStartDate || "",
      applicationEndDate: exam.applicationEndDate || "",
      examDate: exam.examDate || "",
      resultDate: exam.resultDate || "",
      officialWebsite: exam.officialWebsite || "",
      notificationUrl: exam.notificationUrl || "",
      applicationUrl: exam.applicationUrl || "",
      sourceUrl: exam.sourceUrl || "",
      status: exam.status || "",
      isActive: exam.isActive !== undefined ? !!exam.isActive : true,
    });

    res.status(201).json({ success: true, message: "Exam created successfully", data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: "An exam with this name already exists for this organization" });
    }
    res.status(500).json({ success: false, message: "Failed to create exam", error: error.message });
  }
};

// @desc    Update exam (every editable field)
// @route   PUT /api/graduate-exams/:id
exports.updateExam = async (req, res) => {
  try {
    const exam = await GraduateExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const { exam: data, error } = validateExamBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    if (req.body.organization !== undefined) {
      const organization = await resolveOrganization(req.body.organization);
      if (!organization || !organization.isActive) {
        return res.status(400).json({ success: false, message: "Recruitment organization not found" });
      }
      const governmentType = data.governmentType || organization.governmentType;
      if (governmentType !== organization.governmentType) {
        return res.status(400).json({ success: false, message: "Government type does not match the organization" });
      }
      exam.organization = organization._id;
      exam.governmentType = organization.governmentType;
      exam.state = (data.state !== undefined ? data.state : organization.state) || "";
    } else if (data.governmentType) {
      exam.governmentType = data.governmentType;
    }

    if (data.examName !== undefined) {
      const name = String(data.examName).trim();
      const dup = await GraduateExam.findOne({
        _id: { $ne: exam._id },
        organization: exam.organization,
        examName: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });
      if (dup) return res.status(400).json({ success: false, message: "An exam with this name already exists for this organization" });
      exam.examName = name;
    }

    // Slug stays stable unless name changed AND a fresh slug is explicitly asked.
    if (req.body.regenerateSlug && data.examName) {
      exam.slug = await makeUniqueSlug(GraduateExam, slugify(String(data.examName).trim()), exam._id);
    }

    const setIfPresent = (field, transform) => {
      const value = req.body[field];
      if (value !== undefined) exam[field] = transform ? transform(value) : value;
    };

    setIfPresent("shortName", (v) => String(v || "").trim());
    setIfPresent("category", (v) => v || "");
    setIfPresent("description", (v) => v || "");
    setIfPresent("qualification", (v) => v || "");
    setIfPresent("eligibleDegrees", (v) => toArray(v));
    if (req.body.minimumAge !== undefined) exam.minimumAge = req.body.minimumAge;
    if (req.body.maximumAge !== undefined) exam.maximumAge = req.body.maximumAge;
    setIfPresent("ageRelaxation", (v) => v || "");
    setIfPresent("additionalEligibility", (v) => v || "");
    setIfPresent("posts", (v) => toArray(v));
    setIfPresent("salary", (v) => v || "");
    setIfPresent("selectionProcess", (v) => toArray(v));
    setIfPresent("syllabus", (v) => toArray(v));
    for (const dateField of ["notificationDate", "applicationStartDate", "applicationEndDate", "examDate", "resultDate"]) {
      setIfPresent(dateField, (v) => v || "");
    }
    for (const urlField of ["officialWebsite", "notificationUrl", "applicationUrl", "sourceUrl"]) {
      setIfPresent(urlField, (v) => String(v || "").trim());
    }
    setIfPresent("status", (v) => (v === undefined ? "" : v));
    if (req.body.isActive !== undefined) exam.isActive = !!req.body.isActive;

    if (req.body.examPattern !== undefined) {
      exam.examPattern = {
        mode: req.body.examPattern?.mode || "",
        duration: req.body.examPattern?.duration || "",
        questions: req.body.examPattern?.questions || "",
        marks: req.body.examPattern?.marks || "",
        subjects: toArray(req.body.examPattern?.subjects),
      };
    }

    await exam.save();
    res.status(200).json({ success: true, message: "Exam updated successfully", data: exam });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: "An exam with this name already exists for this organization" });
    }
    res.status(500).json({ success: false, message: "Failed to update exam", error: error.message });
  }
};

// @desc    Soft-delete / archive exam
// @route   DELETE /api/graduate-exams/:id
exports.deleteExam = async (req, res) => {
  try {
    const exam = await GraduateExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    exam.isActive = false;
    await exam.save();

    res.status(200).json({ success: true, message: "Exam archived", data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to archive exam", error: error.message });
  }
};

// @desc    Sync Central Government exams from the EasyShiksha source.
//          Admin-only, idempotent; returns a run summary. Source/scraping
//          internals are logged server-side and never returned to the client —
//          a per-exam failure is only counted, never fatal.
// @route   POST /api/graduate-exams/central/sync
exports.syncCentralExams = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const summary = await runCentralSync({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    });
    res.status(200).json(summary);
  } catch (error) {
    if (error instanceof SourceFetchError) {
      console.error("[graduate-exams] central sync — source unreachable:", error.message);
      return res
        .status(502)
        .json({ success: false, message: "Could not reach the exam source right now. Please try again later." });
    }
    console.error("[graduate-exams] central sync failed:", error);
    res.status(500).json({ success: false, message: "Central exam sync failed. Please try again." });
  }
};