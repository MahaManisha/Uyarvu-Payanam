const ApplicationTracker = require("../models/ApplicationTracker");
const GraduateExam = require("../models/GraduateExam");

const STATUSES = [
  "Interested",
  "Planning to Apply",
  "Applied",
  "Exam / Interview Scheduled",
  "Selected",
  "Rejected",
];

// GET /api/applications?status=...
exports.listApplications = async (req, res) => {
  try {
    const filter = { userId: req.student._id };
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      filter.status = req.query.status;
    }
    const items = await ApplicationTracker.find(filter)
      .populate({ path: "examId", populate: { path: "organization" } })
      .sort({ updatedAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to fetch tracked applications", error: e.message });
  }
};

// POST /api/applications
exports.createApplication = async (req, res) => {
  try {
    const { examId, contentType, title, organization, location, status, notes, importantDates } = req.body || {};

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    let finalTitle = (title || "").trim();
    let finalOrg = (organization || "").trim();
    let finalLocation = (location || "").trim();

    if (examId) {
      const exam = await GraduateExam.findById(examId).populate("organization");
      if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
      finalTitle = finalTitle || exam.examName;
      finalOrg = finalOrg || exam.organization?.name || "";
      finalLocation = finalLocation || exam.state || "";
    }

    if (!finalTitle) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    try {
      const created = await ApplicationTracker.create({
        userId: req.student._id,
        examId: examId || null,
        contentType: contentType === "PrivateJob" ? "PrivateJob" : "GraduateExam",
        title: finalTitle,
        organization: finalOrg,
        location: finalLocation,
        status: status || "Interested",
        notes: notes || "",
        importantDates: Array.isArray(importantDates) ? importantDates : [],
      });
      return res.status(201).json({ success: true, message: "Added to your application tracker", data: created });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ success: true, message: "Already tracked", duplicate: true });
      }
      throw err;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to create tracking record", error: e.message });
  }
};

// PUT /api/applications/:id
exports.updateApplication = async (req, res) => {
  try {
    const { status, notes, importantDates, title, organization, location } = req.body || {};
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const update = {};
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (importantDates !== undefined) update.importantDates = importantDates;
    if (title !== undefined) update.title = title;
    if (organization !== undefined) update.organization = organization;
    if (location !== undefined) update.location = location;

    const updated = await ApplicationTracker.findOneAndUpdate(
      { _id: req.params.id, userId: req.student._id },
      { $set: update },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Tracking record not found" });
    res.json({ success: true, message: "Updated", data: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update", error: e.message });
  }
};

// DELETE /api/applications/:id
exports.deleteApplication = async (req, res) => {
  try {
    const removed = await ApplicationTracker.findOneAndDelete({ _id: req.params.id, userId: req.student._id });
    if (!removed) return res.status(404).json({ success: false, message: "Tracking record not found" });
    res.json({ success: true, message: "Removed from tracker" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete", error: e.message });
  }
};
