const User = require("../models/User");
const AdminNotification = require("../models/AdminNotification");
const Settings = require("../models/Settings");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const getJwtSecret = require("../utils/jwtSecret");
const {
  generateOtp,
  storeOtp,
  sendOtpEmail,
  verifyStoredOtp,
} = require("../utils/otpService");

const registerStudent = async (req, res) => {
  try {
    // Registration can be switched off by the administrator.
    const settings = await Settings.findOne();
    if (settings && settings.studentRegistration === false) {
      return res.status(403).json({ message: "Student registration is currently disabled by administrator." });
    }

    const { name, email, password, userType, classLevel, district } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // A fully verified account already exists — generic message, don't leak more.
    const existingStudent = await User.findOne({ email: normalizedEmail });
    if (existingStudent && existingStudent.isVerified !== false) {
      return res.status(409).json({ message: "An account with this email already exists. Please sign in." });
    }

    // Unverified account? Reuse it (resuming sign-up sends a fresh code instead
    // of raising "already exists" and stranding the user).
    let student = existingStudent;
    let created = false;

    if (!student) {
      // The signup selection is the authoritative student type. It is NEVER
      // inferred from the email domain — a .edu/.ac.in address does not make
      // a School or Graduate account a College account.
      const validUserTypes = ["school_student", "college_student", "graduate"];
      const finalUserType = validUserTypes.includes(userType) ? userType : "school_student";

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create student (Strictly role="student", preventing role escalation).
      // New accounts start UNVERIFIED until the signup OTP succeeds.
      student = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        userType: finalUserType,
        classLevel: classLevel || "",
        district: district || "",
        role: "student",
        status: "active",
        isVerified: false,
      });
      await student.save();
      created = true;

      // Create admin notification for new student registration
      try {
        await AdminNotification.create({
          title: "New Student Registration",
          message: `A new student ${name} (${finalUserType}) has registered.`,
          type: "student_registration",
        });

        // Emit real-time socket event to admin if available
        const io = req.app.get("io");
        if (io) {
          io.to("admins").emit("new_admin_notification", {
            title: "New Student Registration",
            message: `A new student ${name} (${finalUserType}) has registered.`,
            type: "student_registration",
          });
        }
      } catch (notifErr) {
        console.warn("Failed to create admin notification:", notifErr.message);
      }
    }

    // Signup-verification OTP (hashed, 10-minute window) sent to user.email only.
    const otp = generateOtp();
    await storeOtp({ email: normalizedEmail, otp, purpose: "signup" });
    try {
      await sendOtpEmail({ email: normalizedEmail, otp, purpose: "signup" });
      console.log(`Signup OTP sent to ${normalizedEmail}`);
    } catch (emailErr) {
      console.error("Signup OTP email send error:", emailErr);
      return res.status(500).json({ message: "We couldn't send the OTP right now. Please try again." });
    }

    res.status(created ? 201 : 200).json({
      message: created
        ? "Account created. We sent a 6-digit verification code to your email."
        : "A verification code has been sent to your email. Please verify your account.",
      requiresVerification: true,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Error in student registration:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const loginStudent = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing or malformed." });
    }
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Find student (case-insensitive email lookup)
    const student = await User.findOne({ 
      email: new RegExp("^" + normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "$", "i"), 
      role: "student" 
    });
    if (!student) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (student.status === "blocked") {
    // Temporary safe diagnostic (id/role/userType only — no PII).
    console.log('[auth] password login id=' + student._id + ' role=' + student.role + ' userType=' + student.userType);

      return res.status(403).json({ message: "Your account has been blocked by admin" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Unverified accounts must complete sign-up verification before they can use
    // password sign-in. The frontend redirects them into the OTP flow.
    if (student.isVerified === false) {
      return res.status(403).json({
        message: "Please verify your email to complete your sign-up.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // NOTE: userType is the stored, authoritative identity of this account.
    // Login must NEVER re-classify it from the email domain or classLevel —
    // a Graduate with a .edu address stays Graduate, a School account stays
    // School. (Deliberate school→college transitions happen only through the
    // explicit "Update Current Study" flow in studentProfileController.)

    // Generate token
    const token = jwt.sign({ id: student._id }, getJwtSecret(), {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      student: {
        id: student._id,
        _id: student._id,
        name: student.name,
        email: student.email,
        userType: student.userType || "school_student",
        classLevel: student.classLevel,
        district: student.district,
        onboardingCompleted: student.onboardingCompleted,
        isVerified: student.isVerified,
      },
    });
  } catch (error) {
    console.error("Error in student login:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── Signup OTP: verify the emailed code → complete verification + login ───────
// Enforces the shared attempt cap (5) and 10-minute expiry. On success the
// account is marked verified, the code is consumed, and the existing JWT +
// student payload is returned so the app logs the user straight into onboarding.
const verifySignupOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    // Generic failure — never confirm which emails are (semi-)registered.
    const student = await User.findOne({ email, role: "student" });
    if (!student) {
      return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    const result = await verifyStoredOtp({ email, otp, purpose: "signup" });
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }

    if (student.isVerified === false) {
      student.isVerified = true;
      await student.save();
    }

    const token = jwt.sign({ id: student._id }, getJwtSecret(), {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Email verified. Welcome to Uyarvu Payanam!",
      token,
      student: {
        id: student._id,
        _id: student._id,
        name: student.name,
        email: student.email,
        userType: student.userType || "school_student",
        classLevel: student.classLevel,
        district: student.district,
        onboardingCompleted: student.onboardingCompleted,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("Error verifying signup OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── Signup OTP: resend (invalidates the previous code, fresh 10-min window) ───
const resendSignupOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const student = await User.findOne({ email, role: "student" });
    if (!student || student.isVerified !== false) {
      // Nothing to verify (unknown email or account already verified).
      return res.status(404).json({ message: "No pending verification found for this email." });
    }

    const otp = generateOtp();
    await storeOtp({ email, otp, purpose: "signup" });
    try {
      await sendOtpEmail({ email, otp, purpose: "signup" });
      console.log(`Signup OTP resent to ${email}`);
    } catch (emailErr) {
      console.error("Signup OTP resend error:", emailErr);
      return res.status(500).json({ message: "We couldn't send the OTP right now. Please try again." });
    }

    res.status(200).json({ message: "A new code has been sent to your email." });
  } catch (error) {
    console.error("Error resending signup OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  verifySignupOtp,
  resendSignupOtp,
};