import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import axiosInstance from '../../../config/axios'
import { SBtn, SInput, SAlert, SCard, SDivider } from '../../components/ui'
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiSmartphone, FiSend } from 'react-icons/fi'

// Pending-flow state shared with the OTP verification page. sessionStorage is
// per-tab and cleared on success — it is NOT an auth session (the real session
// still comes from the JWT via StudentAuthContext).
const PENDING_EMAIL_KEY = 'pendingSigninEmail'
const PENDING_FROM_KEY  = 'pendingSigninFrom'

export default function LoginPage() {
  const { login, isAuthenticated, student } = useStudentAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  let from       = location.state?.from?.pathname || '/student/dashboard'
  if (from === '/signin' || from === '/signup') from = '/student/dashboard'

  // Already signed in? Go straight to the student's dashboard.
  React.useEffect(() => {
    if (isAuthenticated && student) {
      // Identify the authenticated account by its STORED student type —
      // never by the email domain or classLevel.
      const isCollege = student?.userType === 'college_student'
      const isGraduate = student?.userType === 'graduate'
      let dest = from
      if (from === '/student/dashboard') {
        // Route each user type to its own portal, not a generic dashboard.
        dest = isCollege ? '/college/dashboard'
             : isGraduate && student?.onboardingCompleted !== false ? '/student/graduate/dashboard'
             : isGraduate ? '/student/onboarding/graduate'
             : '/student/dashboard'
      }
      navigate(dest, { replace: true })
    }
  }, [isAuthenticated, student, navigate, from])

  // Email-first (OTP) is the default sign-in; password login stays one tap away.
  const [mode,      setMode]     = useState('otp') // 'password' | 'otp'
  const [form,      setForm]     = useState({ email: '', password: '' })
  const [errors,    setErrors]   = useState({})
  const [loading,   setLoading]  = useState(false)
  const [apiError,  setApiError] = useState('')
  const [showPwd,   setShowPwd]  = useState(false)

  const validEmail = (email) => /\S+@\S+\.\S+/.test(email)

  const validate = () => {
    const e = {}
    if (!form.email)                            e.email    = 'Email is required'
    else if (!validEmail(form.email))          e.email    = 'Please enter a valid email address.'
    if (mode === 'password' && !form.password)  e.password = 'Password is required'
    return e
  }

  /* ── Password sign-in (unchanged behaviour) ── */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setApiError('')
    try {
      const res = await axiosInstance.post('/students/login', form)
      localStorage.setItem('studentToken', res.data.token)
      login(res.data.token, res.data.student)
      const s = res.data.student
      const isCollege = s?.userType === 'college_student'
      const isGraduate = s?.userType === 'graduate'
      let dest = from
      if (from === '/student/dashboard') {
        // Route each user type to its own portal, not a generic dashboard.
        dest = isCollege ? '/college/dashboard'
             : isGraduate && s?.onboardingCompleted !== false ? '/student/graduate/dashboard'
             : isGraduate ? '/student/onboarding/graduate'
             : '/student/dashboard'
      }
      navigate(dest, { replace: true })
    } catch (err) {
      // Account exists but the email isn't verified yet — continue the sign-up
      // flow: send a fresh signup code and move to the OTP verification screen.
      if (err.response?.status === 403 && err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        sessionStorage.setItem('pendingSignupEmail', form.email)
        try {
          await axiosInstance.post('/students/resend-otp', { email: form.email })
        } catch (e) {
          // Resend failure shouldn't block the flow — the OTP screen allows retry.
        }
        navigate('/student/signup/verify', { state: { email: form.email }, replace: true })
        return
      }
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.'
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  /* ── OTP sign-in — Step 1: check account + send code, then go to verification ── */
  const continueWithOtp = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setApiError('')
    try {
      await axiosInstance.post('/auth/otp/send', { email: form.email, purpose: 'login' })
      // Hand the email to the OTP page (router state + refresh-safe sessionStorage).
      sessionStorage.setItem(PENDING_EMAIL_KEY, form.email)
      sessionStorage.setItem(PENDING_FROM_KEY, from)
      navigate('/student/verify-otp', { state: { email: form.email, from } })
    } catch (err) {
      const msg = err.response?.data?.message || "We couldn't send the OTP right now. Please try again."
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: '' }))
    setApiError('')
  }

  const switchMode = (m) => {
    setMode(m)
    setErrors({})
    setApiError('')
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
          <h1 style={{ fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 22, color: 'var(--s-text)', marginBottom: 6, textAlign: 'center' }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: 14, color: 'var(--s-text3)', textAlign: 'center', marginBottom: 24 }}>
            Sign in to continue your career journey
          </p>

          {/* OTP ⇄ Password toggle */}
          <div style={{ display: 'flex', background: 'var(--s-bg2)', borderRadius: 99, padding: 4, marginBottom: 24 }}>
            {(['otp', 'password']).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? 'var(--s-primary)' : 'var(--s-text3)',
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--s-font-display)',
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.18s ease',
                }}
              >
                {m === 'otp' ? <FiSmartphone size={14} /> : <FiLock size={14} />}
                {m === 'otp' ? 'Sign in with OTP' : 'Sign in with Password'}
              </button>
            ))}
          </div>

          {apiError && (
            <div style={{ marginBottom: 18 }}>
              <SAlert type="error" onClose={() => setApiError('')}>{apiError}</SAlert>
            </div>
          )}

          {mode === 'otp' ? (
            <form onSubmit={continueWithOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SInput
                label="Email Address" type="email" placeholder="you@email.com"
                icon={<FiMail />} value={form.email}
                onChange={set('email')} error={errors.email}
                id="otp-email"
              />
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '-6px 0 0', lineHeight: 1.6 }}>
                We'll email you a 6-digit code. No password needed.
              </p>
              <SBtn type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading} id="otp-send">
                {loading ? 'Checking…' : <><FiSend size={15} /> Continue</>}
              </SBtn>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SInput
                label="Email Address" type="email" placeholder="you@email.com"
                icon={<FiMail />} value={form.email}
                onChange={set('email')} error={errors.email}
                id="login-email"
              />
              <SInput
                label="Password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Your password"
                icon={<FiLock />}
                value={form.password}
                onChange={set('password')}
                error={errors.password}
                id="login-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--s-text3)', padding: 4, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                }
              />

              <div style={{ textAlign: 'right', marginTop: -10 }}>
                <Link
                  to="/student/forgot-password"
                  style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--s-primary)',
                    textDecoration: 'none', fontFamily: 'var(--s-font-display)',
                    transition: 'opacity 0.2s',
                  }}
                  id="forgot-password-link"
                >
                  Forgot Password?
                </Link>
              </div>

              <SBtn type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading} id="login-submit">
                {loading ? 'Signing In…' : 'Sign In'}
              </SBtn>
            </form>
          )}

          <SDivider label="or" />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--s-text3)' }}>
            Don't have an account?{' '}
            <Link to="/student/signup" style={{ color: 'var(--s-primary)', fontWeight: 700, textDecoration: 'none' }}>
              Create one free →
            </Link>
          </p>
        </SCard>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/student/home" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 600, color: 'var(--s-text3)',
            textDecoration: 'none', fontFamily: 'var(--s-font-display)',
          }}>
            <FiArrowLeft size={15} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}