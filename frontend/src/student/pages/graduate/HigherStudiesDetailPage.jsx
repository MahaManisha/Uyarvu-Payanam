import React, { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import higherStudiesService from '../../services/higherStudiesService'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { SCard, SBtn, SLoader, SBadge } from '../../components/ui'
import { FiArrowLeft, FiExternalLink, FiBookmark, FiCheck, FiClock, FiAward, FiBookOpen, FiBriefcase, FiDollarSign, FiGlobe, FiCalendar, FiTarget, FiUsers, FiFileText } from 'react-icons/fi'

export default function HigherStudiesDetailPage() {
  const { id } = useParams()
  const { isAuthenticated } = useStudentAuth()
  const location = useLocation()
  const backPath = location.pathname.split('/').slice(0, -1).join('/') || '/higher-studies'
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchCourse = async () => {
      setLoading(true); setError('')
      try {
        const res = await higherStudiesService.getById(id)
        if (res?.success) { setCourse(res.course) } else { setError(res.message || 'Course not found.') }
      } catch { setError('Could not load course details.') } finally { setLoading(false) }
    }
    fetchCourse()
  }, [id])

  useEffect(() => {
    if (!isAuthenticated) return
    const checkSaved = async () => {
      try {
        const res = await higherStudiesService.getSavedList()
        if (res?.success && res.data) setSaved(res.data.some(s => String(s.contentId?._id || s.contentId) === id))
      } catch { /* ignore */ }
    }
    checkSaved()
  }, [id, isAuthenticated])

  const toggleSave = async () => {
    if (!isAuthenticated) return
    try {
      if (saved) { await higherStudiesService.unsave(id); setSaved(false) }
      else { await higherStudiesService.save(id); setSaved(true) }
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <SLoader />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-text3)' }}>Loading course details...</div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 700, color: 'var(--s-text)' }}>{error || 'Course not found'}</div>
        <Link to="/student/graduate/higher-studies"><SBtn variant="primary" style={{ marginTop: 16 }}><FiArrowLeft size={14} style={{ marginRight: 6 }} />Back to Courses</SBtn></Link>
      </div>
    )
  }

  const c = course

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} className="s-anim-up">
      {/* Back + Save */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link to={backPath} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--s-primary)', textDecoration: 'none' }}>
          <FiArrowLeft size={14} /> Back to Courses
        </Link>
        {isAuthenticated && (
          <button onClick={toggleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: saved ? '#dcfce7' : '#fff', border: '1px solid var(--s-border)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: saved ? '#16a34a' : 'var(--s-text2)' }}>
            {saved ? <FiCheck size={14} /> : <FiBookmark size={14} />} {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>

      {/* 1. Course Overview */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', color: '#5b21b6', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          <FiAward size={14} /> {c.courseCategory}
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>{c.courseName}</h1>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--s-text3)' }}>
          {c.targetAcademicBackground && <span>🎯 {c.targetAcademicBackground}</span>}
          {c.duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiClock size={13} /> {c.duration}</span>}
          {c.studyMode && <span>📖 {c.studyMode}</span>}
        </div>
      </div>

      {/* Quick Facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        {c.duration && <SCard style={{ padding: 14, borderRadius: 14, textAlign: 'center' }}><FiClock size={20} color="#7c3aed" style={{ margin: '0 auto 6px' }} /><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text)' }}>{c.duration}</div><div style={{ fontSize: 11, color: 'var(--s-text3)' }}>Duration</div></SCard>}
        {c.studyMode && <SCard style={{ padding: 14, borderRadius: 14, textAlign: 'center' }}><FiBookOpen size={20} color="#7c3aed" style={{ margin: '0 auto 6px' }} /><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text)' }}>{c.studyMode}</div><div style={{ fontSize: 11, color: 'var(--s-text3)' }}>Study Mode</div></SCard>}
        {c.fees && <SCard style={{ padding: 14, borderRadius: 14, textAlign: 'center' }}><FiDollarSign size={20} color="#7c3aed" style={{ margin: '0 auto 6px' }} /><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text)' }}>{c.fees}</div><div style={{ fontSize: 11, color: 'var(--s-text3)' }}>Fees</div></SCard>}
        {c.recognition && <SCard style={{ padding: 14, borderRadius: 14, textAlign: 'center' }}><FiAward size={20} color="#7c3aed" style={{ margin: '0 auto 6px' }} /><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text)' }}>{c.recognition}</div><div style={{ fontSize: 11, color: 'var(--s-text3)' }}>Recognition</div></SCard>}
      </div>

      {/* 2. Course Definition and Content */}
      <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Course Overview</h3>
        <p style={{ fontSize: 14, color: 'var(--s-text2)', lineHeight: 1.7, margin: 0 }}>
          {c.detailedContent || c.definition || 'No description available.'}
        </p>
      </SCard>

      {/* 3. Eligibility */}
      {(c.eligibleDegree || c.eligibleStreams?.length > 0 || c.minimumMarks || c.requiredSubjects || c.workExperience || c.additionalConditions) && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Eligibility</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.eligibleDegree && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Eligible Degree:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.eligibleDegree}</span></div>}
            {c.eligibleStreams?.length > 0 && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Eligible Streams:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.eligibleStreams.join(', ')}</span></div>}
            {c.minimumMarks && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Minimum Marks:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.minimumMarks}</span></div>}
            {c.requiredSubjects && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Required Subjects:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.requiredSubjects}</span></div>}
            {c.workExperience && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Work Experience:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.workExperience}</span></div>}
            {c.additionalConditions && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Additional Conditions:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.additionalConditions}</span></div>}
            {c.eligibilityNotes && <div style={{ fontSize: 12, color: 'var(--s-text3)', fontStyle: 'italic', marginTop: 4 }}>ℹ️ {c.eligibilityNotes}</div>}
          </div>
        </SCard>
      )}

      {/* 4. Entrance / Professional Exams */}
      {c.exams?.length > 0 && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Entrance / Professional Exams</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {c.exams.map((exam, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--s-text)', marginBottom: 8 }}>{exam.examName || `Exam ${i + 1}`}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {exam.examDefinition && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Purpose:</strong> <span style={{ color: 'var(--s-text2)' }}>{exam.examDefinition}</span></div>}
                  {exam.eligibility && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Eligibility:</strong> <span style={{ color: 'var(--s-text2)' }}>{exam.eligibility}</span></div>}
                  {exam.examPattern && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Pattern:</strong> <span style={{ color: 'var(--s-text2)' }}>{exam.examPattern}</span></div>}
                  {exam.syllabus && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Syllabus:</strong> <span style={{ color: 'var(--s-text2)' }}>{exam.syllabus}</span></div>}
                  {exam.officialExamUrl && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Official Website:</strong> <a href={exam.officialExamUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{exam.officialExamUrl}</a></div>}
                  {exam.examInfo && <div style={{ fontSize: 12, color: 'var(--s-text3)', fontStyle: 'italic' }}>{exam.examInfo}</div>}
                </div>
              </div>
            ))}
          </div>
        </SCard>
      )}

      {/* 5. Specialisations */}
      {c.specialisations?.length > 0 && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>What Can You Specialise In?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {c.specialisations.map((spec, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--s-text)', marginBottom: 6 }}>{spec.name || `Specialisation ${i + 1}`}</div>
                {spec.description && <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, margin: '0 0 8px' }}>{spec.description}</p>}
                {spec.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {spec.skills.map((skill, j) => (
                      <span key={j} style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{skill}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SCard>
      )}

      {/* 6. Career Path */}
      {(c.careerPath?.overview || c.careerPath?.jobRoles?.length > 0 || c.careerPath?.furtherStudy) && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Career Path & Popular Job Roles</h3>
          {c.careerPath?.overview && <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.6, margin: '0 0 12px' }}>{c.careerPath.overview}</p>}
          {c.careerPath?.jobRoles?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {c.careerPath.jobRoles.map((role, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text)' }}>{role.role || `Role ${i + 1}`}</div>
                  {role.skillsRequired && <div style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 2 }}>Skills: {role.skillsRequired}</div>}
                </div>
              ))}
            </div>
          )}
          {c.careerPath?.furtherStudy && (
            <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Further Study:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.careerPath.furtherStudy}</span></div>
          )}
        </SCard>
      )}

      {/* 7. Best Suited For */}
      {(c.bestSuitedFor?.overview || c.bestSuitedFor?.recommendedBackground || c.bestSuitedFor?.careerGoals || c.bestSuitedFor?.interests || c.bestSuitedFor?.whoShouldConsider || c.bestSuitedFor?.considerations) && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Best Suited For</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.bestSuitedFor?.overview && <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.6, margin: 0 }}>{c.bestSuitedFor.overview}</p>}
            {c.bestSuitedFor?.recommendedBackground && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Recommended Background:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.bestSuitedFor.recommendedBackground}</span></div>}
            {c.bestSuitedFor?.careerGoals && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Career Goals:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.bestSuitedFor.careerGoals}</span></div>}
            {c.bestSuitedFor?.interests && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Interests / Strengths:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.bestSuitedFor.interests}</span></div>}
            {c.bestSuitedFor?.whoShouldConsider && <div style={{ fontSize: 13 }}><strong style={{ color: 'var(--s-text)' }}>Who Should Consider:</strong> <span style={{ color: 'var(--s-text2)' }}>{c.bestSuitedFor.whoShouldConsider}</span></div>}
            {c.bestSuitedFor?.considerations && <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, border: '1px solid #fde68a', marginTop: 4 }}>⚠️ {c.bestSuitedFor.considerations}</div>}
          </div>
        </SCard>
      )}

      {/* 8. Duration, Study Mode and Fees */}
      {(c.duration || c.studyMode || c.fees || c.recognition) && (
        <SCard style={{ padding: 24, borderRadius: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 12px' }}>Duration, Study Mode & Fees</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {c.duration && <div><div style={{ fontSize: 11, color: 'var(--s-text3)', fontWeight: 700 }}>Duration</div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{c.duration}</div></div>}
            {c.studyMode && <div><div style={{ fontSize: 11, color: 'var(--s-text3)', fontWeight: 700 }}>Study Mode</div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{c.studyMode}</div></div>}
            {c.fees && <div><div style={{ fontSize: 11, color: 'var(--s-text3)', fontWeight: 700 }}>Fees</div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{c.fees}</div></div>}
            {c.recognition && <div><div style={{ fontSize: 11, color: 'var(--s-text3)', fontWeight: 700 }}>Recognition</div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{c.recognition}</div></div>}
          </div>
        </SCard>
      )}

      {/* 9. Official Links */}
      {(c.officialCourseUrl || c.sourceUrl) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {c.officialCourseUrl && (
            <a href={c.officialCourseUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s-primary)', color: '#fff', borderRadius: 14, padding: '14px 24px', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
              Visit Official Course Page <FiExternalLink size={16} />
            </a>
          )}
          {c.sourceUrl && (
            <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: 'var(--s-text2)', borderRadius: 14, padding: '12px 20px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              <FiFileText size={14} /> Source Article
            </a>
          )}
        </div>
      )}

      {/* Additional Notes */}
      {c.additionalNotes && (
        <div style={{ padding: '14px 20px', borderRadius: 14, background: '#f8fafc', border: '1px solid var(--s-border)', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--s-text2)' }}><strong>Additional Notes:</strong> {c.additionalNotes}</div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ padding: '14px 20px', borderRadius: 14, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div style={{ fontSize: 12, color: '#92400e' }}>
          <strong>Disclaimer:</strong> Eligibility, fees and deadlines vary by institution. Always verify the latest information from the official course/admission notification before applying. Career outcomes depend on skills, experience, institution, and chosen specialisation — completing a course does not guarantee a job.
        </div>
      </div>
    </div>
  )
}
