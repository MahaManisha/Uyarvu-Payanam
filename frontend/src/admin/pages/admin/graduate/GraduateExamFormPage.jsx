import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  SLoader, SBtn, SAlert, FormGrid, FormGroup, FormInput,
} from '../../../components/UI'
import { graduateExamService } from '../../../../services/graduateExamService'

const STATUS_OPTIONS = [
  'TBA',
  'Upcoming',
  'Application Open',
  'Application Closed',
  'Exam Scheduled',
  'Result Released',
  'Archived',
]

const isUrl = (v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(v).trim())
const isValidDate = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))

const EMPTY_FORM = () => ({
  examName: '',
  shortName: '',
  governmentType: 'State',
  state: '',
  organization: '',
  category: '',
  description: '',
  qualification: '',
  eligibleDegrees: '',
  minimumAge: '',
  maximumAge: '',
  ageRelaxation: '',
  additionalEligibility: '',
  posts: '',
  salary: '',
  selectionProcess: '',
  patternMode: '',
  patternDuration: '',
  patternQuestions: '',
  patternMarks: '',
  patternSubjects: '',
  syllabus: '',
  notificationDate: '',
  applicationStartDate: '',
  applicationEndDate: '',
  examDate: '',
  resultDate: '',
  officialWebsite: '',
  notificationUrl: '',
  applicationUrl: '',
  sourceUrl: '',
  status: '',
})

const splitLines = (v) => (typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter(Boolean) : Array.isArray(v) ? v : [])

/**
 * GraduateExamFormPage — add / edit an examination record.
 *   /admin/graduate-exams/exam/new?org=<orgId>   → create
 *   /admin/graduate-exams/exam/:id               → edit
 */
export default function GraduateExamFormPage({ isEdit }) {
  const { id: examId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [orgs, setOrgs] = useState([])
  const [form, setForm] = useState(EMPTY_FORM())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isCreate = !isEdit && !examId

  useEffect(() => {
    let alive = true
    async function init() {
      setLoading(true)
      setError('')
      try {
        const orgRes = await graduateExamService.getOrganizations({ includeInactive: 1 })
        if (!alive) return
        const orgList = orgRes.data || []
        setOrgs(orgList)

        if (!isCreate) {
          const examRes = await graduateExamService.getExam(examId)
          if (!alive) return
          const e = examRes.data
          setForm((f) => ({ ...EMPTY_FORM(), ...f, ...mapExamToForm(e) }))
        } else {
          const preOrg = searchParams.get('org')
          setForm(() => ({
            ...EMPTY_FORM(),
            organization: preOrg || (orgList.length ? orgList[0]._id : ''),
            governmentType: orgList.find((o) => o._id === preOrg)?.governmentType || (orgList[0]?.governmentType || 'State'),
          }))
        }
      } catch (err) {
        if (alive) setError(err?.response?.data?.message || 'Failed to load form data.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    init()
    return () => { alive = false }
  }, [examId]) // eslint-disable-line react-hooks/exhaustive-deps

  const mapExamToForm = (e) => ({
    examName: e.examName || '',
    shortName: e.shortName || '',
    governmentType: e.governmentType || '',
    state: e.state || '',
    organization: e.organization?._id || e.organization || '',
    category: e.category || '',
    description: e.description || '',
    qualification: e.qualification || '',
    eligibleDegrees: (e.eligibleDegrees || []).join('\n'),
    minimumAge: e.minimumAge != null ? String(e.minimumAge) : '',
    maximumAge: e.maximumAge != null ? String(e.maximumAge) : '',
    ageRelaxation: e.ageRelaxation || '',
    additionalEligibility: e.additionalEligibility || '',
    posts: (e.posts || []).join('\n'),
    salary: e.salary || '',
    selectionProcess: (e.selectionProcess || []).join('\n'),
    patternMode: e.examPattern?.mode || '',
    patternDuration: e.examPattern?.duration || '',
    patternQuestions: e.examPattern?.questions || '',
    patternMarks: e.examPattern?.marks || '',
    patternSubjects: (e.examPattern?.subjects || []).join('\n'),
    syllabus: (e.syllabus || []).join('\n'),
    notificationDate: e.notificationDate || '',
    applicationStartDate: e.applicationStartDate || '',
    applicationEndDate: e.applicationEndDate || '',
    examDate: e.examDate || '',
    resultDate: e.resultDate || '',
    officialWebsite: e.officialWebsite || '',
    notificationUrl: e.notificationUrl || '',
    applicationUrl: e.applicationUrl || '',
    sourceUrl: e.sourceUrl || '',
    status: e.status || '',
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleOrgChange = (e) => {
    const orgId = e.target.value
    const org = orgs.find((o) => o._id === orgId)
    setForm((f) => ({
      ...f,
      organization: orgId,
      governmentType: org?.governmentType || f.governmentType,
      state: org?.state || f.state,
    }))
  }

  const validate = () => {
    if (!form.examName.trim()) return 'Exam name is required.'
    if (!form.organization) return 'Recruitment organization is required.'
    if (!form.governmentType) return 'Government type is required.'
    for (const [label, value] of [
      ['Official website', form.officialWebsite],
      ['Notification URL', form.notificationUrl],
      ['Application URL', form.applicationUrl],
      ['Source URL', form.sourceUrl],
    ]) {
      if (!isUrl(value)) return `${label} must be a valid http(s) URL (or leave empty).`
    }
    if (form.minimumAge !== '' && (Number.isNaN(Number(form.minimumAge)) || Number(form.minimumAge) < 0)) {
      return 'Minimum age must be a non-negative number.'
    }
    if (form.maximumAge !== '' && (Number.isNaN(Number(form.maximumAge)) || Number(form.maximumAge) < 0)) {
      return 'Maximum age must be a non-negative number.'
    }
    if (form.minimumAge !== '' && form.maximumAge !== '' && Number(form.maximumAge) < Number(form.minimumAge)) {
      return 'Maximum age cannot be less than minimum age.'
    }
    for (const [label, value] of [
      ['Notification date', form.notificationDate],
      ['Application start date', form.applicationStartDate],
      ['Application end date', form.applicationEndDate],
      ['Exam date', form.examDate],
      ['Result date', form.resultDate],
    ]) {
      if (!isValidDate(value)) return `${label} must be a valid date (YYYY-MM-DD) or empty.`
    }
    if (form.applicationStartDate && form.applicationEndDate && form.applicationEndDate < form.applicationStartDate) {
      return 'Application end date cannot be before the application start date.'
    }
    return ''
  }

  const buildPayload = () => ({
    examName: form.examName.trim(),
    shortName: form.shortName.trim(),
    governmentType: form.governmentType,
    state: form.state.trim(),
    organization: form.organization,
    category: form.category,
    description: form.description,
    qualification: form.qualification,
    eligibleDegrees: splitLines(form.eligibleDegrees),
    minimumAge: form.minimumAge === '' ? null : Number(form.minimumAge),
    maximumAge: form.maximumAge === '' ? null : Number(form.maximumAge),
    ageRelaxation: form.ageRelaxation,
    additionalEligibility: form.additionalEligibility,
    posts: splitLines(form.posts),
    salary: form.salary,
    selectionProcess: splitLines(form.selectionProcess),
    examPattern: {
      mode: form.patternMode,
      duration: form.patternDuration,
      questions: form.patternQuestions,
      marks: form.patternMarks,
      subjects: splitLines(form.patternSubjects),
    },
    syllabus: splitLines(form.syllabus),
    notificationDate: form.notificationDate,
    applicationStartDate: form.applicationStartDate,
    applicationEndDate: form.applicationEndDate,
    examDate: form.examDate,
    resultDate: form.resultDate,
    officialWebsite: form.officialWebsite.trim(),
    notificationUrl: form.notificationUrl.trim(),
    applicationUrl: form.applicationUrl.trim(),
    sourceUrl: form.sourceUrl.trim(),
    status: form.status,
  })

  const handleSave = async () => {
    const v = validate()
    if (v) return setError(v)
    setError('')
    setSaving(true)
    try {
      const payload = buildPayload()
      const res = isCreate
        ? await graduateExamService.createExam(payload)
        : await graduateExamService.updateExam(examId, payload)
      const savedOrg = res.data?.organization?._id || payload.organization
      navigate(`/admin/graduate-exams/organization/${savedOrg}`)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save exam.')
      setSaving(false)
    }
  }

  if (loading) return <SLoader />

  const selectedOrg = orgs.find((o) => o._id === form.organization)

  return (
    <div>
      <h2 style={{ fontFamily: 'Nunito', fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
        {isCreate ? 'Add Exam' : 'Edit Exam'}
      </h2>
      <p style={{ margin: '0 0 20px', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
        {isCreate ? 'Create a new examination record.' : `Editing: ${form.examName}`} — optional fields may stay
        empty; the student pages will show “Refer to the latest official notification” for them.
      </p>

      {error && <div style={{ marginBottom: 16 }}><SAlert type="error">{error}</SAlert></div>}

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Basic Info</SectionTitle>
        <FormGrid>
          <FormGroup label="Exam Name *" full>
            <FormInput value={form.examName} onChange={set('examName')} placeholder="e.g. TNPSC Group IV" />
          </FormGroup>
          <FormGroup label="Short Name">
            <FormInput value={form.shortName} onChange={set('shortName')} placeholder="e.g. Group IV" />
          </FormGroup>
          <FormGroup label="Government Type *">
            <FormInput as="select" value={form.governmentType} onChange={(e) => setForm((f) => ({ ...f, governmentType: e.target.value }))}>
              <option value="State">State</option>
              <option value="Central">Central</option>
            </FormInput>
          </FormGroup>
          <FormGroup label="State">
            <FormInput value={form.state} onChange={set('state')} placeholder="e.g. Tamil Nadu" />
          </FormGroup>
          <FormGroup label="Recruitment Organization *" full>
            <FormInput as="select" value={form.organization} onChange={handleOrgChange}>
              <option value="">Select organization…</option>
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>{o.name} {o.governmentType === 'State' && o.state ? `(${o.state})` : '(Central)'}</option>
              ))}
            </FormInput>
          </FormGroup>
          <FormGroup label="Category" full>
            <FormInput value={form.category} onChange={set('category')} placeholder="e.g. Combined Civil Services Examination – IV" />
          </FormGroup>
          <FormGroup label="Description" full>
            <FormInput as="textarea" value={form.description} onChange={set('description')} placeholder="What this examination recruits for…" />
          </FormGroup>
        </FormGrid>
      </div>

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Eligibility</SectionTitle>
        <FormGrid>
          <FormGroup label="Minimum Qualification" full>
            <FormInput as="textarea" value={form.qualification} onChange={set('qualification')} placeholder="e.g. Bachelor's degree from a recognised university" />
          </FormGroup>
          <FormGroup label="Eligible Degrees (one per line)" full>
            <FormInput as="textarea" value={form.eligibleDegrees} onChange={set('eligibleDegrees')} placeholder={'B.E / B.Tech\nMCA\nB.Sc'} />
          </FormGroup>
          <FormGroup label="Minimum Age">
            <FormInput type="number" min="0" value={form.minimumAge} onChange={set('minimumAge')} placeholder="e.g. 21" />
          </FormGroup>
          <FormGroup label="Maximum Age">
            <FormInput type="number" min="0" value={form.maximumAge} onChange={set('maximumAge')} placeholder="e.g. 32" />
          </FormGroup>
          <FormGroup label="Age Relaxation" full>
            <FormInput value={form.ageRelaxation} onChange={set('ageRelaxation')} placeholder="As per the official notification" />
          </FormGroup>
          <FormGroup label="Additional Eligibility" full>
            <FormInput as="textarea" value={form.additionalEligibility} onChange={set('additionalEligibility')} placeholder="Citizenship, physical standards, experience…" />
          </FormGroup>
        </FormGrid>
      </div>

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Recruitment</SectionTitle>
        <FormGrid>
          <FormGroup label="Posts (one per line)" full>
            <FormInput as="textarea" value={form.posts} onChange={set('posts')} placeholder={'Deputy Collector\nDeputy Superintendent of Police'} />
          </FormGroup>
          <FormGroup label="Salary / Remuneration" full>
            <FormInput value={form.salary} onChange={set('salary')} placeholder="Leave empty unless from the current notification" />
          </FormGroup>
          <FormGroup label="Selection Process (one per line)" full>
            <FormInput as="textarea" value={form.selectionProcess} onChange={set('selectionProcess')} placeholder={'Preliminary Examination\nMain Examination\nInterview'} />
          </FormGroup>
          <FormGroup label="Pattern — Mode">
            <FormInput value={form.patternMode} onChange={set('patternMode')} placeholder="Objective / CBT / Descriptive" />
          </FormGroup>
          <FormGroup label="Pattern — Duration">
            <FormInput value={form.patternDuration} onChange={set('patternDuration')} placeholder="e.g. 3 hours" />
          </FormGroup>
          <FormGroup label="Pattern — Questions">
            <FormInput value={form.patternQuestions} onChange={set('patternQuestions')} placeholder="e.g. 200" />
          </FormGroup>
          <FormGroup label="Pattern — Marks">
            <FormInput value={form.patternMarks} onChange={set('patternMarks')} placeholder="e.g. 300" />
          </FormGroup>
          <FormGroup label="Pattern — Subjects (one per line)" full>
            <FormInput as="textarea" value={form.patternSubjects} onChange={set('patternSubjects')} placeholder={'General Studies\nAptitude & Mental Ability'} />
          </FormGroup>
          <FormGroup label="Syllabus (one per line)" full>
            <FormInput as="textarea" value={form.syllabus} onChange={set('syllabus')} placeholder={'General Studies — history, geography, polity…\nAptitude & Mental Ability'} />
          </FormGroup>
        </FormGrid>
      </div>

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Dates</SectionTitle>
        <FormGrid>
          <FormGroup label="Notification Date">
            <FormInput type="date" value={form.notificationDate} onChange={set('notificationDate')} />
          </FormGroup>
          <FormGroup label="Result Date">
            <FormInput type="date" value={form.resultDate} onChange={set('resultDate')} />
          </FormGroup>
          <FormGroup label="Application Start Date">
            <FormInput type="date" value={form.applicationStartDate} onChange={set('applicationStartDate')} />
          </FormGroup>
          <FormGroup label="Application End Date">
            <FormInput type="date" value={form.applicationEndDate} onChange={set('applicationEndDate')} />
          </FormGroup>
          <FormGroup label="Exam Date">
            <FormInput type="date" value={form.examDate} onChange={set('examDate')} />
          </FormGroup>
        </FormGrid>
      </div>

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Links</SectionTitle>
        <FormGrid>
          <FormGroup label="Official Website" full>
            <FormInput value={form.officialWebsite} onChange={set('officialWebsite')} placeholder="https://www.tnpsc.gov.in" />
          </FormGroup>
          <FormGroup label="Notification URL" full>
            <FormInput value={form.notificationUrl} onChange={set('notificationUrl')} placeholder="Official notification PDF/link for the current cycle" />
          </FormGroup>
          <FormGroup label="Application URL" full>
            <FormInput value={form.applicationUrl} onChange={set('applicationUrl')} placeholder="Only when the application portal is verified and live" />
          </FormGroup>
          <FormGroup label="Source / Reference URL" full>
            <FormInput value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="e.g. https://apply.tnpscexams.in/notification?app_id=… (reference only)" />
          </FormGroup>
        </FormGrid>
      </div>

      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <SectionTitle>Status</SectionTitle>
        <FormGrid>
          <FormGroup label="Status" full>
            <FormInput as="select" value={form.status} onChange={set('status')}>
              <option value="">TBA — check latest official notification</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </FormInput>
          </FormGroup>
        </FormGrid>
        {selectedOrg && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>
            Saving to: {selectedOrg.name} ({form.governmentType})
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <SBtn variant="outline" onClick={() => navigate(-1)}>Cancel</SBtn>
        <SBtn onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : (isCreate ? 'Create Exam' : 'Save Changes')}
        </SBtn>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      margin: '0 0 16px', fontFamily: 'Nunito', fontSize: 15, fontWeight: 900,
      color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em',
      paddingBottom: 10, borderBottom: '1.5px solid var(--border)',
    }}>
      {children}
    </h3>
  )
}