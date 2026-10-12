const express = require("express");
const router = express.Router();
const verifyStudent = require("../middleware/verifyStudent");

// Graduate-only resume APIs. The college resume builder uses
// /study-tools/resume-builder instead, so every route here requires a
// graduate account (backend security boundary, not just frontend hiding).
// NOTE: verifyStudent must run before the type check — req.student is only
// populated after authentication.
router.use((req, res, next) => {
  verifyStudent(req, res, () => {
    if (req.student?.userType !== 'graduate') {
      return res.status(403).json({ success: false, message: 'Graduate accounts only' });
    }
    next();
  });
});
const {
  getDefaultResume,
  generateResume,
  analyzeAts,
  resumeReadiness,
  listResumes,
  createResume,
  getResume,
  updateResume,
  deleteResume,
} = require("../controllers/resumeController");

router.get("/resume/default", verifyStudent, getDefaultResume);
router.post("/resume/generate", verifyStudent, generateResume);
router.post("/resume/ats", verifyStudent, analyzeAts);
router.post("/resume/readiness", verifyStudent, resumeReadiness);
router.get("/resumes", verifyStudent, listResumes);
router.post("/resumes", verifyStudent, createResume);
router.get("/resumes/:id", verifyStudent, getResume);
router.put("/resumes/:id", verifyStudent, updateResume);
router.delete("/resumes/:id", verifyStudent, deleteResume);

module.exports = router;
