const User = require("../models/User");
const PasswordResetToken = require("../models/PasswordResetToken");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const getJwtSecret = require("../utils/jwtSecret");

// Reuse the project's shared Gmail transporter (see config/mailer.js). Credentials
// come from environment variables only — never hardcoded.
const { transporter, defaultFrom } = require("../config/mailer");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// OTP helpers live in utils/otpService.js so the sign-up flow (studentController)
// and the sign-in / reset flows all share one implementation.
const {
  generateOtp,
  storeOtp,
  sendOtpEmail,
  verifyStoredOtp,
} = require("../utils/otpService");

// ── Register & Login are delegated below (legacy aliases of the student flow) ──
// /api/auth/register and /api/auth/login are legacy aliases of the student
// endpoints the app actually uses — delegate so both stay in lock-step
// (including the sign-up OTP verification flow and the unverified-account gate).
const { registerStudent, loginStudent } = require("./studentController");
const register = registerStudent;
const login = loginStudent;

// ── OTP request (sign-in codes AND reset codes) ────────────────────────────────
// Single endpoint used by both flows. The purpose tells us which code to mint:
//   purpose = "login"  → OTP sign-in (alternative to password)
//   purpose = "reset"  → password reset (from the "Forgot password" flow)
// For SIGN-IN we check the users database first: an unknown email gets an explicit
// "No account found" response and no OTP is generated. For RESET the response stays
// generic so the forgot-password flow does not reveal which emails are registered.
const requestOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing or malformed." });
    }
    const email = String(req.body.email || "").trim().toLowerCase();
    const purpose = req.body.purpose === "reset" ? "reset" : "login";

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const user = await User.findOne(
      purpose === "login" ? { email, role: "student" } : { email }
    );

    if (purpose === "login" && !user) {
      // No account with this email — do NOT send an OTP.
      return res.status(404).json({ message: "No account found with this email. Please sign up first." });
    }

    if (user) {
      const otp = generateOtp();
      await storeOtp({ email, otp, purpose });
      try {
        await sendOtpEmail({ email, otp, purpose });
        console.log(`OTP (${purpose}) sent to ${email}`);
      } catch (emailErr) {
        console.error("OTP email send error:", emailErr);
        return res.status(500).json({ message: "We couldn't send the OTP right now. Please try again." });
      }
    } else {
      // Reset flow, unknown email: burn similar time and respond identically.
      await sleep(300);
    }

    res.status(200).json({
      message: user
        ? "A verification code has been sent to your email."
        : "If an account exists for this email, a verification code has been sent.",
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ── OTP sign-in ────────────────────────────────────────────────────────────────
const verifyLoginOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing or malformed." });
    }
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const result = await verifyStoredOtp({ email, otp, purpose: "login" });
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }

    const student = await User.findOne({ email, role: "student" });
    if (!student) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (student.status === "blocked") {
    // Temporary safe diagnostic (id/role/userType only — no PII).
    console.log('[auth] otp login id=' + student._id + ' role=' + student.role + ' userType=' + student.userType);

      return res.status(403).json({ message: "Your account has been blocked by admin" });
    }

    // A successful OTP proves email ownership, so it also completes any pending
    // sign-up verification — the account can then use password sign-in too.
    if (student.isVerified === false) {
      student.isVerified = true;
      await student.save();
    }

    // NOTE: userType is the stored, authoritative identity of this account.
    // A successful OTP proves email ownership — it does NOT prove the account
    // is a College account. Never re-classify from the email domain or
    // classLevel here (a Graduate with a .edu address stays Graduate).

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
    console.error("Verify login OTP error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ── Resend sign-in OTP ─────────────────────────────────────────────────────────
// Mint a fresh 5-minute code and invalidate the previous one. The 30 second
// resend cooldown is enforced by route-level rate limiting (see authRoutes.js).
const resendOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const user = await User.findOne({ email, role: "student" });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email. Please sign up first." });
    }

    const otp = generateOtp();
    // Invalidate the previous code, store the new one (5 minute expiry).
    await storeOtp({ email, otp, purpose: "login" });

    try {
      await sendOtpEmail({ email, otp, purpose: "login" });
      console.log(`Sign-in OTP resent to ${email}`);
    } catch (emailErr) {
      console.error("Resend OTP email send error:", emailErr);
      return res.status(500).json({ message: "We couldn't send the OTP right now. Please try again." });
    }

    res.status(200).json({ message: "A new code has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ── Forgot Password (step 1: request a reset code) ─────────────────────────────
// Sends an OTP for password reset instead of a clickable link. The response is
// identical whether or not the email exists, so we don't leak registered emails.
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (user) {
      const otp = generateOtp();
      await storeOtp({ email, otp, purpose: "reset" });
      try {
        await sendOtpEmail({ email, otp, purpose: "reset" });
        console.log(`Password reset OTP sent to ${email}`);
      } catch (emailErr) {
        console.error("Reset OTP email send error:", emailErr);
        return res.status(500).json({ message: "We couldn't send the OTP right now. Please try again." });
      }
    } else {
      await sleep(300);
    }

    res.status(200).json({
      message: "If an account with that email exists, a password reset code has been sent."
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ── Forgot Password (step 2: verify the reset code → single-use reset token) ──
// On a correct code we hand the client a 15-minute, single-use reset token.
// Only the bcrypt hash of that token is stored.
const verifyResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const result = await verifyStoredOtp({ email, otp, purpose: "reset" });
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(resetToken, salt);

    // Single-use: only one active reset token per email.
    await PasswordResetToken.deleteMany({ email });
    await PasswordResetToken.create({
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      used: false,
    });

    res.status(200).json({
      message: "Code verified. You can now set a new password.",
      token: resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({
      message: "Server error. Please try again later.",
      token: null,
    });
  }
};

// ── Reset Password (step 3: consume token + new password) ──────────────────────
// Validates the short-lived single-use reset token, then updates password_hash.
// Still supports the legacy link-based tokens (stored hashed on the User doc),
// so old reset emails keep working.
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    let user = null;
    let resetDoc = null;

    // New flow — token hash lives in the PasswordResetToken collection (bcrypt).
    const query = { used: false, expiresAt: { $gt: new Date() } };
    if (email) query.email = email;
    const candidates = await PasswordResetToken.find(query).sort({ createdAt: -1 }).limit(20);

    for (const rec of candidates) {
      if (await bcrypt.compare(token, rec.tokenHash)) {
        resetDoc = rec;
        break;
      }
    }
    if (resetDoc) {
      user = await User.findOne({ email: resetDoc.email });
    }

    // Legacy flow — link tokens stored as sha256 hashes on the User document.
    if (!user) {
      const legacyHash = crypto.createHash("sha256").update(token).digest("hex");
      user = await User.findOne({
        resetPasswordToken: legacyHash,
        resetPasswordExpires: { $gt: Date.now() },
      });
    }

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset code. Please request a new one."
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    if (resetDoc) {
      // New flow: mark the token as used (single-use).
      resetDoc.used = true;
      await user.save();
      await resetDoc.save();
    } else {
      // Legacy flow: clear the stored token fields.
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
    }

    // Send confirmation email
    try {
      await transporter.sendMail({
        from: `"Uyarvu Payanam" <${defaultFrom}>`,
        to: user.email,
        subject: "Password Changed Successfully - Uyarvu Payanam",
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafb; padding: 32px;">
            <div style="background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
              <div style="text-align: center; margin-bottom: 28px;">
                <h1 style="color: #0f4c75; font-size: 24px; margin: 0;">Uyarvu Payanam</h1>
              </div>
              <h2 style="color: #111827; font-size: 20px; margin-bottom: 12px;">Password Changed</h2>
              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Hello <strong>${user.name}</strong>,
              </p>
              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Your password has been successfully changed. If you did not make this change, please contact us immediately.
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn("Confirmation email send error:", emailErr.message);
    }

    res.status(200).json({ message: "Password reset successful. You can now sign in." });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

module.exports = {
  register,
  login,
  requestOtp,
  verifyLoginOtp,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};