import { jsPDF } from 'jspdf'

// ── Shared template configuration ───────────────────────────────────────────
// Used by BOTH the live preview and the PDF export so what you see is what
// you get. Every layout is single-column and ATS-safe (real text, standard
// headings, no images-as-text, no tables).
export const TEMPLATES = {
  'ATS CLASSIC': {
    name: 'ATS Classic (Single Column)',
    desc: 'Centered header, standard sections — maximal parser compatibility.',
    accent: '#111827', align: 'center', font: 'helvetica', uppercaseName: true,
  },
  'MODERN ATS': {
    name: 'Modern ATS (Clean Accents)',
    desc: 'Left-aligned clean typography with subtle accent dividers.',
    accent: '#2563eb', align: 'left', font: 'helvetica', uppercaseName: false,
  },
  TECHNICAL: {
    name: 'Technical & Engineering',
    desc: 'Highlights core stack, repositories and capstone projects.',
    accent: '#0f766e', align: 'left', font: 'helvetica', uppercaseName: false,
  },
  ACADEMIC: {
    name: 'Academic & Higher Studies',
    desc: 'Formal serif layout for MS / M.Tech admission committees.',
    accent: '#1e3a8a', align: 'center', font: 'times', uppercaseName: true,
  },
  RESEARCH: {
    name: 'Research & Publications CV',
    desc: 'Formal serif CV emphasising publications and research work.',
    accent: '#7f1d1d', align: 'left', font: 'times', uppercaseName: false,
  },
  'EXPERIENCED PROFESSIONAL': {
    name: 'Experienced Professional',
    desc: 'For graduates with full-time roles or long internships.',
    accent: '#334155', align: 'left', font: 'helvetica', uppercaseName: false,
  },
}

export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t }))
export function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES['ATS CLASSIC']
}

// A4 (mm) geometry + margins
const PW = 210, PH = 297, ML = 15, MR = 15, MTOP = 14, MBOT = 16
const CONTENT = PW - ML - MR

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])
const photoOf = (p) => (p && p.photoUrl) || ''

/**
 * Build a jsPDF document for a resume object.
 * @param {object} resume  resume version payload (personalInfo, sections, ...)
 * @param {string} templateId  one of TEMPLATES keys
 */
export function buildResumePdf(resume, templateId = 'ATS CLASSIC') {
  const t = getTemplate(templateId)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const p = resume.personalInfo || {}
  const vis = resume.sectionVisibility || {}
  const visOn = (k) => vis[k] !== false
  const align = t.align === 'center' ? 'center' : 'left'
  const aligns = () => ({ align })
  let y = MTOP

  const ensure = (needed) => {
    if (y + needed > PH - MBOT) { doc.addPage(); y = MTOP }
  }

  const heading = (title) => {
    ensure(13)
    doc.setFont(t.font, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(t.accent)
    doc.text(String(title).toUpperCase(), ML, y)
    y += 1.6
    doc.setDrawColor(t.accent)
    doc.setLineWidth(0.35)
    doc.line(ML, y, PW - MR, y)
    y += 5
  }

  const para = (text, size = 9.5, color = '#1f2937', gap = 2.5) => {
    const s = String(text || '').trim()
    if (!s) return
    doc.setFont(t.font, 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(s, CONTENT)
    lines.forEach((ln) => { ensure(6); doc.text(ln, ML, y); y += size * 0.42 })
    y += gap
  }

  const bullet = (text, size = 9.5, color = '#1f2937') => {
    const s = String(text || '').trim()
    if (!s) return
    doc.setFont(t.font, 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(s, CONTENT - 4)
    lines.forEach((ln, i) => {
      ensure(6)
      doc.text(i === 0 ? '•' : '', ML, y)
      doc.text(ln, ML + 4, y)
      y += size * 0.42
    })
  }

  const splitLine = (left, right = '') => {
    ensure(7)
    doc.setFont(t.font, 'bold')
    doc.setFontSize(10)
    doc.setTextColor('#111827')
    const maxLeft = right ? CONTENT - 42 : CONTENT
    const leftLines = doc.splitTextToSize(String(left || ''), maxLeft)
    doc.text(leftLines[0] || '', ML, y)
    if (right) {
      doc.setFont(t.font, 'normal')
      doc.setFontSize(9)
      doc.setTextColor('#4b5563')
      doc.text(String(right), PW - MR, y, { align: 'right' })
    }
    y += 4.4
    leftLines.slice(1).forEach((ln) => { doc.text(ln, ML, y); y += 4.4 })
  }

  // ── Header ────────────────────────────────────────────────────────────
  const photo = photoOf(p)
  const hasPhoto = !!photo
  const photoW = 25, photoH = 31
  const headerW = hasPhoto ? CONTENT - photoW - 6 : CONTENT
  const headerCenterX = align === 'center' ? ML + headerW / 2 : ML

  doc.setFont(t.font, 'bold')
  doc.setFontSize(20)
  doc.setTextColor('#111827')
  const nameText = t.uppercaseName ? String(p.fullName || 'Your Name').toUpperCase() : (p.fullName || 'Your Name')
  doc.text(nameText, headerCenterX, y + 6, aligns())

  if (resume.targetRole) {
    y += 9
    doc.setFont(t.font, 'normal')
    doc.setFontSize(11)
    doc.setTextColor(t.accent)
    doc.text(String(resume.targetRole), headerCenterX, y, aligns())
  } 
  y += 5

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio].filter(Boolean)
  if (contacts.length) {
    doc.setFont(t.font, 'normal')
    doc.setFontSize(9)
    doc.setTextColor('#4b5563')
    const wrapped = doc.splitTextToSize(contacts.join('  •  '), headerW)
    wrapped.forEach((ln) => { doc.text(ln, headerCenterX, y, aligns()); y += 4 })
  }

  if (hasPhoto) {
    try {
      const fmt = photo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(photo, fmt, PW - MR - photoW, MTOP, photoW, photoH)
    } catch { /* skip invalid image */ }
  }

  y += 1
  doc.setDrawColor(t.accent)
  doc.setLineWidth(0.6)
  doc.line(ML, y, PW - MR, y)
  y += 6

  // ── Sections ──────────────────────────────────────────────────────────
  if (visOn('summary') && resume.professionalSummary) {
    heading('Professional Summary')
    para(resume.professionalSummary, 9.5, '#1f2937')
  }

  if (visOn('skills') && (arr(resume.technicalSkills).length || arr(resume.softSkills).length)) {
    heading('Skills')
    if (arr(resume.technicalSkills).length) para(`Technical: ${resume.technicalSkills.join(', ')}`, 9.5, '#1f2937', 1.5)
    if (arr(resume.softSkills).length) para(`Soft Skills: ${resume.softSkills.join(', ')}`, 9.5, '#1f2937', 3)
  }

  if (visOn('experience') && arr(resume.experience).length) {
    heading('Work Experience')
    resume.experience.forEach((e) => {
      splitLine(`${e.role || ''}${e.company ? ' — ' + e.company : ''}`, [e.startDate, e.endDate].filter(Boolean).join(' – '))
      const meta = [e.type, e.location].filter(Boolean).join(' • ')
      if (meta) para(meta, 8.7, '#6b7280', 1)
      if (e.description) para(e.description, 9.3, '#1f2937', 1)
      arr(e.achievements).forEach((a) => bullet(a, 9.3))
      y += 2
    })
  }

  if (visOn('internships') && arr(resume.internships).length) {
    heading('Internships')
    resume.internships.forEach((e) => {
      splitLine(`${e.role || ''}${e.company ? ' — ' + e.company : ''}`, e.duration || '')
      if (e.responsibilities || e.description) para(e.responsibilities || e.description, 9.3, '#1f2937', 1)
      arr(e.achievements).forEach((a) => bullet(a, 9.3))
      y += 2
    })
  }

  if (visOn('projects') && arr(resume.projects).length) {
    heading('Projects')
    resume.projects.forEach((pr) => {
      splitLine(pr.title || 'Project', pr.githubUrl || pr.liveUrl || '')
      const meta = [pr.role, pr.techStack].filter(Boolean).join(' • ')
      if (meta) para(meta, 8.7, t.accent, 1)
      if (pr.description) para(pr.description, 9.3, '#1f2937', 1)
      arr(pr.achievements).forEach((a) => bullet(a, 9.3))
      y += 2
    })
  }

  const education = arr(resume.education).length
    ? resume.education
    : (p.degree || p.institution ? [{ degree: p.degree, specialization: p.specialization, institution: p.institution, duration: p.graduationYear, cgpaOrPercentage: p.cgpa }] : [])
  if (visOn('education') && education.length) {
    heading('Education')
    education.forEach((ed) => {
      const title = [ed.degree, ed.specialization].filter(Boolean).join(' — ')
      splitLine(title || ed.institution || 'Education', ed.duration || '')
      const meta = [ed.institution, ed.cgpaOrPercentage].filter(Boolean).join(' • ')
      if (meta) para(meta, 9.3, '#4b5563', 1)
      y += 1.5
    })
  }

  if (visOn('publications') && arr(resume.publications).length) {
    heading('Publications')
    resume.publications.forEach((x) => {
      splitLine(x.title || 'Publication', x.year || '')
      const meta = [x.publisher, x.url].filter(Boolean).join(' • ')
      if (meta) para(meta, 9, '#4b5563', 1)
      y += 1.5
    })
  }

  if (visOn('research') && arr(resume.research).length) {
    heading('Research')
    resume.research.forEach((x) => {
      splitLine(x.title || 'Research Work', '')
      const meta = [x.institution, x.advisor].filter(Boolean).join(' • ')
      if (meta) para(meta, 9, '#4b5563', 1)
      if (x.description) para(x.description, 9.3, '#1f2937', 1)
      y += 2
    })
  }

  if (visOn('certifications') && arr(resume.certifications).length) {
    heading('Certifications')
    resume.certifications.forEach((c) => {
      const label = typeof c === 'string' ? c : [c.name, c.issuer, c.year].filter(Boolean).join(' — ')
      bullet(label, 9.3)
    })
    y += 2
  }

  if (visOn('achievements') && arr(resume.achievements).length) {
    heading('Achievements')
    arr(resume.achievements).forEach((a) => bullet(a, 9.3))
    y += 2
  }

  if (visOn('languages') && arr(resume.languages).length) {
    heading('Languages')
    para(resume.languages.join(', '), 9.5, '#1f2937', 2)
  }

  if (visOn('custom') && arr(resume.customSections).length) {
    resume.customSections.filter((s) => (s.title || '').trim() || (s.content || '').trim()).forEach((s) => {
      heading(s.title || 'Additional Information')
      if (s.content) para(s.content, 9.5, '#1f2937', 2)
    })
  }

  return doc
}

/** Build and download the PDF with a sensible filename. */
export function downloadResumePdf(resume, templateId = 'ATS CLASSIC') {
  const doc = buildResumePdf(resume, templateId)
  const name = (resume?.personalInfo?.fullName || 'Resume').replace(/[^\w-]+/g, '_')
  const role = (resume?.targetRole || '').replace(/[^\w-]+/g, '_')
  doc.save(`${name}${role ? '_' + role : ''}_Resume.pdf`)
}
