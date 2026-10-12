import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import class5CommunicationService from '../../../services/class5CommunicationService'
import { authService } from '../../services'
import axiosInstance from '../../../config/axios'
import { SCard, SBtn, SInput, SSelect, SAlert, SBadge } from '../../components/ui'
import { FiUser, FiMail, FiPhone, FiMapPin, FiBookOpen, FiEdit2, FiSave, FiX, FiCompass, FiArrowRight, FiShield, FiAlertTriangle } from 'react-icons/fi'
import UpdateCurrentStudyModal from '../../components/profile/UpdateCurrentStudyModal'

const LEVELS    = ['5th','6th','7th','8th','9th','10th','11th','12th','Undergraduate','Graduate']
const DISTRICTS = ['Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem','Erode','Tirunelveli','Vellore','Thanjavur','Dindigul','Kanchipuram','Namakkal','Others']
const INTERESTS = ['Engineering','Medical','Arts & Science','Government Services','Design','Business','Law','Skill Based','Not sure yet']

export default function ProfilePage() {
  const { student, updateStudent } = useStudentAuth()
  const navigate = useNavigate()

  const isClass5 = student?.classLevel === '5' || student?.classLevel === '5th' || student?.classLevel === 'Class 5';
  const [commProgress, setCommProgress] = useState(null);

  useEffect(() => {
    if (!student?._id || !isClass5) return;
    class5CommunicationService.getProgress().then(res => {
      if (res.success) {
        setCommProgress(res.data);
      }
    }).catch(err => console.error("Error fetching comm progress in profile:", err));
  }, [student?._id, isClass5]);

  const [showTransitionModal, setShowTransitionModal] = useState(false)
  const [journeyData, setJourneyData] = useState(null)
  const [cancellingTransition, setCancellingTransition] = useState(false)

  const fetchJourney = () => {
    if (!student?._id) return
    axiosInstance.get('/student/academic-journey')
      .then(res => {
        if (res.data?.success) {
          setJourneyData(res.data)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchJourney()
  }, [student?._id])

  const handleCancelTransition = async () => {
    setCancellingTransition(true)
    try {
      await axiosInstance.post('/student/cancel-transition')
      updateStudent({ transitionStatus: 'none' })
      fetchJourney()
    } catch (err) {
      console.warn('Failed to cancel transition', err)
    } finally {
      setCancellingTransition(false)
    }
  }

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name:           student?.name           || '',
    phone:          student?.phone          || '',
    classLevel:     student?.classLevel     || '10th',
    district:       student?.district       || '',
    careerInterest: student?.careerInterest || '',
    userType:       student?.userType       || 'school_student',
  })
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await authService.updateProfile(form)
      const updated = res.student || res.data || form
      updateStudent(updated)
      setSuccess('Profile updated successfully!')
      setEditing(false)
      setTimeout(() => setSuccess(''), 3500)
      if (form.userType === 'college_student') {
        navigate('/college/dashboard')
      } else if (form.userType === 'graduate') {
        navigate('/graduate/dashboard')
      } else if (form.userType === 'school_student') {
        navigate('/student/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({
      name:           student?.name           || '',
      phone:          student?.phone          || '',
      classLevel:     student?.classLevel     || '10th',
      district:       student?.district       || '',
      careerInterest: student?.careerInterest || '',
      userType:       student?.userType       || 'school_student',
    })
    setEditing(false)
    setError('')
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const initials = student?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'S'

  const INFO_ROWS = [
    { icon: <FiUser size={15} />,    label: 'Full Name',       value: student?.name           || '—'                },
    { icon: <FiMail size={15} />,    label: 'Email',           value: student?.email          || '—'                },
    { icon: <FiPhone size={15} />,   label: 'Phone',           value: student?.phone          || 'Not provided'     },
    { icon: <FiBookOpen size={15} />,label: 'Class Level',     value: student?.classLevel ? `Class ${student.classLevel}` : '—' },
    { icon: <FiMapPin size={15} />,  label: 'District',        value: student?.district       || 'Not provided'     },
    { icon: <FiBookOpen size={15} />,label: 'Career Interest', value: student?.careerInterest || 'Not specified'    },
  ]

  return (
    <div className="student-root" style={{ padding: '32px 20px', maxWidth: 700, margin: '0 auto' }}>

      <h1 className="s-anim-up" style={{ fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 'clamp(22px,4vw,30px)', color: 'var(--s-text)', marginBottom: 26 }}>
        My Profile
      </h1>

      {success && <div style={{ marginBottom: 16 }}><SAlert type="success" onClose={() => setSuccess('')}>{success}</SAlert></div>}
      {error   && <div style={{ marginBottom: 16 }}><SAlert type="error"   onClose={() => setError('')}>{error}</SAlert></div>}

      {/* Avatar card */}
      <SCard className="s-anim-up" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 20, padding: '24px', flexWrap: 'wrap' }}>
        <div style={{
          width: 68, height: 68, borderRadius: 18, background: 'var(--s-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 26, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h2 style={{ fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 20, color: 'var(--s-text)', marginBottom: 8 }}>
            {student?.name}
          </h2>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <SBadge color="green" dot>Active</SBadge>
            {student?.classLevel     && <SBadge color="blue">Class {student.classLevel}</SBadge>}
            {student?.district       && <SBadge color="gray">{student.district}</SBadge>}
            {student?.careerInterest && <SBadge color="purple">{student.careerInterest}</SBadge>}
          </div>
        </div>
        {!editing && (
          <SBtn variant="outline" size="sm" onClick={() => setEditing(true)}>
            <FiEdit2 size={14} /> Edit Profile
          </SBtn>
        )}
      </SCard>

      {/* ── ACADEMIC PROFILE & CURRENT STUDY SECTION ── */}
      <SCard className="s-anim-up s-d1" style={{ marginBottom: 18, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FiBookOpen size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--s-font-display)', fontWeight: 800, fontSize: 16, color: 'var(--s-text)' }}>
                Academic Journey & Current Study
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--s-text3)' }}>
                Track your educational milestones and advance smoothly
              </p>
            </div>
          </div>

          <SBtn variant="primary" size="sm" onClick={() => setShowTransitionModal(true)}>
            <FiCompass size={14} /> Update Current Study
          </SBtn>
        </div>

        {/* Current Study Badge & Details */}
        <div style={{
          background: 'var(--s-bg2)',
          borderRadius: 14,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16
        }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--s-text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Study Level
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              {student?.classLevel ? `Class ${student.classLevel}` : '12th Standard'}
              <SBadge color="blue">School Stage</SBadge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--s-text2)', marginTop: 4 }}>
              Active on School Career Discovery & Exploration
            </div>
          </div>

          {/* Academic Journey Milestones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '8px 14px', borderRadius: 10,
              background: '#ecfdf5', border: '1px solid #a7f3d0',
              fontSize: 12, fontWeight: 700, color: '#047857',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              ✓ School Active
            </div>
            <FiArrowRight size={14} color="var(--s-text3)" />
            <div style={{
              padding: '8px 14px', borderRadius: 10,
              background: '#f8fafc', border: '1px dashed #cbd5e1',
              fontSize: 12, fontWeight: 700, color: '#64748b'
            }}>
              ○ College Next
            </div>
          </div>
        </div>

        {/* Incomplete transition prompt if student left halfway */}
        {(student?.transitionStatus === 'in_progress' || journeyData?.transitionStatus === 'in_progress') && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            marginBottom: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FiAlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#92400e' }}>
                  You have an incomplete college setup
                </div>
                <div style={{ fontSize: 12, color: '#b45309' }}>
                  Your college details were saved as draft. Complete the transition whenever you're ready.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <SBtn size="sm" variant="primary" onClick={() => setShowTransitionModal(true)}>
                Continue Setup
              </SBtn>
              <SBtn size="sm" variant="ghost" onClick={handleCancelTransition} disabled={cancellingTransition}>
                Cancel
              </SBtn>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--s-text3)' }}>
          <FiShield size={14} color="#16a34a" />
          <span>Completed 12th standard? Use <strong>Update Current Study</strong> to move to College without creating a second account. All past assessments remain preserved.</span>
        </div>
      </SCard>

      {/* Info card */}
      <SCard className="s-anim-up s-d1" style={{ padding: '28px' }}>
        <h3 style={{ fontFamily: 'var(--s-font-display)', fontWeight: 700, fontSize: 15, color: 'var(--s-text)', marginBottom: 22 }}>
          Personal Information
        </h3>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SInput label="Full Name"    placeholder="Your full name"   icon={<FiUser />}   value={form.name}  onChange={set('name')} />
            <SInput label="Phone Number" placeholder="+91 XXXXX XXXXX"  icon={<FiPhone />}  value={form.phone} onChange={set('phone')} />
            <SSelect label="Student Category" value={form.userType} onChange={set('userType')}>
              <option value="college_student">🎓 College Student (Degree / Diploma)</option>
              <option value="graduate">💼 Graduate (Degree Completed)</option>
              <option value="school_student">🏫 School Student (Class 5 - 12)</option>
            </SSelect>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="s-grid-2col">
              <SSelect label="Class Level" value={form.classLevel} onChange={set('classLevel')}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </SSelect>
              <SSelect label="District" value={form.district} onChange={set('district')}>
                <option value="">Select district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </SSelect>
            </div>
            <SSelect label="Career Interest" value={form.careerInterest} onChange={set('careerInterest')}>
              <option value="">Select your interest</option>
              {INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
            </SSelect>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <SBtn variant="primary" onClick={handleSave} disabled={saving}>
                <FiSave size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </SBtn>
              <SBtn variant="ghost" onClick={handleCancel}>
                <FiX size={14} /> Cancel
              </SBtn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {INFO_ROWS.map((row, i) => (
              <div key={i} style={{ padding: '13px 15px', background: 'var(--s-bg2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--s-text3)', marginBottom: 5 }}>
                  {row.icon}
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--s-font-display)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {row.label}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--s-text)' }}>{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </SCard>

      {isClass5 && commProgress && (
        <SCard className="s-anim-up s-d2" style={{ padding: '28px', marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontFamily: 'var(--s-font-display)', fontWeight: 700, fontSize: 15, color: 'var(--s-text)', margin: 0 }}>
              Communication Passport
            </h3>
            <SBtn variant="outline" size="sm" onClick={() => navigate(`/student/class5/skills/communicationskills/passport/${student._id || student.id}`)}>
              View Shareable Passport ↗
            </SBtn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }} className="s-grid-1col">
            <div style={{ padding: '12px 14px', background: 'var(--s-bg2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Level</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-text)' }}>Level {commProgress.progress?.level || 1}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--s-bg2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total XP</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-text)' }}>{commProgress.progress?.xp || 0} XP</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--s-bg2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Streak</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-text)' }}>{commProgress.progress?.streak || 0} Days 🔥</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Earned Badges</span>
            {commProgress.badges?.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--s-text3)' }}>No badges unlocked yet. Start playing steps to earn!</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {commProgress.badges?.map(b => (
                  <span key={b} style={{ padding: '4px 10px', background: 'var(--s-bg2)', color: 'var(--s-primary)', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid var(--s-border)' }}>
                    🌟 {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SCard>
      )}

      <SCard className="s-anim-up s-d2" style={{ padding: '18px 22px', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--s-text3)', marginBottom: 3 }}>Account Status</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>Active Student Account</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, color: 'var(--s-text3)' }}>
            Member since {student?.createdAt ? new Date(student.createdAt).getFullYear() : new Date().getFullYear()}
          </div>
          {student?._id && (
            <div style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 2 }}>
              ID: {student._id.slice(-8)}
            </div>
          )}
        </div>
      </SCard>

      <UpdateCurrentStudyModal
        isOpen={showTransitionModal}
        onClose={() => {
          setShowTransitionModal(false)
          fetchJourney()
        }}
      />
    </div>
  )
}
