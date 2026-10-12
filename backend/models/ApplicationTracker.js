const mongoose = require("mongoose");

/**
 * ApplicationTracker – one user's private tracking record for a government
 * exam or a private-sector opportunity. Records are always scoped to the
 * authenticated user (userId) and never shared.
 */
const applicationTrackerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Link to the managed opportunity when it exists in our DB (GraduateExam).
    // Private-sector jobs may be tracked without a DB link (free-text title).
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GraduateExam",
      default: null,
    },
    contentType: {
      type: String,
      enum: ["GraduateExam", "PrivateJob"],
      default: "GraduateExam",
    },
    title: { type: String, required: true, trim: true },
    organization: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: [
        "Interested",
        "Planning to Apply",
        "Applied",
        "Exam / Interview Scheduled",
        "Selected",
        "Rejected",
      ],
      default: "Interested",
    },
    notes: { type: String, default: "" },
    importantDates: [
      {
        label: { type: String, default: "" },
        date: { type: String, default: "" }, // free-form; never fabricated
      },
    ],
  },
  { timestamps: true }
);

// One tracking row per user per managed exam (private jobs may have several
// free-text rows since examId is null for them).
applicationTrackerSchema.index(
  { userId: 1, examId: 1 },
  { unique: true, partialFilterExpression: { examId: { $type: "objectId" } } }
);

module.exports = mongoose.model("ApplicationTracker", applicationTrackerSchema);
