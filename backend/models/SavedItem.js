const mongoose = require("mongoose");

const savedItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Student or general User
      required: true,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "contentType", // Dynamic ref
      required: true,
    },
    contentType: {
      type: String,
      required: true,
      enum: ["ClassContent", "CareerPath", "Scholarship", "CollegeScholarship", "Course", "College", "Exam", "GraduateExam", "HigherStudiesOpportunity"],
    },
    metadata: {
      type: Object,
      default: {},
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user doesn't save the same item multiple times
savedItemSchema.index({ userId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model("SavedItem", savedItemSchema);
