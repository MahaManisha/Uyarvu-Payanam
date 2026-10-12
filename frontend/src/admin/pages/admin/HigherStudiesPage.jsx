import React, { useState, useEffect, useCallback } from 'react'
import { SBtn, SInput, SSelect, SAlert, SCard, SBadge } from '../../components/ui'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheck, FiX, FiArrowUp, FiArrowDown } from 'react-icons/fi'
import axiosInstance from '../../../config/axios'

const CATEGORIES = [
  'Engineering & Technology', 'Medical Exams', 'Management & MBA Exams',
  'Science Exams', 'Central University & Academic Exams', 'Pharmacy Exams', 'Law Exams'
]
const STATUSES = ['Draft', 'Published', 'Archived']
const STUDY_MODES = ['Online', 'Offline', 'Hybrid']

const emptyExam = { examName: '', examDefinition: '', eligibility: '', examPattern: '', syllabus: '', officialExamUrl: '', examInfo: '' }
const emptySpec = { name: '', description: '', skills: [] }
const emptyRole = { role: '', skillsRequired: '' }

const emptyForm = {
  courseName: '', courseCategory: 'Postgraduate Degrees', definition: '', detailedContent: '',
  duration: '', targetAcademicBackground: '', thumbnail: '',
  eligibleDegree: '', eligibleStreams: [], minimumMarks: '', requiredSubjects: '',
  workExperience: '', additionalConditions: '', eligibilityNotes: '',
  exams: [], specialisations: [],
  careerPath: { overview: '', jobRoles: [], furtherStudy: '' },
  bestSuitedFor: { overview: '', recommendedBackground: '', careerGoals: '', interests: '', whoShouldConsider: '', considerations: '' },
  studyMode: 'Offline', fees: '', recognition: '', additionalNotes: '',
  officialCourseUrl: '', sourceUrl: '', status: 'Draft',
}

export default function HigherStudiesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await axiosInstance.get(`/higher-studies/admin/list?${params}`)
      if (res.data?.success) {
        setCourses(res.data.courses || [])
        setTotalPages(res.data.pagination?.pages || 1)
      } else { setError(res.data?.message || 'Failed to load courses.') }
    } catch { setError('Could not connect to the server.') }
    finally { setLoading(false) }
  }, [page, search, statusFilter, categoryFilter])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError('') }
  const openEdit = async (id) => {
    try {
      const res = await axiosInstance.get(`/higher-studies/admin/${id}`)
      if (res.data?.success) {
        const c = res.data.course
        setForm({ ...emptyForm, ...c, eligibleStreams: c.eligibleStreams || [], exams: c.exams || [], specialisations: c.specialisations || [], careerPath: { overview: '', jobRoles: [], furtherStudy: '', ...c.careerPath }, bestSuitedFor: { overview: '', recommendedBackground: '', careerGoals: '', interests: '', whoShouldConsider: '', considerations: '', ...c.bestSuitedFor } })
        setEditingId(id); setShowForm(true); setError('')
      }
    } catch { setError('Failed to load course for editing.') }
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setCP = (field) => (e) => setForm(f => ({ ...f, careerPath: { ...f.careerPath, [field]: e.target.value } }))
  const setBS = (field) => (e) => setForm(f => ({ ...f, bestSuitedFor: { ...f.bestSuitedFor, [field]: e.target.value } }))

  // Exam helpers
  const addExam = () => setForm(f => ({ ...f, exams: [...f.exams, { ...emptyExam }] }))
  const updateExam = (i, field, val) => setForm(f => ({ ...f, exams: f.exams.map((e, idx) => idx === i ? { ...e, [field]: val } : e) }))
  const removeExam = (i) => setForm(f => ({ ...f, exams: f.exams.filter((_, idx) => idx !== i) }))

  // Specialisation helpers
  const addSpec = () => setForm(f => ({ ...f, specialisations: [...f.specialisations, { ...emptySpec, skills: [] }] }))
  const updateSpec = (i, field, val) => setForm(f => ({ ...f, specialisations: f.specialisations.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }))
  const updateSpecSkills = (i, val) => setForm(f => ({ ...f, specialisations: f.specialisations.map((s, idx) => idx === i ? { ...s, skills: val.split(',').map(x => x.trim()).filter(Boolean) } : s) }))
  const removeSpec = (i) => setForm(f => ({ ...f, specialisations: f.specialisations.filter((_, idx) => idx !== i) }))

  // Job role helpers
  const addRole = () => setForm(f => ({ ...f, careerPath: { ...f.careerPath, jobRoles: [...(f.careerPath?.jobRoles || []), { ...emptyRole }] } }))
  const updateRole = (i, field, val) => setForm(f => ({ ...f, careerPath: { ...f.careerPath, jobRoles: f.careerPath.jobRoles.map((r, idx) => idx === i ? { ...r, [field]: val } : r) } }))
  const removeRole = (i) => setForm(f => ({ ...f, careerPath: { ...f.careerPath, jobRoles: f.careerPath.jobRoles.filter((_, idx) => idx !== i) } }))

  const handleSave = async () => {
    if (!form.courseName.trim()) { setError('Course name is required.'); return }
    setSaving(true); setError('')
    try {
      if (editingId) {
        await axiosInstance.put(`/higher-studies/admin/${editingId}`, form)
        setSuccess('Course updated successfully.')
      } else {
        await axiosInstance.post('/higher-studies/admin', form)
        setSuccess('Course created successfully.')
      }
      setShowForm(false); setEditingId(null); fetchCourses()
    } catch (err) { setError(err.response?.data?.message || 'Failed to save course.') }
    finally { setSaving(false) }
  }

  const handleStatusChange = async (id, status) => {
    try { await axiosInstance.patch(`/higher-studies/admin/${id}/status`, { status }); setSuccess(`Course ${status.toLowerCase()} successfully.`); fetchCourses() }
    catch (err) { setError(err.response?.data?.message || 'Failed to update status.') }
  }

  const handleDelete = async (id) => {
    try { await axiosInstance.delete(`/higher-studies/admin/${id}`); setSuccess('Course deleted successfully.'); setDeleteConfirm(null); fetchCourses() }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete course.'); setDeleteConfirm(null) }
  }

  const setStatusBadge = (s) => s === 'Published' ? 'green' : s === 'Draft' ? 'orange' : 'gray'

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--s-text3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>{children}</div>
  )

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--s-text)' }}>Higher Studies Management</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--s-text3)' }}>Add, edit, publish and archive postgraduate courses.</p>
        </div>
        <SBtn variant="primary" onClick={openCreate}><FiPlus size={14} style={{ marginRight: 6 }} />Add Course</SBtn>
      </div>

      {error && <SAlert type="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</SAlert>}
      {success && <SAlert type="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</SAlert>}

      <SCard style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} size={14} />
          <input placeholder="Search courses..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </SCard>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--s-text3)' }}>Loading courses...</div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--s-text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 700 }}>No courses found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Click "Add Course" to create your first higher studies opportunity.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(course => (
            <SCard key={course._id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--s-text)' }}>{course.courseName}</div>
                <div style={{ fontSize: 12, color: 'var(--s-text3)', marginTop: 2 }}>{course.courseCategory}{course.targetAcademicBackground ? ` · ${course.targetAcademicBackground}` : ''}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <SBadge color={setStatusBadge(course.status)}>{course.status}</SBadge>
                  {course.duration && <span style={{ fontSize: 11, color: 'var(--s-text3)' }}>{course.duration}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {course.status !== 'Published' && <SBtn variant="primary" size="sm" onClick={() => handleStatusChange(course._id, 'Published')}><FiCheck size={12} style={{ marginRight: 4 }} />Publish</SBtn>}
                {course.status === 'Published' && <SBtn variant="secondary" size="sm" onClick={() => handleStatusChange(course._id, 'Draft')}><FiX size={12} style={{ marginRight: 4 }} />Unpublish</SBtn>}
                {course.status !== 'Archived' && <SBtn variant="secondary" size="sm" onClick={() => handleStatusChange(course._id, 'Archived')}>Archive</SBtn>}
                <button onClick={() => openEdit(course._id)} style={{ background: '#eff6ff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#1d4ed8' }} title="Edit"><FiEdit2 size={14} /></button>
                <button onClick={() => setDeleteConfirm(course._id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }} title="Delete"><FiTrash2 size={14} /></button>
              </div>
            </SCard>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--s-border)', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--s-text3)' }}>Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--s-border)', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Delete Course?</h3>
            <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '0 0 20px' }}>This action cannot be undone. The course will be permanently removed.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <SBtn variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</SBtn>
              <SBtn variant="danger" onClick={() => handleDelete(deleteConfirm)}><FiTrash2 size={13} style={{ marginRight: 4 }} />Delete</SBtn>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflow: 'auto', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 750, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>{editingId ? 'Edit Course' : 'Add New Course'}</h3>

            <SectionLabel>Basic Course Information</SectionLabel>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Course Name *</label>
                <SInput value={form.courseName} onChange={set('courseName')} placeholder="e.g. Master of Business Administration (MBA)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Course Category</label>
                  <SSelect value={form.courseCategory} onChange={set('courseCategory')}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </SSelect>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Duration</label>
                  <SInput value={form.duration} onChange={set('duration')} placeholder="e.g. 2 years" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Target Academic Background</label>
                  <SInput value={form.targetAcademicBackground} onChange={set('targetAcademicBackground')} placeholder="e.g. Any bachelor's degree" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Study Mode</label>
                  <SSelect value={form.studyMode} onChange={set('studyMode')}>
                    {STUDY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </SSelect>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Definition / Short Description</label>
                <textarea value={form.definition} onChange={set('definition')} placeholder="Brief course definition..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 60, fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Detailed Course Content</label>
                <textarea value={form.detailedContent} onChange={set('detailedContent')} placeholder="Full course description..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 100, fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Official Course URL</label>
                  <SInput value={form.officialCourseUrl} onChange={set('officialCourseUrl')} placeholder="https://..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Source Article URL</label>
                  <SInput value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="https://..." />
                </div>
              </div>
            </div>

            <SectionLabel>Eligibility</SectionLabel>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Eligible Degree</label>
                  <SInput value={form.eligibleDegree} onChange={set('eligibleDegree')} placeholder="e.g. Any bachelor's degree" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Minimum Marks / Percentage</label>
                  <SInput value={form.minimumMarks} onChange={set('minimumMarks')} placeholder="e.g. 50% or equivalent CGPA" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Eligible Academic Streams</label>
                <SInput value={(form.eligibleStreams || []).join(', ')} onChange={e => setForm(f => ({ ...f, eligibleStreams: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="e.g. Science, Commerce, Arts" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Required Subjects / Prerequisites</label>
                  <SInput value={form.requiredSubjects} onChange={set('requiredSubjects')} placeholder="e.g. Mathematics, English" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Work Experience Requirement</label>
                  <SInput value={form.workExperience} onChange={set('workExperience')} placeholder="e.g. 2 years preferred, or None" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Additional Eligibility Conditions</label>
                <textarea value={form.additionalConditions} onChange={set('additionalConditions')} placeholder="Any other requirements..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 60, fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Eligibility Notes</label>
                <textarea value={form.eligibilityNotes} onChange={set('eligibilityNotes')} placeholder="General guidance — verify against institution's latest admission rules..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 60, fontFamily: 'inherit' }} />
              </div>
            </div>

            <SectionLabel>Entrance / Professional Exams</SectionLabel>
            {form.exams.map((exam, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 10, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)' }}>Exam #{i + 1}</span>
                  <button onClick={() => removeExam(i)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}><FiTrash2 size={12} /></button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <SInput value={exam.examName} onChange={e => updateExam(i, 'examName', e.target.value)} placeholder="Exam Name (e.g. CAT, GATE)" />
                  <textarea value={exam.examDefinition} onChange={e => updateExam(i, 'examDefinition', e.target.value)} placeholder="Exam Definition / Purpose..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <SInput value={exam.eligibility} onChange={e => updateExam(i, 'eligibility', e.target.value)} placeholder="Eligibility" />
                    <SInput value={exam.examPattern} onChange={e => updateExam(i, 'examPattern', e.target.value)} placeholder="Exam Pattern (optional)" />
                  </div>
                  <SInput value={exam.syllabus} onChange={e => updateExam(i, 'syllabus', e.target.value)} placeholder="Syllabus (optional)" />
                  <SInput value={exam.officialExamUrl} onChange={e => updateExam(i, 'officialExamUrl', e.target.value)} placeholder="Official Exam Website" />
                  <textarea value={exam.examInfo} onChange={e => updateExam(i, 'examInfo', e.target.value)} placeholder="Application or Exam Information..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
                </div>
              </div>
            ))}
            <SBtn variant="secondary" size="sm" onClick={addExam}><FiPlus size={12} style={{ marginRight: 4 }} />Add Exam</SBtn>

            <SectionLabel>What Can You Specialise In?</SectionLabel>
            {form.specialisations.map((spec, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 10, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)' }}>Specialisation #{i + 1}</span>
                  <button onClick={() => removeSpec(i)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}><FiTrash2 size={12} /></button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <SInput value={spec.name} onChange={e => updateSpec(i, 'name', e.target.value)} placeholder="Specialisation Name (e.g. Finance, Marketing)" />
                  <textarea value={spec.description} onChange={e => updateSpec(i, 'description', e.target.value)} placeholder="Description..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
                  <SInput value={(spec.skills || []).join(', ')} onChange={e => updateSpecSkills(i, e.target.value)} placeholder="Skills / Subjects (comma-separated)" />
                </div>
              </div>
            ))}
            <SBtn variant="secondary" size="sm" onClick={addSpec}><FiPlus size={12} style={{ marginRight: 4 }} />Add Specialisation</SBtn>

            <SectionLabel>Career Path</SectionLabel>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Career Path Overview</label>
                <textarea value={form.careerPath?.overview || ''} onChange={setCP('overview')} placeholder="Overview of career outcomes..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 60, fontFamily: 'inherit' }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)' }}>Popular Job Roles:</div>
              {(form.careerPath?.jobRoles || []).map((role, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                    <SInput value={role.role} onChange={e => updateRole(i, 'role', e.target.value)} placeholder="Job Role (e.g. Financial Analyst)" />
                    <SInput value={role.skillsRequired} onChange={e => updateRole(i, 'skillsRequired', e.target.value)} placeholder="Skills Required (optional)" />
                  </div>
                  <button onClick={() => removeRole(i)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626', marginTop: 4 }}><FiTrash2 size={12} /></button>
                </div>
              ))}
              <SBtn variant="secondary" size="sm" onClick={addRole}><FiPlus size={12} style={{ marginRight: 4 }} />Add Job Role</SBtn>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Further Study / Certification Options</label>
                <SInput value={form.careerPath?.furtherStudy || ''} onChange={setCP('furtherStudy')} placeholder="e.g. PhD, CFA, certifications" />
              </div>
            </div>

            <SectionLabel>Best Suited For</SectionLabel>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Overview</label>
                <textarea value={form.bestSuitedFor?.overview || ''} onChange={setBS('overview')} placeholder="Who is this course best suited for..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Recommended Academic Background</label>
                  <SInput value={form.bestSuitedFor?.recommendedBackground || ''} onChange={setBS('recommendedBackground')} placeholder="e.g. B.Com, B.Sc" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Career Goals</label>
                  <SInput value={form.bestSuitedFor?.careerGoals || ''} onChange={setBS('careerGoals')} placeholder="e.g. Investment banking" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Interests / Strengths</label>
                  <SInput value={form.bestSuitedFor?.interests || ''} onChange={setBS('interests')} placeholder="e.g. Analytical thinking" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Who Should Consider This Course</label>
                  <SInput value={form.bestSuitedFor?.whoShouldConsider || ''} onChange={setBS('whoShouldConsider')} placeholder="e.g. Graduates interested in finance" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Important Considerations Before Enrolling</label>
                <textarea value={form.bestSuitedFor?.considerations || ''} onChange={setBS('considerations')} placeholder="e.g. Verify accreditation, check placement records..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
              </div>
            </div>

            <SectionLabel>Additional Information</SectionLabel>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Course Fees / Fee Range</label>
                  <SInput value={form.fees} onChange={set('fees')} placeholder="e.g. ₹2,00,000–₹15,00,000" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Recognition / Accreditation</label>
                  <SInput value={form.recognition} onChange={set('recognition')} placeholder="e.g. AICTE, UGC" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Course Image / Thumbnail URL</label>
                <SInput value={form.thumbnail} onChange={set('thumbnail')} placeholder="https://..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Additional Notes</label>
                <textarea value={form.additionalNotes} onChange={set('additionalNotes')} placeholder="Any other verified information..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13, minHeight: 50, fontFamily: 'inherit' }} />
              </div>
            </div>

            <SectionLabel>System Fields</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Status</label>
                <SSelect value={form.status} onChange={set('status')}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </SSelect>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--s-border)', paddingTop: 16, marginTop: 16 }}>
              <SBtn variant="secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</SBtn>
              <SBtn variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Course' : 'Create Course'}</SBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
