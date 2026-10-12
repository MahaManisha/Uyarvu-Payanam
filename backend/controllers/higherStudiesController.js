const HigherStudiesOpportunity = require("../models/HigherStudiesOpportunity");

function buildSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function validatePayload(body) {
  if (!body.courseName || !String(body.courseName).trim()) return "Course name is required";
  if (!body.courseCategory) return "Course category is required";
  return null;
}

// ── Public: list published courses ────────────────────────────────
exports.listPublished = async (req, res) => {
  try {
    const { search = "", category = "", background = "", page = "1", limit = "12", sort = "-createdAt" } = req.query;
    const filter = { status: "Published" };
    if (category) filter.courseCategory = category;
    if (search) {
      filter.$or = [
        { courseName: new RegExp(search, "i") },
        { definition: new RegExp(search, "i") },
        { targetAcademicBackground: new RegExp(search, "i") },
      ];
    }
    if (background) {
      filter.$or = [
        { targetAcademicBackground: new RegExp(background, "i") },
        { eligibleDegree: new RegExp(background, "i") },
        { eligibleStreams: new RegExp(background, "i") },
      ];
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;
    const [courses, total] = await Promise.all([
      HigherStudiesOpportunity.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      HigherStudiesOpportunity.countDocuments(filter),
    ]);
    res.json({ success: true, courses, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error("List published higher studies error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch courses" });
  }
};

// ── Public: get one published course by ID ────────────────────────
exports.getPublishedById = async (req, res) => {
  try {
    const course = await HigherStudiesOpportunity.findOne({ _id: req.params.id, status: "Published" }).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, course });
  } catch (error) {
    console.error("Get published course error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch course" });
  }
};

// ── Admin: list all courses ───────────────────────────────────────
exports.adminList = async (req, res) => {
  try {
    const { search = "", status = "", category = "", page = "1", limit = "20" } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.courseCategory = category;
    if (search) {
      filter.$or = [
        { courseName: new RegExp(search, "i") },
        { definition: new RegExp(search, "i") },
      ];
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [courses, total] = await Promise.all([
      HigherStudiesOpportunity.find(filter).sort("-createdAt").skip(skip).limit(limitNum).lean(),
      HigherStudiesOpportunity.countDocuments(filter),
    ]);
    res.json({ success: true, courses, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error("Admin list higher studies error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch courses" });
  }
};

// ── Admin: get one course by ID ───────────────────────────────────
exports.adminGetById = async (req, res) => {
  try {
    const course = await HigherStudiesOpportunity.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, course });
  } catch (error) {
    console.error("Admin get course error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch course" });
  }
};

// ── Admin: create course ──────────────────────────────────────────
exports.adminCreate = async (req, res) => {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const payload = { ...req.body, slug: buildSlug(req.body.courseName), createdBy: req.admin?._id };
    const course = await HigherStudiesOpportunity.create(payload);
    res.status(201).json({ success: true, message: "Course created successfully", course });
  } catch (error) {
    console.error("Create higher studies error:", error);
    res.status(500).json({ success: false, message: "Failed to create course" });
  }
};

// ── Admin: update course ──────────────────────────────────────────
exports.adminUpdate = async (req, res) => {
  try {
    const course = await HigherStudiesOpportunity.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    const updatableFields = [
      "courseName", "courseCategory", "definition", "detailedContent",
      "duration", "targetAcademicBackground", "thumbnail",
      "eligibleDegree", "eligibleStreams", "minimumMarks",
      "requiredSubjects", "workExperience", "additionalConditions", "eligibilityNotes",
      "exams", "specialisations", "careerPath", "bestSuitedFor",
      "studyMode", "fees", "recognition", "additionalNotes",
      "officialCourseUrl", "sourceUrl", "status",
    ];
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) course[field] = req.body[field];
    }
    if (req.body.courseName && req.body.courseName !== course.courseName) {
      course.slug = buildSlug(req.body.courseName);
    }
    await course.save();
    res.json({ success: true, message: "Course updated successfully", course });
  } catch (error) {
    console.error("Update higher studies error:", error);
    res.status(500).json({ success: false, message: "Failed to update course" });
  }
};

// ── Admin: change status ─────────────────────────────────────────
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Draft", "Published", "Archived"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const course = await HigherStudiesOpportunity.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, message: `Course ${status.toLowerCase()} successfully`, course });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

// ── Admin: delete course ──────────────────────────────────────────
exports.adminDelete = async (req, res) => {
  try {
    const course = await HigherStudiesOpportunity.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete higher studies error:", error);
    res.status(500).json({ success: false, message: "Failed to delete course" });
  }
};

// ── Admin: get stats ──────────────────────────────────────────────
exports.adminStats = async (req, res) => {
  try {
    const stats = await HigherStudiesOpportunity.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const total = await HigherStudiesOpportunity.countDocuments();
    const byCategory = await HigherStudiesOpportunity.aggregate([{ $group: { _id: "$courseCategory", count: { $sum: 1 } } }]);
    res.json({ success: true, total, stats, byCategory });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};
