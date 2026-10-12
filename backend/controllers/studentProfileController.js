"use strict";

// ────────────────────────────────────────────────────────────────────────────
// backend/controllers/studentProfileController.js
//
// Phase 3 — school-student profile API (GET/PUT /api/student/profile).
//
// OWNERSHIP BOUNDARY:
//   Both handlers derive the owner EXCLUSIVELY from req.student._id (set by
//   verifyStudent). These routes take NO :userId/:studentId URL parameter and
//   NEVER read a userId/studentId from the request body. A client cannot select
//   the owner — a student only ever sees/updates their own profile.
// ────────────────────────────────────────────────────────────────────────────

const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const { upsertStudentProfile, pickProfileFields } = require("../utils/studentProfileSync");

// PUT-able User fields — already exist on the User model (no schema change).
// NOTE: userType is intentionally NOT here. It is the account's authoritative
// identity, set at registration and returned at login — a normal profile
// update must never be able to change it. (The explicit school→college
// transition lives in updateCurrentStudy, not in this generic endpoint.)
const USER_FIELDS = ["name", "classLevel", "district"];

// ── GET /api/student/profile ────────────────────────────────────────────────
// Read-only. Returns { success, student, profile }. `student` is the verified
// user with phone/careerInterest merged from the profile. `profile` is null
// when the student has not completed any profile-bearing submit yet.
exports.getStudentProfile = async (req, res) => {
    try {
        const userId = req.student._id; // ownership from token only
        const profile = await StudentProfile.findOne({ userId }).lean();
        res.json({ success: true, student: publicStudent(req.student, profile), profile: profile || null });
    } catch (error) {
        console.error("Get student profile error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch profile" });
    }
};

// ── PUT /api/student/profile ────────────────────────────────────────────────
// Partial update:
//   - User fields (name, classLevel, district) → User (existing columns).
//   - All other whitelisted profile fields + phone → StudentProfile (upsert).
//   - undefined ⇒ preserve stored value; "" ⇒ clear; unknown keys ignored.
// Response keeps the existing ProfilePage contract: `student` carries the User
// fields plus phone/careerInterest merged from the profile, so
// `updateStudent(res.student)` in the frontend works unchanged.
exports.updateStudentProfile = async (req, res) => {
    try {
        const userId = req.student._id; // ownership from token only
        const body = req.body || {};

        // ── Validation: marksPercentage, when supplied and non-empty, 0–100 ──
        if (body.marksPercentage !== undefined && body.marksPercentage !== "") {
            const n = Number(body.marksPercentage);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
                return res.status(400).json({ success: false, message: "marksPercentage must be a number between 0 and 100" });
            }
        }

        // ── User fields (whitelisted, trimmed) ──
        const userPatch = {};
        for (const key of USER_FIELDS) {
            if (body[key] !== undefined) {
                userPatch[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
            }
        }
        if (Object.keys(userPatch).length) {
            await User.findByIdAndUpdate(userId, { $set: userPatch });
        }

        // ── StudentProfile fields (whitelisted inside studentProfileSync) ──
        const profile = await upsertStudentProfile({
            userId,
            classLevel: userPatch.classLevel !== undefined ? userPatch.classLevel : req.student.classLevel,
            fields: pickProfileFields(body),
        });

        // Re-read the user so the response carries the fresh values.
        const freshUser = await User.findById(userId).select("-password").lean();

        res.json({
            success: true,
            message: "Profile updated successfully",
            student: publicStudent(freshUser, profile),
            profile: profile || null,
        });
    } catch (error) {
        console.error("Update student profile error:", error);
        res.status(500).json({ success: false, message: "Failed to update profile" });
    }
};

// ── PATCH /api/student/current-study ─────────────────────────────────────────
// Controls academic stage transitions (e.g. 12th school_student -> college_student)
// and updates existing college student academic profile information.
// Derives identity exclusively from req.student._id (verifyStudent).
const CollegeStudentProfile = require("../models/CollegeStudentProfile");
const College = require("../models/College");
const Course = require("../models/Course");
const CollegeCourseMapping = require("../models/CollegeCourseMapping");

exports.updateCurrentStudy = async (req, res) => {
    try {
        const userId = req.student._id;
        const {
            targetStage, // 'college_student'
            institution,
            institutionDistrict,
            degreeProgramme,
            currentYear,
            specialization,
            field,
            domain,
            saveAsDraft
        } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent accidental invalid reverse transitions
        if (user.userType === "college_student" && targetStage === "school_student") {
            return res.status(400).json({
                success: false,
                message: "Reverse transition from College to School is not supported. Please contact support if your account stage is incorrect."
            });
        }

        // If saving as incomplete draft (e.g. student leaves halfway)
        if (saveAsDraft) {
            user.transitionStatus = "in_progress";
            await user.save();

            // Store draft in college student profile if basic institution exists
            if (institution || degreeProgramme) {
                await CollegeStudentProfile.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            institution: institution || "",
                            institutionDistrict: institutionDistrict || "",
                            degreeProgramme: degreeProgramme || "",
                            field: field || "",
                            currentYear: currentYear || "",
                            domain: domain || "",
                            specialization: specialization || "",
                            isCompleted: false
                        }
                    },
                    { upsert: true, new: true }
                );
            }

            return res.status(200).json({
                success: true,
                message: "Transition setup draft saved successfully",
                transitionStatus: "in_progress",
                student: publicStudent(user)
            });
        }

        // ── Full Transition / Update Validation ──
        if (!targetStage || (targetStage !== "college_student" && targetStage !== "graduate")) {
            return res.status(400).json({ success: false, message: "A valid target academic stage is required." });
        }

        if (!institution || !institution.trim()) {
            return res.status(400).json({ success: false, message: "College/Institution is required." });
        }

        if (!institutionDistrict || !institutionDistrict.trim()) {
            return res.status(400).json({ success: false, message: "District is required." });
        }

        if (!degreeProgramme || !degreeProgramme.trim()) {
            return res.status(400).json({ success: false, message: "Course / Degree Programme is required." });
        }

        if (!currentYear || !currentYear.trim()) {
            return res.status(400).json({ success: false, message: "Academic Year is required." });
        }

        // Validate College exists in database or verify consistency
        const collegeDoc = await College.findOne({
            collegeName: new RegExp(`^${institution.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        }).populate("coursesOffered");

        if (collegeDoc) {
            // District consistency check if district was specified on college
            if (collegeDoc.district && institutionDistrict) {
                const dist1 = collegeDoc.district.toLowerCase().trim();
                const dist2 = institutionDistrict.toLowerCase().trim();
                if (!dist1.includes(dist2) && !dist2.includes(dist1) && dist1 !== "others" && dist2 !== "others") {
                    console.warn(`District mismatch note: college says ${collegeDoc.district}, user selected ${institutionDistrict}`);
                }
            }

            // Verify Course relationship if college has mapped courses
            const mappedRecords = await CollegeCourseMapping.find({ collegeId: collegeDoc._id, isActive: true }).populate("courseId");
            const allMappedCourseNames = [
                ...(collegeDoc.coursesOffered || []).map(c => c.courseName?.toLowerCase()),
                ...mappedRecords.map(m => m.courseId?.courseName?.toLowerCase()).filter(Boolean)
            ];

            if (allMappedCourseNames.length > 0) {
                const requestedLower = degreeProgramme.toLowerCase().trim();
                const isMatch = allMappedCourseNames.some(cn => 
                    cn.includes(requestedLower) || requestedLower.includes(cn)
                );
                if (!isMatch) {
                    // Check if it exists in the general Course database
                    const generalCourse = await Course.findOne({
                        courseName: new RegExp(degreeProgramme.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
                    });
                    if (!generalCourse) {
                        return res.status(400).json({
                            success: false,
                            message: `Course "${degreeProgramme}" is not offered by ${collegeDoc.collegeName}. Please select an offered course.`
                        });
                    }
                }
            }
        }

        // Infer Field & Domain
        let computedField = field || "";
        let computedDomain = domain || specialization || "";

        const progLower = degreeProgramme.toLowerCase();
        if (progLower.includes("m.b.b.s") || progLower.includes("bds") || progLower.includes("medical") || progLower.includes("nursing") || progLower.includes("pharm")) {
            computedField = "medicine";
            if (!computedDomain) computedDomain = "Medical Sciences";
        } else if (progLower.includes("b.com") || progLower.includes("bba") || progLower.includes("mba") || progLower.includes("commerce") || progLower.includes("finance")) {
            computedField = "commerce";
            if (!computedDomain) computedDomain = "Commerce & Finance";
        } else if (progLower.includes("ll.b") || progLower.includes("law")) {
            computedField = "law";
            if (!computedDomain) computedDomain = "Legal Studies";
        } else if (progLower.includes("b.sc") || progLower.includes("m.sc") || progLower.includes("arts") || progLower.includes("humanities")) {
            computedField = "arts_science";
            if (!computedDomain) computedDomain = "Arts & Sciences";
        } else {
            computedField = "engineering";
            if (!computedDomain) {
                if (progLower.includes("computer") || progLower.includes("cse") || progLower.includes("it") || progLower.includes("software") || progLower.includes("data") || progLower.includes("ai")) {
                    computedDomain = "Computer Science";
                } else if (progLower.includes("mech") || progLower.includes("auto")) {
                    computedDomain = "Mechanical Engineering";
                } else if (progLower.includes("electr") || progLower.includes("eee") || progLower.includes("ece")) {
                    computedDomain = "Electrical & Electronics";
                } else if (progLower.includes("civil")) {
                    computedDomain = "Civil Engineering";
                } else {
                    computedDomain = "Engineering";
                }
            }
        }

        // Fetch School Profile for historical context preservation
        const schoolProfile = await StudentProfile.findOne({ userId }).lean();

        // If transitioning from School to College, append to Academic Journey
        if (user.userType === "school_student" || !user.academicJourney || user.academicJourney.length === 0) {
            if (!user.academicJourney) user.academicJourney = [];
            const previousClass = user.classLevel || schoolProfile?.classLevel || "12th";
            
            // Check if school stage is already recorded
            const alreadyRecorded = user.academicJourney.some(j => j.stage === "school_student");
            if (!alreadyRecorded) {
                user.academicJourney.push({
                    stage: "school_student",
                    classLevel: previousClass,
                    institution: schoolProfile?.schoolName || "High School",
                    completedAt: new Date(),
                    transitionNote: `Successfully completed Class ${previousClass} and transitioned to College`
                });
            }
        }

        // Update User
        user.userType = "college_student";
        user.onboardingCompleted = true;
        user.transitionStatus = "completed";
        if (institutionDistrict) user.district = institutionDistrict;
        await user.save();

        // Upsert CollegeStudentProfile atomically (DO NOT duplicate)
        let collegeProfile = await CollegeStudentProfile.findOne({ userId });
        if (!collegeProfile) {
            collegeProfile = new CollegeStudentProfile({
                userId,
                institution: institution.trim(),
                institutionDistrict: institutionDistrict.trim(),
                currentYear: currentYear.trim(),
                degreeProgramme: degreeProgramme.trim(),
                field: computedField,
                domain: computedDomain,
                specialization: specialization ? specialization.trim() : "",
                currentStep: 6,
                isCompleted: true,
                careerInterests: user.selectedCareer ? [user.selectedCareer] : (schoolProfile?.careerInterest ? [schoolProfile.careerInterest] : []),
                targetCareer: user.selectedCareer || schoolProfile?.careerInterest || ""
            });
        } else {
            collegeProfile.institution = institution.trim();
            collegeProfile.institutionDistrict = institutionDistrict.trim();
            collegeProfile.currentYear = currentYear.trim();
            collegeProfile.degreeProgramme = degreeProgramme.trim();
            if (computedField) collegeProfile.field = computedField;
            if (computedDomain) collegeProfile.domain = computedDomain;
            if (specialization !== undefined) collegeProfile.specialization = specialization ? specialization.trim() : "";
            collegeProfile.isCompleted = true;
            if (!collegeProfile.targetCareer && (user.selectedCareer || schoolProfile?.careerInterest)) {
                collegeProfile.targetCareer = user.selectedCareer || schoolProfile?.careerInterest;
            }
        }
        await collegeProfile.save();

        const freshUser = await User.findById(userId).select("-password").lean();

        res.status(200).json({
            success: true,
            message: "Academic stage transitioned to College Student successfully! Welcome to your college portal.",
            student: publicStudent(freshUser, schoolProfile),
            profile: collegeProfile,
            academicJourney: freshUser.academicJourney || []
        });
    } catch (error) {
        console.error("Update current study transition error:", error);
        res.status(500).json({ success: false, message: "Failed to update current study", error: error.message });
    }
};

// ── POST /api/student/cancel-transition ──────────────────────────────────────
exports.cancelTransition = async (req, res) => {
    try {
        const userId = req.student._id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.transitionStatus = "none";
        await user.save();

        res.status(200).json({
            success: true,
            message: "Academic stage transition cancelled",
            transitionStatus: "none"
        });
    } catch (error) {
        console.error("Cancel transition error:", error);
        res.status(500).json({ success: false, message: "Failed to cancel transition" });
    }
};

// ── GET /api/student/academic-journey ─────────────────────────────────────────
exports.getAcademicJourney = async (req, res) => {
    try {
        const userId = req.student._id;
        const [user, schoolProfile, collegeProfile] = await Promise.all([
            User.findById(userId).lean(),
            StudentProfile.findOne({ userId }).lean(),
            CollegeStudentProfile.findOne({ userId }).lean()
        ]);

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({
            success: true,
            userType: user.userType || "school_student",
            classLevel: user.classLevel || (schoolProfile?.classLevel || "12th"),
            academicJourney: user.academicJourney || [],
            transitionStatus: user.transitionStatus || "none",
            schoolProfile: schoolProfile || null,
            collegeProfile: collegeProfile || null
        });
    } catch (error) {
        console.error("Get academic journey error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch academic journey" });
    }
};

// Merge User fields with the display fields the existing ProfilePage expects
// from a saved profile (phone, careerInterest live on StudentProfile).
function publicStudent(user, profile) {
    if (!user) return null;
    const out = {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType || "school_student",
        classLevel: user.classLevel,
        district: user.district,
        onboardingCompleted: user.onboardingCompleted,
        isVerified: user.isVerified,
        academicJourney: user.academicJourney || [],
        transitionStatus: user.transitionStatus || "none",
    };
    if (profile) {
        if (profile.phone !== undefined) out.phone = profile.phone;
        if (profile.careerInterest !== undefined) out.careerInterest = profile.careerInterest;
    }
    return out;
}