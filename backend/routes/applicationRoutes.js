const express = require("express");
const router = express.Router();
const verifyStudent = require("../middleware/verifyStudent");
const {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} = require("../controllers/applicationController");

router.get("/", verifyStudent, listApplications);
router.post("/", verifyStudent, createApplication);
router.put("/:id", verifyStudent, updateApplication);
router.delete("/:id", verifyStudent, deleteApplication);

module.exports = router;
