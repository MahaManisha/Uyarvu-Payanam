import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../../config/axios'
import { SCard, SBtn, SInput, SSelect, STextarea, SBadge, AIGenerating } from '../../components/ui'
import {
  FiFileText, FiDownload, FiCheckCircle, FiZap, FiPlus, FiUser,
  FiTarget, FiShield, FiBriefcase, FiTrash2, FiSave, FiEye,
  FiBookOpen, FiAward, FiGlobe, FiLinkedin, FiGithub, FiCpu,
  FiCamera, FiX, FiTrendingUp, FiLayers,
} from 'react-icons/fi'
import { downloadResumePdf, TEMPLATE_LIST, getTemplate } from './resumePdf'

const CATEGORY_OPTIONS = [
  { id: 'JOB', label: 'Private Jobs / Corporate' },
  { id: 'GOVERNMENT', label: 'Government / Public Sector' },
  { id: 'HIGHER_STUDIES', label: 'Higher Studies / MS / M.Tech' },
  { id: 'RESEARCH', label: 'Research & Academia' },
  { id: 'INTERNSHIP', label: 'Internship / Apprenticeship' },
]

const DEFAULT_VISIBILITY = {
  summary: true, education: true, skills: true, experience: true, internships: true,
  projects: true, certifications: true, achievements: true, publications: true,
  research: true, languages: true, custom: true,
}

const VISIBILITY_LABELS = {
  summary: 'Summary', education: 'Education', skills: 'Skills', experience: 'Experience',
  internships: 'Internships', projects: 'Projects', certifications: 'Certifications',
  achievements: 'Achievements', publications: 'Publications', research: 'Research',
  languages: 'Languages', custom: 'Custom Sections',
}

const EMPTY_PERSONAL = {
  fullName: '', email: '', phone: '', location: '', degree: '', specialization: '',
  institution: '', graduationYear: '', cgpa: '', percentage: '', linkedin: '', github: '',
  portfolio: '', photoUrl: '',
}

// Client-side resize so the stored data URL stays small and embeds cleanly in PDFs.
function resizeImageFile(file, maxW = 320, maxH = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('Invalid image'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

const certToString = (c) => {
  if (typeof c === 'string') return c
  return [c?.name, c?.issuer, c?.issueYear || c?.year].filter(Boolean).join(' — ')
}

/* ── Small shared sub-components ─────────────────────────────────────────── */
function SectionCard({ title, icon, action, actionLabel = '+ Add', children }) {
  return (
    <SCard style={{ padding: 22, borderRadius: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--s-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} {title}
        </h3>
        {action && (
          <SBtn variant="secondary" onClick={action} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>
            <FiPlus size={13} /> {actionLabel}
          </SBtn>
        )}
      </div>
      {children}
    </SCard>
  )
}

function ChipEditor({ items = [], onAdd, onRemove, placeholder, emptyLabel = 'Nothing added yet.', color = '#f1f5f9' }) {
  const [value, setValue] = useState('')
  const commit = () => {
    const v = value.trim()
    if (!v) return
    if (!items.includes(v)) onAdd(v)
    setValue('')
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <SInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder={placeholder}
        />
        <SBtn variant="secondary" onClick={commit} style={{ borderRadius: 10, flexShrink: 0 }}>
          <FiPlus /> Add
        </SBtn>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--s-text3)' }}>{emptyLabel}</span>}
        {items.map((it) => (
          <span key={it} style={{ background: color, color: '#334155', padding: '4px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {it}
            <button type="button" onClick={() => onRemove(it)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <FiX size={12} />
            </button>
          </span>
        ))}
      </div>
    </>
  )
}

const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const subCard = { padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 10 }

/* ── Live preview ────────────────────────────────────────────────────────── */
function PreviewHeading({ accent, children }) {
  return (
    <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: accent, borderBottom: `1.5px solid ${accent}66`, paddingBottom: 3, marginBottom: 7, letterSpacing: '0.06em' }}>{children}</h4>
  )
}

function PreviewRow({ left, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{left}</span>
      {right && <span style={{ fontSize: 11.5, color: '#4b5563', flexShrink: 0 }}>{right}</span>}
    </div>
  )
}

function ResumePreview({ draft, templateId }) {
  const t = getTemplate(templateId)
  const p = draft.personalInfo || {}
  const vis = draft.sectionVisibility || {}
  const on = (k) => vis[k] !== false
  const centered = t.align === 'center'
  const fontFamily = t.font === 'times' ? 'Georgia, "Times New Roman", serif' : 'Helvetica, Arial, sans-serif'

  const education = (draft.education && draft.education.length)
    ? draft.education
    : (p.degree || p.institution
      ? [{ degree: p.degree, specialization: p.specialization, institution: p.institution, duration: p.graduationYear, cgpaOrPercentage: p.cgpa }]
      : [])

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio].filter(Boolean)

  return (
    <div style={{ fontFamily, color: '#111827', fontSize: 12.5, lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', borderBottom: `2px solid ${t.accent}`, paddingBottom: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: centered ? 'center' : 'left' }}>
          <div style={{ fontSize: 23, fontWeight: 800, textTransform: t.uppercaseName ? 'uppercase' : 'none', color: '#0f172a', letterSpacing: '-0.01em' }}>
            {p.fullName || 'Your Name'}
          </div>
          {draft.targetRole && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, marginTop: 2 }}>{draft.targetRole}</div>
          )}
          {contacts.length > 0 && (
            <div style={{ fontSize: 11.5, color: '#4b5563', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 8px', justifyContent: centered ? 'center' : 'flex-start' }}>
              {contacts.map((c, i) => <span key={i}>{c}</span>)}
            </div>
          )}
        </div>
        {p.photoUrl && (
          <img src={p.photoUrl} alt="Profile" style={{ width: 78, height: 98, objectFit: 'cover', borderRadius: 4, border: `1px solid ${t.accent}55`, flexShrink: 0 }} />
        )}
      </div>

      {on('summary') && draft.professionalSummary && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Professional Summary</PreviewHeading>
          <p style={{ margin: 0, color: '#334155', textAlign: 'justify' }}>{draft.professionalSummary}</p>
        </div>
      )}

      {on('skills') && ((draft.technicalSkills || []).length > 0 || (draft.softSkills || []).length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Skills</PreviewHeading>
          {(draft.technicalSkills || []).length > 0 && (
            <div style={{ color: '#334155', marginBottom: 2 }}><strong>Technical:</strong> {draft.technicalSkills.join(', ')}</div>
          )}
          {(draft.softSkills || []).length > 0 && (
            <div style={{ color: '#334155' }}><strong>Soft Skills:</strong> {draft.softSkills.join(', ')}</div>
          )}
        </div>
      )}

      {on('experience') && (draft.experience || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Work Experience</PreviewHeading>
          {draft.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 9 }}>
              <PreviewRow left={`${e.role || ''}${e.company ? ' — ' + e.company : ''}`} right={[e.startDate, e.endDate].filter(Boolean).join(' – ')} />
              {(e.type || e.location) && <div style={{ fontSize: 11.5, color: '#6b7280' }}>{[e.type, e.location].filter(Boolean).join(' • ')}</div>}
              {e.description && <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{e.description}</div>}
              {(e.achievements || []).map((a, i2) => <div key={i2} style={{ fontSize: 12, color: '#334155' }}>• {a}</div>)}
            </div>
          ))}
        </div>
      )}

      {on('internships') && (draft.internships || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Internships</PreviewHeading>
          {draft.internships.map((e, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <PreviewRow left={`${e.role || ''}${e.company ? ' — ' + e.company : ''}`} right={e.duration || ''} />
              {(e.responsibilities || e.description) && <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{e.responsibilities || e.description}</div>}
            </div>
          ))}
        </div>
      )}

      {on('projects') && (draft.projects || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Projects</PreviewHeading>
          {draft.projects.map((pr, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <PreviewRow left={pr.title || 'Project'} right={pr.liveUrl || pr.githubUrl || ''} />
              {(pr.role || pr.techStack) && <div style={{ fontSize: 11.5, fontWeight: 700, color: t.accent }}>{[pr.role, pr.techStack].filter(Boolean).join(' • ')}</div>}
              {pr.description && <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{pr.description}</div>}
            </div>
          ))}
        </div>
      )}

      {on('education') && education.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Education</PreviewHeading>
          {education.map((ed, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <PreviewRow left={[ed.degree, ed.specialization].filter(Boolean).join(' — ') || ed.institution} right={ed.duration || ''} />
              <div style={{ fontSize: 11.8, color: '#4b5563', marginTop: 2 }}>{[ed.institution, ed.cgpaOrPercentage].filter(Boolean).join(' • ')}</div>
            </div>
          ))}
        </div>
      )}

      {on('publications') && (draft.publications || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Publications</PreviewHeading>
          {draft.publications.map((x, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <PreviewRow left={x.title || 'Publication'} right={x.year || ''} />
              {(x.publisher || x.url) && <div style={{ fontSize: 11.5, color: '#4b5563' }}>{[x.publisher, x.url].filter(Boolean).join(' • ')}</div>}
            </div>
          ))}
        </div>
      )}

      {on('research') && (draft.research || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Research</PreviewHeading>
          {draft.research.map((x, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <PreviewRow left={x.title || 'Research Work'} />
              {(x.institution || x.advisor) && <div style={{ fontSize: 11.5, color: '#4b5563' }}>{[x.institution, x.advisor].filter(Boolean).join(' • ')}</div>}
              {x.description && <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{x.description}</div>}
            </div>
          ))}
        </div>
      )}

      {on('certifications') && (draft.certifications || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Certifications</PreviewHeading>
          {draft.certifications.map((c, i) => <div key={i} style={{ fontSize: 12, color: '#334155' }}>• {c}</div>)}
        </div>
      )}

      {on('achievements') && (draft.achievements || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Achievements</PreviewHeading>
          {draft.achievements.map((a, i) => <div key={i} style={{ fontSize: 12, color: '#334155' }}>• {a}</div>)}
        </div>
      )}

      {on('languages') && (draft.languages || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>Languages</PreviewHeading>
          <div style={{ fontSize: 12.5, color: '#334155' }}>{draft.languages.join(', ')}</div>
        </div>
      )}

      {on('custom') && (draft.customSections || []).filter((s) => (s.title || '').trim() || (s.content || '').trim()).map((s, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <PreviewHeading accent={t.accent}>{s.title || 'Additional Information'}</PreviewHeading>
          {s.content && <p style={{ margin: 0, color: '#334155' }}>{s.content}</p>}
        </div>
      ))}
    </div>
  )
}

export default function GraduateResumeBuilderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const prefilledRole = searchParams.get('targetRole') || ''
  const prefilledCompany = searchParams.get('targetCompany') || ''
  const prefilledCategory = searchParams.get('targetCategory') || 'JOB'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [savedResumes, setSavedResumes] = useState([])
  const [activeResumeId, setActiveResumeId] = useState(null)

  const [versionName, setVersionName] = useState('Primary Resume')
  const [targetRole, setTargetRole] = useState(prefilledRole)
  const [targetCompany, setTargetCompany] = useState(prefilledCompany)
  const [targetCategory, setTargetCategory] = useState(prefilledCategory)
  const [template, setTemplate] = useState('ATS CLASSIC')
  const [jobDescription, setJobDescription] = useState('')

  const [personalInfo, setPersonalInfo] = useState(EMPTY_PERSONAL)
  const [summary, setSummary] = useState('')
  const [technicalSkills, setTechnicalSkills] = useState([])
  const [softSkills, setSoftSkills] = useState([])
  const [education, setEducation] = useState([])
  const [experience, setExperience] = useState([])
  const [internships, setInternships] = useState([])
  const [projects, setProjects] = useState([])
  const [certifications, setCertifications] = useState([])
  const [achievements, setAchievements] = useState([])
  const [publications, setPublications] = useState([])
  const [research, setResearch] = useState([])
  const [languages, setLanguages] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY)

  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [readinessScore, setReadinessScore] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { loadInitialData() }, [])

  useEffect(() => {
    let score = 25
    if (personalInfo.fullName && personalInfo.email) score += 15
    if ((personalInfo.degree && personalInfo.institution) || education.length) score += 15
    if (summary.trim().length > 20) score += 15
    if (technicalSkills.length > 0) score += 15
    if (projects.length > 0 || experience.length > 0 || internships.length > 0) score += 15
    setReadinessScore(Math.min(100, score))
  }, [personalInfo, summary, technicalSkills, projects, experience, internships, education])

  const loadInitialData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosInstance.get('/graduate/resume')
      const profile = res.data?.profile || {}
      const suggested = res.data?.resumeData || {}
      const saved = res.data?.savedResumes || []

      if (saved.length > 0) {
        setSavedResumes(saved)
        loadResumeDocIntoState(saved[0])
      } else {
        populateFromProfileData(suggested, profile)
        if (suggested.targetCareer) setTargetRole(suggested.targetCareer)
      }
    } catch (err) {
      console.warn('Fallback to direct graduate profile fetch:', err)
      try {
        const pRes = await axiosInstance.get('/graduate/profile')
        populateFromProfileData({}, pRes.data?.profile || {})
      } catch {
        setError('Could not auto-fill from your profile. You can still enter details manually.')
      }
    } finally {
      setLoading(false)
    }
  }

  const populateFromProfileData = (suggested, profile) => {
    const college = suggested.college || profile.collegeName || profile.college || profile.universityName || profile.institution || ''
    const skills = suggested.highlightSkills || (profile.technicalSkills || []).map((s) => (typeof s === 'string' ? s : s.name)) || profile.skills || []
    const projects = suggested.suggestedProjects || profile.projects || []
    const experienceList = suggested.experience || profile.workExperience || profile.experience || []
    const internshipsList = suggested.internships || profile.internships || []
    const certs = suggested.certifications || profile.certifications || []

    setPersonalInfo({
      fullName: suggested.name || profile.fullName || '',
      email: suggested.email || profile.email || '',
      phone: suggested.phone || profile.phone || '',
      location: suggested.location || profile.location || profile.state || '',
      degree: suggested.degree || profile.degree || '',
      specialization: suggested.specialization || profile.specialization || profile.domain || '',
      institution: college,
      graduationYear: suggested.graduationYear || profile.graduationYear || '',
      cgpa: suggested.cgpa || profile.cgpa || '',
      percentage: suggested.percentage || profile.percentage || '',
      linkedin: suggested.linkedin || profile.linkedinUrl || '',
      github: suggested.github || profile.githubUrl || '',
      portfolio: suggested.portfolio || profile.portfolioUrl || '',
      photoUrl: profile.photoUrl || '',
    })
    setTechnicalSkills(Array.from(new Set((skills || []).filter(Boolean))))
    setSoftSkills((profile.softSkills || suggested.softSkills || []).filter(Boolean))
    setProjects((projects || []).map((p) => ({
      title: p.title || '', description: p.description || '', techStack: p.techStack || '',
      role: p.role || '', githubUrl: p.githubUrl || p.projectUrl || '', liveUrl: p.liveUrl || '',
    })))
    setExperience((experienceList || []).map((e) => ({
      company: e.company || '', role: e.role || e.title || '', location: e.location || '',
      type: e.type || 'Full-time', startDate: e.startDate || e.duration || '', endDate: e.endDate || '',
      description: e.description || '',
    })))
    setInternships((internshipsList || []).map((i) => ({
      company: i.company || '', role: i.role || '', duration: i.duration || '',
      responsibilities: i.responsibilities || i.description || '',
    })))
    setCertifications((certs || []).map(certToString).filter(Boolean))
  }

  const loadResumeDocIntoState = (doc) => {
    setActiveResumeId(doc._id)
    setVersionName(doc.versionName || 'Primary Resume')
    setTargetRole(doc.targetRole || '')
    setTargetCompany(doc.targetCompany || '')
    setTargetCategory(doc.targetCategory || 'JOB')
    setTemplate(doc.template || 'ATS CLASSIC')
    setJobDescription(doc.jobDescription || '')

    setPersonalInfo({ ...EMPTY_PERSONAL, ...(doc.personalInfo || {}) })
    setSummary(doc.professionalSummary || '')
    setTechnicalSkills(Array.isArray(doc.technicalSkills) ? doc.technicalSkills : [])
    setSoftSkills(Array.isArray(doc.softSkills) ? doc.softSkills : [])
    setEducation(Array.isArray(doc.education) ? doc.education : [])
    setExperience(Array.isArray(doc.experience) ? doc.experience : [])
    setInternships(Array.isArray(doc.internships) ? doc.internships : [])
    setProjects(Array.isArray(doc.projects) ? doc.projects : [])
    setCertifications((Array.isArray(doc.certifications) ? doc.certifications : []).map(certToString))
    setAchievements(Array.isArray(doc.achievements) ? doc.achievements : [])
    setPublications(Array.isArray(doc.publications) ? doc.publications : [])
    setResearch(Array.isArray(doc.research) ? doc.research : [])
    setLanguages(Array.isArray(doc.languages) ? doc.languages : [])
    setCustomSections(Array.isArray(doc.customSections) ? doc.customSections : [])
    setVisibility({ ...DEFAULT_VISIBILITY, ...(doc.sectionVisibility || {}) })
  }

  const resumePayload = () => ({
    _id: activeResumeId,
    versionName,
    targetRole,
    targetCompany,
    targetCategory,
    template,
    jobDescription,
    personalInfo,
    professionalSummary: summary,
    education,
    technicalSkills,
    softSkills,
    experience,
    internships,
    projects,
    certifications,
    achievements,
    publications,
    research,
    languages,
    customSections,
    sectionVisibility: visibility,
  })

  const handleSaveResume = async () => {
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await axiosInstance.post('/graduate/resume/save', resumePayload())
      if (res.data?.success && res.data.resume) {
        setActiveResumeId(res.data.resume._id)
        setSuccessMsg(`Resume "${versionName}" saved successfully!`)
        setTimeout(() => setSuccessMsg(''), 4000)
        const vRes = await axiosInstance.get('/graduate/resume/versions')
        if (vRes.data?.resumes) setSavedResumes(vRes.data.resumes)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save resume. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateAiSummary = async () => {
    setGeneratingSummary(true)
    try {
      const res = await axiosInstance.post('/graduate/resume/generate-summary', {
        targetRole,
        resumeDetails: {
          degree: personalInfo.degree,
          specialization: personalInfo.specialization,
          institution: personalInfo.institution,
          technicalSkills,
        },
      })
      if (res.data?.success && res.data.summary) setSummary(res.data.summary)
    } catch (err) {
      console.warn('AI summary error:', err)
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleRunAts = async () => {
    setAnalyzing(true)
    setError('')
    try {
      const res = await axiosInstance.post('/graduate/resume/analyze', {
        resume: resumePayload(),
        jobDescription,
      })
      if (res.data?.success) setAnalysis(res.data.analysis)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not analyze the resume right now.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExportPdf = () => {
    try {
      downloadResumePdf(resumePayload(), template)
    } catch (err) {
      console.error('PDF export error:', err)
      setError('Could not generate the PDF. Please try again.')
    }
  }

  const handlePickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPG or PNG image.')
      return
    }
    try {
      const dataUrl = await resizeImageFile(file)
      setPersonalInfo((prev) => ({ ...prev, photoUrl: dataUrl }))
    } catch {
      setError('Could not read that image. Try another file.')
    }
  }

  const handleCreateNewVersion = () => {
    setActiveResumeId(null)
    setVersionName(`Resume - ${targetRole || 'New Version'}`)
    setSuccessMsg('Started a new resume draft. Customise the details and click Save.')
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const handleDeleteVersion = async (id) => {
    if (!id) return
    try {
      await axiosInstance.delete(`/graduate/resume/${id}`)
      setSavedResumes((prev) => prev.filter((r) => r._id !== id))
      if (activeResumeId === id) setActiveResumeId(null)
      setSuccessMsg('Resume version deleted.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setError('Failed to delete the resume version.')
    }
  }

  const updateArrayItem = (setter, list, idx, key, value) => {
    setter(list.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', paddingTop: 30 }}>
        <AIGenerating
          label="Building your Graduate Career Resume Environment"
          sub="Auto-populating academic credentials, skills and projects..."
        />
      </div>
    )
  }

  const previewDraft = resumePayload()

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }} className="s-anim-up">
      {/* HEADER BAR */}
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            <FiZap size={14} /> Auto-filled from your profile
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>Graduate Resume Builder</h1>
          <p style={{ fontSize: 14, color: 'var(--s-text3)', margin: '4px 0 0', maxWidth: 640 }}>
            Build an ATS-friendly, company-ready resume. Add a photo, tailor it to a job description, check your score and export a real PDF.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SBtn variant="secondary" onClick={() => navigate('/student/graduate/ats-checker')} style={{ borderRadius: 12 }}>
            <FiShield size={15} /> ATS Checker
          </SBtn>
          <SBtn variant="secondary" onClick={handleCreateNewVersion} style={{ borderRadius: 12 }}>
            <FiPlus size={15} /> New Version
          </SBtn>
          <SBtn variant="secondary" onClick={handleSaveResume} disabled={saving} style={{ borderRadius: 12 }}>
            <FiSave size={15} /> {saving ? 'Saving...' : 'Save'}
          </SBtn>
          <SBtn variant="primary" onClick={handleExportPdf} style={{ borderRadius: 12 }}>
            <FiDownload size={15} /> Export PDF
          </SBtn>
        </div>
      </div>

      {successMsg && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiCheckCircle size={18} /> {successMsg}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13.5, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {/* VERSIONS & TARGET BANNER */}
      <SCard style={{ padding: 20, borderRadius: 20, marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <SInput label="Resume Version Name" value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. Software Engineer Resume" />
          <SInput label="Target Job Role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Full Stack Developer" />
          <SInput label="Target Company (optional)" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} placeholder="e.g. TCS / Accenture" />
          <SSelect label="Career Category" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </SSelect>
        </div>

        {savedResumes.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)' }}>Saved Resumes:</span>
            {savedResumes.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => loadResumeDocIntoState(r)}
                style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid',
                  cursor: 'pointer',
                  background: activeResumeId === r._id ? '#eff6ff' : '#f8fafc',
                  color: activeResumeId === r._id ? '#1e40af' : '#475569',
                  borderColor: activeResumeId === r._id ? '#93c5fd' : '#cbd5e1',
                }}
              >
                {r.versionName} {r.targetRole ? `(${r.targetRole})` : ''}
              </button>
            ))}
            {activeResumeId && (
              <button
                type="button"
                onClick={() => handleDeleteVersion(activeResumeId)}
                style={{ marginLeft: 'auto', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <FiTrash2 size={12} /> Delete current
              </button>
            )}
          </div>
        )}
      </SCard>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>

        {/* LEFT: EDITOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* PERSONAL */}
          <SectionCard title="Personal & Contact Information" icon={<FiUser color="#2563eb" />}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, background: '#f8fafc', borderRadius: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 84, height: 104, borderRadius: 10, background: '#fff', border: '1.5px dashed var(--s-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {personalInfo.photoUrl
                  ? <img src={personalInfo.photoUrl} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <FiCamera size={22} color="#94a3b8" />}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--s-text)' }}>Profile Photo <span style={{ fontWeight: 500, color: 'var(--s-text3)', fontSize: 12 }}>(optional)</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--s-text3)', margin: '2px 0 10px' }}>JPG or PNG. Auto-resized — great for Indian & international applications.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex' }}>
                    <input type="file" accept="image/png,image/jpeg" onChange={handlePickPhoto} style={{ display: 'none' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--s-surface)', border: '1.5px solid var(--s-border)', color: 'var(--s-primary)', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      <FiCamera size={13} /> {personalInfo.photoUrl ? 'Change' : 'Upload'}
                    </span>
                  </label>
                  {personalInfo.photoUrl && (
                    <button type="button" onClick={() => setPersonalInfo((p) => ({ ...p, photoUrl: '' }))} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <FiX size={13} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={row2}>
              <SInput label="Full Name" value={personalInfo.fullName} onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })} />
              <SInput label="Email Address" value={personalInfo.email} onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })} />
              <SInput label="Phone Number" value={personalInfo.phone} onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} />
              <SInput label="Location" value={personalInfo.location} onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })} />
              <SInput label="Degree" value={personalInfo.degree} onChange={(e) => setPersonalInfo({ ...personalInfo, degree: e.target.value })} />
              <SInput label="Specialization" value={personalInfo.specialization} onChange={(e) => setPersonalInfo({ ...personalInfo, specialization: e.target.value })} />
              <SInput label="College / University" value={personalInfo.institution} onChange={(e) => setPersonalInfo({ ...personalInfo, institution: e.target.value })} />
              <SInput label="Graduation Year" value={personalInfo.graduationYear} onChange={(e) => setPersonalInfo({ ...personalInfo, graduationYear: e.target.value })} />
              <SInput label="CGPA" value={personalInfo.cgpa} onChange={(e) => setPersonalInfo({ ...personalInfo, cgpa: e.target.value })} />
              <SInput label="Percentage" value={personalInfo.percentage} onChange={(e) => setPersonalInfo({ ...personalInfo, percentage: e.target.value })} />
              <SInput label="LinkedIn URL" value={personalInfo.linkedin} onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })} icon={<FiLinkedin />} />
              <SInput label="GitHub URL" value={personalInfo.github} onChange={(e) => setPersonalInfo({ ...personalInfo, github: e.target.value })} icon={<FiGithub />} />
              <SInput label="Portfolio URL" value={personalInfo.portfolio} onChange={(e) => setPersonalInfo({ ...personalInfo, portfolio: e.target.value })} icon={<FiGlobe />} />
            </div>
          </SectionCard>

          {/* JOB DESCRIPTION + ATS */}
          <SectionCard title="Job Description & ATS Check" icon={<FiTarget color="#2563eb" />}>
            <STextarea
              label="Paste the job description (optional)"
              rows={4}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the target job posting here to get an ATS keyword match and tailored suggestions..."
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <SBtn variant="primary" onClick={handleRunAts} disabled={analyzing} style={{ borderRadius: 10 }}>
                <FiShield size={14} /> {analyzing ? 'Analyzing...' : 'Analyze ATS Score'}
              </SBtn>
              <SBtn variant="secondary" onClick={handleExportPdf} style={{ borderRadius: 10 }}>
                <FiDownload size={14} /> Export PDF
              </SBtn>
            </div>

            {analysis && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: analysis.verdict?.bg || '#f8fafc', border: `1px solid ${analysis.verdict?.border || '#e2e8f0'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: analysis.verdict?.color || '#2563eb', lineHeight: 1 }}>
                    {analysis.overallAtsScore}<span style={{ fontSize: 14 }}>/100</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: analysis.verdict?.color || '#334155' }}>{analysis.verdict?.level}</div>
                    <div style={{ fontSize: 12, color: '#475569', maxWidth: 420 }}>{analysis.verdict?.summary}</div>
                  </div>
                </div>

                {analysis.categoryScores?.technicalSkills && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>Technical keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(analysis.categoryScores.technicalSkills.matched || []).map((m) => (
                        <SBadge key={`m-${m.skill}`} color="green">{m.skill}</SBadge>
                      ))}
                      {(analysis.categoryScores.technicalSkills.missing || []).slice(0, 10).map((m) => (
                        <SBadge key={`x-${m}`} color="orange">Missing: {m}</SBadge>
                      ))}
                    </div>
                  </div>
                )}

                {(analysis.recommendations || []).length > 0 && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: '#334155', fontSize: 12.5, lineHeight: 1.7 }}>
                    {analysis.recommendations.slice(0, 4).map((r, i) => (
                      <li key={i}><strong>{r.title}:</strong> {r.desc}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </SectionCard>

          {/* SUMMARY */}
          <SectionCard title="Professional Summary" icon={<FiFileText color="#2563eb" />}>
            <STextarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="2–3 sentences on your degree, strongest skills and career focus."
            />
            <div style={{ marginTop: 10 }}>
              <SBtn variant="secondary" onClick={handleGenerateAiSummary} disabled={generatingSummary} style={{ borderRadius: 9, fontSize: 12.5 }}>
                <FiZap size={13} /> {generatingSummary ? 'Synthesizing...' : 'Generate from my profile'}
              </SBtn>
            </div>
          </SectionCard>

          {/* SKILLS */}
          <SectionCard title="Skills" icon={<FiCpu color="#2563eb" />}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--s-text3)', marginBottom: 6, textTransform: 'uppercase' }}>Technical Skills</div>
            <ChipEditor
              items={technicalSkills}
              onAdd={(v) => setTechnicalSkills((p) => [...p, v])}
              onRemove={(v) => setTechnicalSkills((p) => p.filter((s) => s !== v))}
              placeholder="Add skill (e.g. React, Node.js, SQL)..."
              emptyLabel="No technical skills added yet."
              color="#eff6ff"
            />
            <div style={{ height: 14 }} />
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>Soft Skills</div>
            <ChipEditor
              items={softSkills}
              onAdd={(v) => setSoftSkills((prev) => [...prev, v])}
              onRemove={(v) => setSoftSkills((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. Communication, Teamwork, Problem solving"
              emptyLabel="No soft skills added yet."
            />
          </SectionCard>

          {/* EDUCATION */}
          <SectionCard
            title={`Education (${education.length})`}
            icon={<FiBookOpen color="#2563eb" />}
            action={() => setEducation([...education, { degree: '', specialization: '', institution: '', duration: '', cgpaOrPercentage: '' }])}
            actionLabel="Add Education"
          >
            {education.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--s-text3)' }}>
                Add entries for your degree, 12th and 10th. Your main degree is also captured in Personal Info above.
              </div>
            )}
            {education.map((ed, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Degree" value={ed.degree} onChange={(e) => updateArrayItem(setEducation, education, idx, 'degree', e.target.value)} />
                  <SInput label="Specialization" value={ed.specialization} onChange={(e) => updateArrayItem(setEducation, education, idx, 'specialization', e.target.value)} />
                  <SInput label="Institution" value={ed.institution} onChange={(e) => updateArrayItem(setEducation, education, idx, 'institution', e.target.value)} />
                  <SInput label="Duration / Year" value={ed.duration} onChange={(e) => updateArrayItem(setEducation, education, idx, 'duration', e.target.value)} />
                  <SInput label="CGPA / Percentage" value={ed.cgpaOrPercentage} onChange={(e) => updateArrayItem(setEducation, education, idx, 'cgpaOrPercentage', e.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setEducation(education.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* EXPERIENCE */}
          <SectionCard
            title={`Work Experience (${experience.length})`}
            icon={<FiBriefcase color="#2563eb" />}
            action={() => setExperience([...experience, { company: '', role: '', location: '', type: 'Full-time', startDate: '', endDate: '', description: '' }])}
            actionLabel="Add Experience"
          >
            {experience.map((e, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Role / Title" value={e.role} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'role', ev.target.value)} />
                  <SInput label="Company" value={e.company} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'company', ev.target.value)} />
                  <SInput label="Start Date" value={e.startDate} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'startDate', ev.target.value)} />
                  <SInput label="End Date" value={e.endDate} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'endDate', ev.target.value)} />
                  <SInput label="Location" value={e.location} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'location', ev.target.value)} />
                  <SSelect label="Type" value={e.type} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'type', ev.target.value)}
                    options={['Full-time', 'Part-time', 'Internship', 'Freelance', 'Research']} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <STextarea label="Description" rows={2} value={e.description} onChange={(ev) => updateArrayItem(setExperience, experience, idx, 'description', ev.target.value)} placeholder="Responsibilities and measurable outcomes..." />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setExperience(experience.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* INTERNSHIPS */}
          <SectionCard
            title={`Internships (${internships.length})`}
            icon={<FiBriefcase color="#2563eb" />}
            action={() => setInternships([...internships, { company: '', role: '', duration: '', responsibilities: '' }])}
            actionLabel="Add Internship"
          >
            {internships.map((e, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Role" value={e.role} onChange={(ev) => updateArrayItem(setInternships, internships, idx, 'role', ev.target.value)} />
                  <SInput label="Company" value={e.company} onChange={(ev) => updateArrayItem(setInternships, internships, idx, 'company', ev.target.value)} />
                  <SInput label="Duration" value={e.duration} onChange={(ev) => updateArrayItem(setInternships, internships, idx, 'duration', ev.target.value)} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <STextarea label="Responsibilities" rows={2} value={e.responsibilities} onChange={(ev) => updateArrayItem(setInternships, internships, idx, 'responsibilities', ev.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setInternships(internships.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* PROJECTS */}
          <SectionCard
            title={`Projects (${projects.length})`}
            icon={<FiBookOpen color="#2563eb" />}
            action={() => setProjects([...projects, { title: '', description: '', techStack: '', role: '', githubUrl: '', liveUrl: '' }])}
            actionLabel="Add Project"
          >
            {projects.map((pr, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Project Title" value={pr.title} onChange={(e) => updateArrayItem(setProjects, projects, idx, 'title', e.target.value)} />
                  <SInput label="Technologies Used" value={pr.techStack} onChange={(e) => updateArrayItem(setProjects, projects, idx, 'techStack', e.target.value)} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <STextarea label="Short Description" rows={2} value={pr.description} onChange={(e) => updateArrayItem(setProjects, projects, idx, 'description', e.target.value)} />
                </div>
                <div style={{ ...row2, marginTop: 8 }}>
                  <SInput label="GitHub URL" value={pr.githubUrl} onChange={(e) => updateArrayItem(setProjects, projects, idx, 'githubUrl', e.target.value)} />
                  <SInput label="Live URL" value={pr.liveUrl} onChange={(e) => updateArrayItem(setProjects, projects, idx, 'liveUrl', e.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setProjects(projects.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* CERTIFICATIONS */}
          <SectionCard title="Certifications" icon={<FiAward color="#2563eb" />}>
            <ChipEditor
              items={certifications}
              onAdd={(v) => setCertifications((prev) => [...prev, v])}
              onRemove={(v) => setCertifications((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. AWS Cloud Practitioner — Amazon — 2025"
              emptyLabel="No certifications added yet."
            />
          </SectionCard>

          {/* ACHIEVEMENTS */}
          <SectionCard title="Achievements" icon={<FiAward color="#2563eb" />}>
            <ChipEditor
              items={achievements}
              onAdd={(v) => setAchievements((prev) => [...prev, v])}
              onRemove={(v) => setAchievements((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. Winner, National Hackathon 2025"
              emptyLabel="No achievements added yet."
            />
          </SectionCard>

          {/* PUBLICATIONS */}
          <SectionCard
            title={`Publications (${publications.length})`}
            icon={<FiFileText color="#2563eb" />}
            action={() => setPublications([...publications, { title: '', publisher: '', year: '', url: '' }])}
            actionLabel="Add Publication"
          >
            {publications.map((x, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Title" value={x.title} onChange={(e) => updateArrayItem(setPublications, publications, idx, 'title', e.target.value)} />
                  <SInput label="Publisher / Journal" value={x.publisher} onChange={(e) => updateArrayItem(setPublications, publications, idx, 'publisher', e.target.value)} />
                  <SInput label="Year" value={x.year} onChange={(e) => updateArrayItem(setPublications, publications, idx, 'year', e.target.value)} />
                  <SInput label="URL / DOI" value={x.url} onChange={(e) => updateArrayItem(setPublications, publications, idx, 'url', e.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setPublications(publications.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* RESEARCH */}
          <SectionCard
            title={`Research (${research.length})`}
            icon={<FiTrendingUp color="#2563eb" />}
            action={() => setResearch([...research, { title: '', institution: '', advisor: '', description: '' }])}
            actionLabel="Add Research"
          >
            {research.map((x, idx) => (
              <div key={idx} style={subCard}>
                <div style={row2}>
                  <SInput label="Title" value={x.title} onChange={(e) => updateArrayItem(setResearch, research, idx, 'title', e.target.value)} />
                  <SInput label="Institution" value={x.institution} onChange={(e) => updateArrayItem(setResearch, research, idx, 'institution', e.target.value)} />
                  <SInput label="Advisor" value={x.advisor} onChange={(e) => updateArrayItem(setResearch, research, idx, 'advisor', e.target.value)} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <STextarea label="Description" rows={2} value={x.description} onChange={(e) => updateArrayItem(setResearch, research, idx, 'description', e.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setResearch(research.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* LANGUAGES */}
          <SectionCard title="Languages" icon={<FiGlobe color="#2563eb" />}>
            <ChipEditor
              items={languages}
              onAdd={(v) => setLanguages((prev) => [...prev, v])}
              onRemove={(v) => setLanguages((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. English, Tamil, Hindi"
              emptyLabel="No languages added yet."
            />
          </SectionCard>

          {/* CUSTOM SECTIONS */}
          <SectionCard
            title={`Custom Sections (${customSections.length})`}
            icon={<FiLayers color="#2563eb" />}
            action={() => setCustomSections([...customSections, { title: '', content: '' }])}
            actionLabel="Add Section"
          >
            {customSections.map((s, idx) => (
              <div key={idx} style={subCard}>
                <SInput label="Section Title" value={s.title} onChange={(e) => updateArrayItem(setCustomSections, customSections, idx, 'title', e.target.value)} />
                <div style={{ marginTop: 8 }}>
                  <STextarea label="Content" rows={2} value={s.content} onChange={(e) => updateArrayItem(setCustomSections, customSections, idx, 'content', e.target.value)} />
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" onClick={() => setCustomSections(customSections.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* VISIBILITY */}
          <SectionCard title="Sections shown on the resume" icon={<FiEye color="#2563eb" />}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(VISIBILITY_LABELS).map((k) => {
                const active = visibility[k] !== false
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
                    style={{
                      padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--s-primary)' : 'var(--s-border)'}`,
                      background: active ? 'var(--s-primary-l)' : 'var(--s-surface)',
                      color: active ? 'var(--s-primary)' : 'var(--s-text3)',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                     <FiEye size={12} /> {VISIBILITY_LABELS[k]}
                   </button>
                 )
               })}
             </div>
           </SectionCard>
        </div>

        {/* RIGHT: PREVIEW */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'var(--s-surface)', padding: 12, borderRadius: 14, border: '1px solid var(--s-border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FiEye size={14} /> Live Preview • {readinessScore}% complete
            </span>
            <SSelect value={template} onChange={(e) => setTemplate(e.target.value)} style={{ width: 240, padding: '7px 12px', fontSize: 12.5 }}>
              {TEMPLATE_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SSelect>
          </div>

          <SCard style={{ padding: 34, borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <ResumePreview draft={previewDraft} templateId={template} />
          </SCard>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--s-text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiTrendingUp size={13} /> Tip: tailor the summary and skills to each job description, then re-run the ATS check.
          </div>
        </div>
      </div>
    </div>
  )
}
