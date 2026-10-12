import React, { useState, useEffect, useCallback } from 'react'
import {
  FiFileText, FiDownload, FiSave, FiPlus, FiTrash2, FiCopy, FiEdit2, FiZap, FiBarChart2, FiArrowUp, FiArrowDown
} from 'react-icons/fi'
import { jsPDF } from 'jspdf'
import resumeService from '../../../services/resumeService'

const ROLES = ['Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Data Scientist', 'Java Developer', 'Python Developer', 'UI/UX Designer', 'Other']
const SECTION_ORDER = ['summary', 'skills', 'education', 'projects', 'experience', 'certifications', 'achievements']
const SECTION_LABEL = { summary: 'Professional Summary', skills: 'Technical Skills', education: 'Education', projects: 'Projects', experience: 'Internships / Experience', certifications: 'Certifications', achievements: 'Achievements' }

const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, boxSizing: 'border-box' }
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#334155' }
const btnPrimary = { ...btn, background: '#2563eb', color: '#fff', border: 'none' }

export default function GraduateResumePage() {
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [resume, setResume] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [targetRole, setTargetRole] = useState('Software Engineer')
  const [customRole, setCustomRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [atsResult, setAtsResult] = useState(null)
  const [atsAnalyzedKey, setAtsAnalyzedKey] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const previewRef = React.useRef(null)

  const loadVersions = useCallback(async () => {
    const res = await resumeService.list()
    if (res.success) setVersions(res.data || [])
  }, [])

  useEffect(() => {
    (async () => {
      try {
        await loadVersions()
        const defaults = await resumeService.getDefault()
        if (defaults.success && defaults.resume && versions.length === 0) {
          setResume(defaults.resume)
        }
        if (defaults.warning) setNotice(defaults.warning)
      } catch { setError('Could not load your profile data.') } finally { setLoading(false) }
    })()
  }, [])

  const selectVersion = async (id) => {
    try {
      const res = await resumeService.get(id)
      if (res.success) { setResume(res.data); setActiveId(id); setDirty(false); setTargetRole(res.data.targetRole?.includes('Other') ? 'Other' : res.data.targetRole || ''); if (!ROLES.includes(res.data.targetRole)) setCustomRole(res.data.targetRole || ''); setJobDescription(res.data.jobDescription || '') }
    } catch { setError('Could not open that resume.') }
  }

  const createVersion = async () => {
    const title = newTitle.trim() || `${targetRole === 'Other' ? customRole || 'Custom' : targetRole} Resume`
    try {
      const res = await resumeService.create({ title, targetRole: targetRole === 'Other' ? customRole : targetRole, jobDescription, ...defaultsToEmpty() })
      if (res.success) { setVersions([res.data, ...versions]); setActiveId(res.data._id); setResume(res.data); setDirty(false); setNewTitle(''); setNotice('Resume version created.') }
    } catch { setError('Could not create resume.') }
  }
  const defaultsToEmpty = () => ({ contact: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' }, summary: '', skills: [], education: [], projects: [], experience: [], certifications: [], achievements: [] })

  const createFromProfile = async () => {
    try {
      const defaults = await resumeService.getDefault()
      const base = defaults.resume || defaultsToEmpty()
      const res = await resumeService.create({ title: `${targetRole === 'Other' ? customRole || 'Custom' : targetRole} Resume`, targetRole: targetRole === 'Other' ? customRole : targetRole, jobDescription, ...base })
      if (res.success) { setVersions([res.data, ...versions]); setActiveId(res.data._id); setResume(res.data); setDirty(false); setNotice('New resume created from your profile.') }
    } catch { setError('Could not create resume from profile.') }
  }

  const duplicateVersion = async (v) => {
    const { _id, createdAt, updatedAt, ...rest } = v
    try {
      const res = await resumeService.create({ ...rest, title: `${v.title} (copy)` })
      if (res.success) { setVersions([res.data, ...versions]); setNotice('Duplicated.') }
    } catch { setError('Duplicate failed.') }
  }
  const renameVersion = async (v) => {
    const t = window.prompt('Rename resume:', v.title)
    if (!t) return
    try { const res = await resumeService.update(v._id, { title: t }); if (res.success) setVersions(versions.map((x) => (x._id === v._id ? res.data : x))) } catch { setError('Rename failed.') }
  }
  const deleteVersion = async (v) => {
    if (!window.confirm(`Delete "${v.title}"?`)) return
    try { await resumeService.remove(v._id); setVersions(versions.filter((x) => x._id !== v._id)); if (activeId === v._id) { setActiveId(null); setResume(null) } } catch { setError('Delete failed.') }
  }

  const save = async () => {
    if (!resume) return
    try {
      if (activeId) {
        const res = await resumeService.update(activeId, { ...resume, targetRole: targetRole === 'Other' ? customRole : targetRole, jobDescription })
        if (res.success) { setResume(res.data); setNotice('Saved.'); setDirty(false); loadVersions() }
      } else {
        const res = await resumeService.create({ title: `${targetRole === 'Other' ? customRole || 'Custom' : targetRole} Resume`, targetRole: targetRole === 'Other' ? customRole : targetRole, jobDescription, ...resume })
        if (res.success) { setActiveId(res.data._id); setResume(res.data); setDirty(false); loadVersions(); setNotice('Saved as new version.') }
      }
    } catch { setError('Save failed.') }
  }

  const patch = (fn) => { setResume((r) => fn({ ...r })); setDirty(true) }
  const moveSection = (idx, dir) => {
    const order = (resume?.sectionOrder && resume.sectionOrder.length ? resume.sectionOrder : SECTION_ORDER).slice()
    const j = idx + dir
    if (j < 0 || j >= order.length) return
    ;[order[idx], order[j]] = [order[j], order[idx]]
    patch((r) => ({ ...r, sectionOrder: order }))
  }

  const analyze = async () => {
    try {
      const res = jobDescription.trim()
        ? await resumeService.analyzeAts({ resume, jobDescription })
        : await resumeService.readiness({ resume })
      if (res.success) {
        setAtsResult(res.analysis)
        setAtsAnalyzedKey(JSON.stringify([resume, jobDescription]))
      }
    } catch { setError('ATS analysis failed.') }
  }

  const generate = async () => {
    if (!jobDescription.trim() && !targetRole) return
    try {
      setAiLoading(true)
      const res = await resumeService.generate({ targetRole: targetRole === 'Other' ? customRole : targetRole, jobDescription })
      if (!res.success) return setError(res.message || 'Generation failed.')
      if (!res.aiUsed) return setNotice(res.message || 'AI provider not configured; your data is preserved.')
      if (res.warning) setNotice(res.warning)
      const d = res.data
      if (d) {
        patch((r) => ({
          ...r,
          summary: d.summary || r.summary,
          skills: d.highlightedSkills?.length ? d.highlightedSkills : r.skills,
          projects: (r.projects || []).map((p) => {
            const pb = (d.projectBullets || []).find((x) => x.title === p.title)
            return pb ? { ...p, description: pb.bullets.join('\n') } : p
          }),
          experience: (r.experience || []).map((e) => {
            const eb = (d.experienceBullets || []).find((x) => x.company === e.company && x.role === e.role)
            return eb ? { ...e, description: eb.bullets.join('\n') } : e
          }),
        }))
        setNotice('AI suggestions applied. Review and edit before saving.')
      }
    } catch (e) { setError(e?.response?.data?.message || 'AI generation failed. Your data is preserved.') } finally { setAiLoading(false) }
  }

  const downloadPdf = () => {
    if (!resume) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 48; let y = 56
    const line = (text, size = 10, bold = false, color = [30, 41, 59]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
      const lines = doc.splitTextToSize(String(text || ''), 595 - margin * 2)
      lines.forEach((l) => { if (y > 800) { doc.addPage(); y = 56 } doc.text(l, margin, y); y += size + 3 })
    }
    const title = (t) => { y += 10; if (y > 800) { doc.addPage(); y = 56 } line(t.toUpperCase(), 11, true, [37, 99, 235]); y += 4 }
    line(resume.contact?.name || '', 18, true); y += 2
    line([resume.contact?.email, resume.contact?.phone, resume.contact?.location].filter(Boolean).join('  |  '), 9, false, [71, 85, 105])
    line([resume.contact?.linkedin, resume.contact?.github, resume.contact?.portfolio].filter(Boolean).join('  |  '), 9, false, [37, 99, 235])
    if (targetRole) line(targetRole === 'Other' ? customRole : targetRole, 11, true, [5, 150, 105])
    const order = resume.sectionOrder?.length ? resume.sectionOrder : SECTION_ORDER
    order.forEach((sec) => {
      if (sec === 'summary' && resume.summary) { title('Professional Summary'); line(resume.summary) }
      if (sec === 'skills' && (resume.skills || []).length) { title('Technical Skills'); line(resume.skills.join(', ')) }
      if (sec === 'education' && (resume.education || []).length) {
        title('Education')
        resume.education.forEach((e) => line(`${e.degree || ''} — ${e.institution || ''} (${e.year || ''}) ${e.score || ''}`, 10, false))
      }
      if (sec === 'projects' && (resume.projects || []).length) {
        title('Projects')
        resume.projects.forEach((p) => { line(`${p.title} ${p.techStack ? `(${p.techStack})` : ''}`, 10, true); String(p.description || '').split('\n').forEach((b) => line(`• ${b}`)) })
      }
      if (sec === 'experience' && (resume.experience || []).length) {
        title('Internships / Experience')
        resume.experience.forEach((e) => { line(`${e.role || ''} — ${e.company || ''} (${e.duration || ''})`, 10, true); String(e.description || '').split('\n').forEach((b) => line(`• ${b}`)) })
      }
      if (sec === 'certifications' && (resume.certifications || []).length) {
        title('Certifications'); resume.certifications.forEach((c) => line(`${c.name} — ${c.issuer} ${c.year || ''}`))
      }
      if (sec === 'achievements' && (resume.achievements || []).length) {
        title('Achievements'); resume.achievements.forEach((a) => line(`• ${a}`))
      }
    })
    doc.save(`${(resume.contact?.name || 'resume').replace(/\s+/g, '_')}_Resume.pdf`)
    setNotice('PDF downloaded.')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading resume builder…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 20, paddingBottom: 60 }}>
      {/* Left: controls & versions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Target role</h3>
          <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} style={input}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          {targetRole === 'Other' && <input style={{ ...input, marginTop: 8 }} placeholder="Custom job title" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />}
          <textarea style={{ ...input, marginTop: 8, minHeight: 90 }} placeholder="Paste job description (optional, enables ATS analysis)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={btnPrimary} onClick={generate} disabled={aiLoading}><FiZap size={13} /> {aiLoading ? 'Generating…' : 'Generate Resume'}</button>
            <button style={btn} onClick={analyze}><FiBarChart2 size={13} /> Analyze ATS Match</button>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Resume versions</h3>
          <button style={{ ...btnPrimary, marginBottom: 10 }} onClick={createFromProfile}><FiPlus size={13} /> New from profile</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {versions.map((v) => (
              <div key={v._id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: activeId === v._id ? '#eff6ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                <button onClick={() => selectVersion(v._id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#1e293b' }}>{v.title}</button>
                <button onClick={() => renameVersion(v)} title="Rename" style={iconBtn}><FiEdit2 size={12} /></button>
                <button onClick={() => duplicateVersion(v)} title="Duplicate" style={iconBtn}><FiCopy size={12} /></button>
                <button onClick={() => deleteVersion(v)} title="Delete" style={iconBtn}><FiTrash2 size={12} /></button>
              </div>
            ))}
            {versions.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No saved versions yet.</div>}
          </div>
        </div>

        {atsResult && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, fontSize: 12.5 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>
              {atsResult.mode === 'resume_readiness' ? 'Resume Readiness' : 'ATS Job Match'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: `conic-gradient(#2563eb ${(atsResult.keywordMatchPercent ?? atsResult.readinessScore ?? 0) * 3.6}deg, #e2e8f0 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Score">
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#2563eb' }}>
                  {atsResult.keywordMatchPercent ?? atsResult.readinessScore ?? 0}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {atsResult.mode === 'job_description_match' && (
                  <>
                    <b>Matched keywords:</b> {(atsResult.matchedKeywords || []).slice(0, 12).join(', ') || '—'}<br />
                    <b>Missing keywords:</b> {(atsResult.missingKeywords || []).slice(0, 12).join(', ') || '—'}
                  </>
                )}
                {atsResult.mode === 'resume_readiness' && (
                  <><b>Missing sections:</b> {(atsResult.missingSections || []).join(', ') || 'None'}</>
                )}
              </div>
            </div>
            {atsResult.breakdown && (
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}>
                Breakdown: {Object.entries(atsResult.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')}
              </div>
            )}
            {atsResult.skillsToHighlight?.length > 0 && <div><b>Highlight:</b> {atsResult.skillsToHighlight.join(', ')}</div>}
            {(atsResult.suggestions || atsResult.formattingChecks || []).map((s, i) => <div key={i}>• {s}</div>)}
            <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 11.5 }}>{atsResult.note}</div>
            {atsAnalyzedKey && atsAnalyzedKey !== JSON.stringify([resume, jobDescription]) && (
              <div style={{ marginTop: 6, color: '#b45309', fontWeight: 700 }}>Resume/job description changed — re-run Analyze ATS Match for an updated score.</div>
            )}
          </div>
        )}

        {notice && <div style={{ background: '#ecfdf5', color: '#047857', borderRadius: 10, padding: 10, fontSize: 12.5 }}>{notice}</div>}
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 10, fontSize: 12.5 }}>{error}</div>}
      </div>

      {/* Right: editor + preview */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Resume Builder</h2>
          <span style={{ color: '#64748b', fontSize: 12.5 }}>Create job-specific, ATS-friendly resumes from your real profile.</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: dirty ? '#b45309' : '#047857' }}>
            {dirty ? 'Unsaved changes' : (activeId ? 'All changes saved' : 'Not saved yet')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button style={btnPrimary} onClick={save} disabled={!resume}><FiSave size={13} /> Save Resume</button>
          <button style={btn} onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth' })} disabled={!resume}><FiFileText size={13} /> Preview Resume</button>
          <button style={btn} onClick={downloadPdf} disabled={!resume}><FiDownload size={13} /> Download PDF</button>
        </div>

        {!resume ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Create a version from your profile to start, or select one on the left.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Editor */}
            <div style={{ fontSize: 12.5 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>Edit</h3>
              <input style={{ ...input, marginBottom: 6 }} placeholder="Name" value={resume.contact?.name || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, name: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="Email" value={resume.contact?.email || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, email: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="Phone" value={resume.contact?.phone || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, phone: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="Location" value={resume.contact?.location || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, location: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="LinkedIn" value={resume.contact?.linkedin || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, linkedin: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="GitHub" value={resume.contact?.github || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, github: e.target.value } }))} />
              <input style={{ ...input, marginBottom: 6 }} placeholder="Portfolio" value={resume.contact?.portfolio || ''} onChange={(e) => patch((r) => ({ ...r, contact: { ...r.contact, portfolio: e.target.value } }))} />
              <textarea style={{ ...input, minHeight: 70, marginBottom: 6 }} placeholder="Professional summary" value={resume.summary || ''} onChange={(e) => patch((r) => ({ ...r, summary: e.target.value }))} />
              <textarea style={{ ...input, minHeight: 50, marginBottom: 6 }} placeholder="Skills, comma separated" value={(resume.skills || []).join(', ')} onChange={(e) => patch((r) => ({ ...r, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
              <textarea style={{ ...input, minHeight: 60, marginBottom: 6 }} placeholder="Education (one per line: degree — institution (year))" value={(resume.education || []).map((e) => `${e.degree} — ${e.institution} (${e.year})`).join('\n')} onChange={(e) => patch((r) => ({ ...r, education: e.target.value.split('\n').map((l) => { const m = l.split('—'); return { degree: (m[0] || '').trim(), institution: (m[1] || '').replace(/\(.*\)/, '').trim(), year: (l.match(/\((.*?)\)/) || [])[1] || '' } }) }))} />
              <textarea style={{ ...input, minHeight: 80, marginBottom: 6 }} placeholder="Achievements (one per line)" value={(resume.achievements || []).join('\n')} onChange={(e) => patch((r) => ({ ...r, achievements: e.target.value.split('\n').filter(Boolean) }))} />
              <div style={{ margin: '10px 0 4px', fontWeight: 800 }}>Projects & experience (edit in preview-friendly format)</div>
              {(resume.projects || []).map((p, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                  <input style={{ ...input, marginBottom: 4 }} placeholder="Title" value={p.title} onChange={(e) => patch((r) => ({ ...r, projects: r.projects.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} />
                  <input style={{ ...input, marginBottom: 4 }} placeholder="Tech stack" value={p.techStack} onChange={(e) => patch((r) => ({ ...r, projects: r.projects.map((x, j) => j === i ? { ...x, techStack: e.target.value } : x) }))} />
                  <textarea style={{ ...input, minHeight: 50 }} placeholder="Bullet points (one per line)" value={p.description} onChange={(e) => patch((r) => ({ ...r, projects: r.projects.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} />
                  <button style={{ ...btn, marginTop: 4, color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => patch((r) => ({ ...r, projects: r.projects.filter((_, j) => j !== i) }))}><FiTrash2 size={12} /> Remove</button>
                </div>
              ))}
              <button style={btn} onClick={() => patch((r) => ({ ...r, projects: [...r.projects, { title: '', description: '', techStack: '', url: '' }] }))}><FiPlus size={12} /> Add project</button>
              {(resume.experience || []).map((e, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                  <input style={{ ...input, marginBottom: 4 }} placeholder="Role" value={e.role} onChange={(ev) => patch((r) => ({ ...r, experience: r.experience.map((x, j) => j === i ? { ...x, role: ev.target.value } : x) }))} />
                  <input style={{ ...input, marginBottom: 4 }} placeholder="Company" value={e.company} onChange={(ev) => patch((r) => ({ ...r, experience: r.experience.map((x, j) => j === i ? { ...x, company: ev.target.value } : x) }))} />
                  <textarea style={{ ...input, minHeight: 50 }} placeholder="Bullet points (one per line)" value={e.description} onChange={(ev) => patch((r) => ({ ...r, experience: r.experience.map((x, j) => j === i ? { ...x, description: ev.target.value } : x) }))} />
                  <button style={{ ...btn, marginTop: 4, color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => patch((r) => ({ ...r, experience: r.experience.filter((_, j) => j !== i) }))}><FiTrash2 size={12} /> Remove</button>
                </div>
              ))}
              <button style={btn} onClick={() => patch((r) => ({ ...r, experience: [...r.experience, { company: '', role: '', duration: '', description: '' }] }))}><FiPlus size={12} /> Add experience</button>
              <div style={{ margin: '10px 0 4px', fontWeight: 800 }}>Section order</div>
              {(resume.sectionOrder?.length ? resume.sectionOrder : SECTION_ORDER).map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ flex: 1 }}>{SECTION_LABEL[s]}</span>
                  <button style={iconBtn} onClick={() => moveSection(i, -1)}><FiArrowUp size={12} /></button>
                  <button style={iconBtn} onClick={() => moveSection(i, 1)}><FiArrowDown size={12} /></button>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div ref={previewRef} style={{ background: '#f8fafc', borderRadius: 12, padding: 20, fontSize: 12.5, color: '#0f172a', lineHeight: 1.5 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{resume.contact?.name || 'Your Name'}</h2>
              <div style={{ color: '#64748b', fontSize: 11.5 }}>{[resume.contact?.email, resume.contact?.phone, resume.contact?.location].filter(Boolean).join(' | ')}</div>
              <div style={{ color: '#2563eb', fontSize: 11.5 }}>{[resume.contact?.linkedin, resume.contact?.github, resume.contact?.portfolio].filter(Boolean).join(' | ')}</div>
              {(resume.sectionOrder?.length ? resume.sectionOrder : SECTION_ORDER).map((sec) => {
                if (sec === 'summary' && resume.summary) return <Sec key={sec} h="Professional Summary"><p>{resume.summary}</p></Sec>
                if (sec === 'skills' && resume.skills?.length) return <Sec key={sec} h="Technical Skills"><p>{resume.skills.join(', ')}</p></Sec>
                if (sec === 'education' && resume.education?.length) return <Sec key={sec} h="Education">{resume.education.map((e, i) => <p key={i}>{e.degree} — {e.institution} ({e.year})</p>)}</Sec>
                if (sec === 'projects' && resume.projects?.length) return <Sec key={sec} h="Projects">{resume.projects.map((p, i) => <div key={i}><b>{p.title}</b> {p.techStack && `(${p.techStack})`}{String(p.description || '').split('\n').map((b, j) => <div key={j}>• {b}</div>)}</div>)}</Sec>
                if (sec === 'experience' && resume.experience?.length) return <Sec key={sec} h="Experience">{resume.experience.map((e, i) => <div key={i}><b>{e.role}</b> — {e.company} {e.duration && `(${e.duration})`}{String(e.description || '').split('\n').map((b, j) => <div key={j}>• {b}</div>)}</div>)}</Sec>
                if (sec === 'certifications' && resume.certifications?.length) return <Sec key={sec} h="Certifications">{resume.certifications.map((c, i) => <p key={i}>{c.name} — {c.issuer}</p>)}</Sec>
                if (sec === 'achievements' && resume.achievements?.length) return <Sec key={sec} h="Achievements">{resume.achievements.map((a, i) => <div key={i}>• {a}</div>)}</Sec>
                return null
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }
function Sec({ h, children }) {
  return <div style={{ marginTop: 12 }}><div style={{ fontWeight: 800, color: '#2563eb', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>{children}</div>
}
