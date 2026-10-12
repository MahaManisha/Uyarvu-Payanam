const express = require("express");
const router = express.Router();
const verifyAdmin = require("../middleware/verifyAdmin");
const {
  listPublished,
  getPublishedById,
  adminList,
  adminGetById,
  adminCreate,
  adminUpdate,
  adminUpdateStatus,
  adminDelete,
  adminStats,
} = require("../controllers/higherStudiesController");

// ── Public read APIs (published records only) ───────────────────────
router.get("/", listPublished);
router.get("/:id", getPublishedById);

// ── Admin CRUD APIs (role-protected) ────────────────────────────────
router.get("/admin/stats", verifyAdmin, adminStats);
router.get("/admin/list", verifyAdmin, adminList);
router.get("/admin/:id", verifyAdmin, adminGetById);
router.post("/admin", verifyAdmin, adminCreate);
router.put("/admin/:id", verifyAdmin, adminUpdate);
router.patch("/admin/:id/status", verifyAdmin, adminUpdateStatus);
router.delete("/admin/:id", verifyAdmin, adminDelete);

module.exports = router;
