import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import graduateService from '../../../services/graduateService'
import { useStudentAuth } from '../../context/StudentAuthContext'

const INTEREST_OPTIONS = [
  { id: 'Central Government Exams', desc: 'UPSC, SSC, Banking, Railways, defence & PSU recruitment' },
  { id: 'State Government Exams', desc: 'State PSC, police, teacher & departmental exams' },
  { id: 'Private-Sector Jobs', desc: 'IT, core, banking & corporate careers' },
  { id: 'Both Government and Private Opportunities', desc: 'Keep all options open' },
]

const STATES = ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Delhi', 'Uttar Pradesh', 'Gujarat', 'West Bengal', 'Other']
const QUALIFICATIONS = ['10th', '12th / Diploma', 'Undergraduate (B.E/B.Tech/B.Sc/B.A/B.Com)', 'Postgraduate (M.E/MBA/M.Sc/M.A)', 'Doctorate']
const INDUSTRIES = ['Information Technology', 'Banking & Finance', 'Healthcare', 'Manufacturing', 'Education', 'Government Services', 'E-commerce', 'Core Engineering', 'Media', 'Other']
const ROLE_OPTIONS = ['Software Engineer', 'Data Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Accountant', 'Marketing Executive', 'Teacher', 'Nurse', 'Sales Executive', 'HR / Recruiter', 'Other']
const EMPLOYMENT = ['Fresher / Not working', 'Student', 'Experienced candidate', 'Currently employed', 'Between jobs']
const WORK_MODES = ['Remote', 'Hybrid', 'On-site', 'Flexible']
const AGE_RANGES = ['18–21', '22–25', '26–30', '31–35', '36 and above']

const cardOn = { border: '2px solid #2563eb', background: '#eff6ff' }
const cardOff = { border: '2px solid #e2e8f0', background: '#fff' }
const input = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }

export default function GraduateInterestOnboardingPage() {
  const navigate = useNavigate()
  const { updateStudent } = useStudentAuth()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    careerInterests: [],
    // government
    selectedExams: [], examPreparation: '', targetState: '',
    degree: '', domain: '', graduationYear: '', ageRange: '',
    // private
    preferredRoles: [], preferredIndustries: [], technicalSkillsText: '',
    employmentStatus: '', preferredLocations: [], remotePreference: '', expectedSalary: '',
  })

  const interests = form.careerInterests
  const wantsGov = interests.some((i) => i.includes('Government') || i.includes('Both'))
  const wantsPrivate = interests.some((i) => i.includes('Private') || i.includes('Both'))

  const steps = [
    { id: 1, label: 'Career Interest' },
    ...(wantsGov ? [{ id: 2, label: 'Government Preferences' }] : []),
    ...(wantsPrivate ? [{ id: 3, label: 'Private Job Preferences' }] : []),
    { id: 4, label: 'Review & Save' },
  ]
  const currentIdx = steps.findIndex((s) => s.id === step)

  const toggle = (key, value) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }))

  const canContinue = () => {
    setError('')
    if (step === 1 && interests.length === 0) return setError('Please select at least one opportunity type.'), false
    if (step === 2) {
      if (wantsGov && interests.includes('State Government Exams') && !form.targetState && !interests.includes('Both Government and Private Opportunities')) {
        // target state optional-ish; require degree at least
      }
      if (!form.degree || !form.domain || !form.graduationYear) return setError('Please fill qualification, department and graduation year.'), false
    }
    if (step === 3) {
      if (form.preferredRoles.length === 0) return setError('Please select at least one job role.'), false
      if (!form.employmentStatus) return setError('Please tell us your employment status.'), false
    }
    return true
  }

  const saveProgress = async (partial) => {
    try {
      await graduateService.saveStep(partial)
    } catch (e) {
      console.warn('Progress save failed', e?.message)
    }
  }

  const next = async () => {
    if (!canContinue()) return
    if (step === 1) await saveProgress({ careerInterests: form.careerInterests })
    if (step === 2) await saveProgress({ degree: form.degree, domain: form.domain, graduationYear: form.graduationYear, targetState: form.targetState, ageRange: form.ageRange, examPreparation: form.examPreparation })
    if (step === 3) {
      await saveProgress({
        preferredRoles: form.preferredRoles,
        preferredIndustries: form.preferredIndustries,
        preferredLocations: form.preferredLocations,
        remotePreference: form.remotePreference || 'Flexible',
        expectedSalary: form.expectedSalary,
        employmentStatus: form.employmentStatus,
        technicalSkills: form.technicalSkillsText.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name, proficiency: 'Intermediate' })),
      })
    }
    const ids = steps.map((s) => s.id)
    const idx = ids.indexOf(step)
    setStep(ids[Math.min(idx + 1, ids.length - 1)])
  }

  const back = () => {
    setError('')
    const ids = steps.map((s) => s.id)
    const idx = ids.indexOf(step)
    setStep(ids[Math.max(idx - 1, 0)])
  }

  const submit = async () => {
    try {
      setSaving(true)
      await saveProgress({ careerInterests: form.careerInterests, targetState: form.targetState, ageRange: form.ageRange, examPreparation: form.examPreparation, preferredLocations: form.preferredLocations, preferredRoles: form.preferredRoles, preferredIndustries: form.preferredIndustries, employmentStatus: form.employmentStatus })
      const res = await graduateService.completeOnboarding({})
      if (res.success) {
        // CRITICAL: update the auth context so StudentProtectedRoute sees
        // onboardingCompleted=true — otherwise it bounces the user straight
        // back to onboarding (infinite loop).
        updateStudent({ userType: 'graduate', onboardingCompleted: true })
        navigate('/student/graduate/dashboard', { replace: true })
      } else setError(res.message || 'Could not save onboarding.')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '32px 36px' }}>
        {/* progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div style={{ height: 5, borderRadius: 4, background: i <= currentIdx ? '#2563eb' : '#e2e8f0' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: i <= currentIdx ? '#2563eb' : '#94a3b8', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>{error}</div>}

        {step === 1 && (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>What type of opportunities are you looking for?</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13.5 }}>Select all that apply — we will tailor the next steps accordingly.</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {INTEREST_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => toggle('careerInterests', opt.id)}
                  style={{ ...(interests.includes(opt.id) ? cardOn : cardOff), borderRadius: 14, padding: '14px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <span style={{ display: 'block', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{opt.id}</span>
                    <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 3 }}>{opt.desc}</span>
                  </span>
                  {interests.includes(opt.id) && <FiCheck color="#2563eb" />}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Government exam preferences</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <label style={lbl}>Highest qualification *
                <select value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} style={input}>
                  <option value="">Select…</option>
                  {QUALIFICATIONS.map((q) => <option key={q}>{q}</option>)}
                </select>
              </label>
              <label style={lbl}>Degree / department *
                <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} style={input} placeholder="e.g. Computer Science, Civil" />
              </label>
              <label style={lbl}>Graduation year *
                <input value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} style={input} placeholder="e.g. 2025" />
              </label>
              <label style={lbl}>Target state (for state exams)
                <select value={form.targetState} onChange={(e) => setForm({ ...form, targetState: e.target.value })} style={input}>
                  <option value="">All India / Any</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label style={lbl}>Age range (optional, used only for eligibility matching)
                <select value={form.ageRange} onChange={(e) => setForm({ ...form, ageRange: e.target.value })} style={input}>
                  <option value="">Prefer not to say</option>
                  {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <label style={lbl}>Already preparing for competitive exams?
                <select value={form.examPreparation} onChange={(e) => setForm({ ...form, examPreparation: e.target.value })} style={input}>
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>Planning to start</option>
                  <option>No</option>
                </select>
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Private job preferences</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={lbl}>Job roles you are interested in *</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ROLE_OPTIONS.map((r) => (
                    <button type="button" key={r} onClick={() => toggle('preferredRoles', r)} style={chip(interestsOf(form.preferredRoles, r))}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={lbl}>Preferred industries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {INDUSTRIES.map((r) => (
                    <button type="button" key={r} onClick={() => toggle('preferredIndustries', r)} style={chip(interestsOf(form.preferredIndustries, r))}>{r}</button>
                  ))}
                </div>
              </div>
              <label style={lbl}>Skills (comma separated)
                <input value={form.technicalSkillsText} onChange={(e) => setForm({ ...form, technicalSkillsText: e.target.value })} style={input} placeholder="e.g. Java, React, Accounting" />
              </label>
              <label style={lbl}>Employment status *
                <select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })} style={input}>
                  <option value="">Select…</option>
                  {EMPLOYMENT.map((e) => <option key={e}>{e}</option>)}
                </select>
              </label>
              <div>
                <div style={lbl}>Preferred locations</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {STATES.slice(0, 8).map((r) => (
                    <button type="button" key={r} onClick={() => toggle('preferredLocations', r)} style={chip(interestsOf(form.preferredLocations, r))}>{r}</button>
                  ))}
                </div>
              </div>
              <label style={lbl}>Work mode
                <select value={form.remotePreference} onChange={(e) => setForm({ ...form, remotePreference: e.target.value })} style={input}>
                  <option value="">Flexible</option>
                  {WORK_MODES.map((w) => <option key={w}>{w}</option>)}
                </select>
              </label>
              <label style={lbl}>Expected salary range (optional)
                <input value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} style={input} placeholder="e.g. 3–5 LPA" />
              </label>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Review your preferences</h2>
            <ReviewRow label="Opportunity types" value={interests.join(', ')} />
            {wantsGov && (
              <>
                <ReviewRow label="Qualification" value={form.degree} />
                <ReviewRow label="Department" value={form.domain} />
                <ReviewRow label="Graduation year" value={form.graduationYear} />
                <ReviewRow label="Target state" value={form.targetState || 'All India'} />
                <ReviewRow label="Exam preparation" value={form.examPreparation || '—'} />
              </>
            )}
            {wantsPrivate && (
              <>
                <ReviewRow label="Job roles" value={form.preferredRoles.join(', ')} />
                <ReviewRow label="Industries" value={form.preferredIndustries.join(', ') || '—'} />
                <ReviewRow label="Employment status" value={form.employmentStatus} />
                <ReviewRow label="Preferred locations" value={form.preferredLocations.join(', ') || 'Any'} />
                <ReviewRow label="Work mode" value={form.remotePreference || 'Flexible'} />
              </>
            )}
            <p style={{ fontSize: 12.5, color: '#94a3b8' }}>You can update these later from My Profile.</p>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          <button onClick={back} disabled={currentIdx === 0} style={{ ...btn, opacity: currentIdx === 0 ? 0.4 : 1 }}><FiChevronLeft /> Back</button>
          {step !== 4 ? (
            <button onClick={next} style={btnPrimary}>Continue <FiChevronRight /></button>
          ) : (
            <button onClick={submit} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save & Go to Dashboard'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

const interestsOf = (arr, v) => arr.includes(v)
const chip = (active) => ({ padding: '7px 13px', borderRadius: 20, border: '1.5px solid', borderColor: active ? '#2563eb' : '#e2e8f0', background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' })
const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#475569' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13.5 }}>
      <span style={{ color: '#64748b', fontWeight: 700 }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}
