import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import axiosInstance from '../../../config/axios'
import { SBtn, SAlert, SCard } from '../../components/ui'
import OtpInput from '../../components/ui/OtpInput'
import { FiArrowLeft, FiShield, FiLogOut, FiRefreshCw } from 'react-icons/fi'

// The pending-flow email is carried over from the Sign In page (router state +
// sessionStorage so a hard refresh keeps the flow alive).
const PENDING_EMAIL_KEY = 'pendingSigninEmail'
const PENDING_FROM_KEY  = 'pendingSigninFrom'

const RESEND_COOLDOWN_S = 30

// p****@gmail.com style mask — shows just the first letter and the domain.
const maskEmail = (email) => {
  const at = email.indexOf('@')
  if (at <= 1) return email
  return `${email.slice(0, 1)}****${email.slice(at)}`
}

export default function VerifyOtpPage() {
  const { login, isAuthenticated } = useStudentAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const email = (location.state?.email || sessionStorage.getItem(PENDING_EMAIL_KEY) || '').trim().toLowerCase()
  const from  = location.state?.from || sessionStorage.getItem(PENDING_FROM_KEY) || '/student/dashboard'

  const [otp,       setOtp]      = useState('')
  const [loading,   setLoading]  = useState(false)
  const [resending, setResending] = useState(false)
  const [apiError,  setApiError] = useState('')
  const [notice,    setNotice]   = useState('')
  const [cooldown,  setCooldown] = useState(RESEND_COOLDOWN_S)

  // No email available (deep link/wiped state) → back to Sign In.
  useEffect(() => {
    if (!email) navigate('/student/signin', { replace: true })
  }, [email, navigate])

  // Already authenticated → straight to the destination.
  useEffect(() => {
    if (isAuthenticated && email) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from, email])

  // Resend countdown timer.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const clearPending = () => {
    sessionStorage.removeItem(PENDING_EMAIL_KEY)
    sessionStorage.removeItem(PENDING_FROM_KEY)
  }

  /* Verified → reuse the app's exact auth hand-off (StudentAuthContext + JWT). */
  const verifyOtp = async (ev) => {
    ev.preventDefault()
    if (otp.length !== 6) { setApiError('Please enter the 6-digit code'); return }
    setLoading(true)
    setApiError('')
    setNotice('')
    try {
      const res = await axiosInstance.post('/auth/login/otp', { email, otp })
      clearPending()
      login(res.data.token, res.data.student)
      // Fresh/unverified accounts that just verified their email should land on
      // onboarding, not the dashboard.
      const isCollege = s?.userType === 'college_student'
      const isGraduate = s?.userType === 'graduate'

      const dest = isCollege ? '/college/dashboard' : (s?.onboardingCompleted === false ? (isGraduate ? '/student/onboarding/graduate' : '/student/onboarding') : (isGraduate ? '/student/graduate/dashboard' : from))
      navigate(dest, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Please try again.'
      setApiError(msg)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  /* Resend → invalidates the old code on the server (new OTP + 5 min window). */
  const resendOtp = async () => {
    setResending(true)
    setApiError('')
    setNotice('')
    try {
      await axiosInstance.post('/auth/resend-otp', { email })
      setOtp('')
      setCooldown(RESEND_COOLDOWN_S)
      setNotice('A new code was sent to your email.')
    } catch (err) {
      const msg = err.response?.data?.message || "We couldn't send the OTP right now. Please try again."
      setApiError(msg)
    } finally {
      setResending(false)
    }
  }

  /* Change email → back to Sign In (no session data created). */
  const changeEmail = () => {
    clearPending()
    navigate('/student/signin', { state: { mode: 'otp' } })
  }

  return (
    <div className="student-root" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(140deg,#f7f6f3 0%,#eaf3ee 100%)',
      padding: '80px 20px 40px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/student/home" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/logo.png"
              alt="Uyarvu Payanam"
              style={{ height: 44, width: 'auto', objectFit: 'contain', borderRadius: 12 }}
            />
            <span style={{ fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 22, color: 'var(--s-text)' }}>
              Uyarvu <span style={{ color: 'var(--s-primary)' }}>Payanam</span>
            </span>
          </Link>
        </div>

        <SCard style={{ padding: '36px 32px' }} className="s-anim-up">
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--s-primary-l)', color: 'var(--s-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <FiShield size={26} />
          </div>

          <h1 style={{ fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 22, color: 'var(--s-text)', marginBottom: 6, textAlign: 'center' }}>
            Verify your email
          </h1>
          <p style={{ fontSize: 14, color: 'var(--s-text3)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
            We sent a 6-digit verification code to{' '}
            <strong style={{ color: 'var(--s-text)' }}>{maskEmail(email)}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--s-text3)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
            Didn't see it? Check your <strong>Spam / Promotions</strong> folder, then use Resend below.
          </p>

          {notice && (
            <div style={{ marginBottom: 18 }}>
              <SAlert type="success" onClose={() => setNotice('')}>{notice}</SAlert>
            </div>
          )}
          {apiError && (
            <div style={{ marginBottom: 18 }}>
              <SAlert type="error" onClose={() => setApiError('')}>{apiError}</SAlert>
            </div>
          )}

          <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <OtpInput length={6} value={otp} onChange={(v) => setOtp(v)} disabled={loading} id="verify-otp-box" />
            </div>

            <SBtn type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || otp.length !== 6} id="verify-otp-submit">
              {loading ? 'Verifying…' : 'Verify OTP'}
            </SBtn>
          </form>

          {/* Resend with cooldown */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--s-border)' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--s-text3)' }}>
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={resendOtp}
              disabled={cooldown > 0 || resending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: cooldown > 0 || resending ? 'not-allowed' : 'pointer',
                color: cooldown > 0 ? 'var(--s-text3)' : 'var(--s-primary)',
                fontSize: 13.5, fontWeight: 700, fontFamily: 'var(--s-font-display)', padding: 0,
              }}
              id="resend-otp"
            >
              <FiRefreshCw size={14} />
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : resending ? 'Sending…' : 'Resend OTP'}
            </button>

            <button
              type="button"
              onClick={changeEmail}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--s-text3)', fontSize: 13, fontWeight: 600, padding: 0,
              }}
              id="change-email"
            >
              <FiLogOut size={13} /> Change email
            </button>
          </div>
        </SCard>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/student/signin" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 600, color: 'var(--s-text3)',
            textDecoration: 'none', fontFamily: 'var(--s-font-display)',
          }}>
            <FiArrowLeft size={15} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}