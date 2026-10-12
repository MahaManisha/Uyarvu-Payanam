import React from 'react'
import { SBadge, SBtn, Modal } from '../../../components/UI'

const STATUS_COLOR = {
  '': 'gray',
  TBA: 'gray',
  Upcoming: 'purple',
  'Application Open': 'green',
  'Application Closed': 'red',
  'Exam Scheduled': 'blue',
  'Exam Completed': 'gold',
  'Result Released': 'gold',
  'Date Not Available': 'gray',
  Archived: 'gray',
}

const DATE_LABELS = [
  ['notificationDate', 'Notification Date'],
  ['applicationStartDate', 'Application Start'],
  ['applicationEndDate', 'Application End'],
  ['examDate', 'Exam Date'],
  ['resultDate', 'Result Date'],
]

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.some((v) => String(v || '').trim())
  if (typeof value === 'object') return Object.values(value).some(hasValue)
  return String(value).trim().length > 0
}

/**
 * Section — one grouped block (Overview / Dates / Eligibility / Recruitment /
 * Exam Information / Links). `rows` is pre-filtered label/value pairs; the
 * whole section is dropped when nothing has data, so the modal only ever
 * shows real, sourced values.
 */
function Section({ title, rows }) {
  const visible = rows.filter((r) => hasValue(r.value))
  if (!visible.length) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <h4 style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', margin: '0 0 4px' }}>
        {title}
      </h4>
      <div style={{ borderTop: '2px solid var(--primary)' }}>
        {visible.map(({ label, value }) => (
          <div key={label} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 3 }}>
              {label}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {Array.isArray(value) ? value.join('\n') : value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const asLink = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, wordBreak: 'break-all' }}>
      {url}
    </a>
  ) : ''

/** Date-only values ("2026-01-18") → "18 Jan 2026"; other text passes through. */
const fmtDateValue = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  try {
    const d = new Date(`${value}T00:00:00`)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

const formatDateTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * GraduateCentralExamDetails — grouped View Details modal for a Central exam
 * record (typically synced from EasyShiksha). Empty rows and empty sections
 * are hidden entirely; every value shown is exactly what the source or the
 * admin stored — nothing is inferred here.
 */
export default function GraduateCentralExamDetails({ exam, onClose, onEdit }) {
  if (!exam) return null
  const orgName = typeof exam.organization === 'object' && exam.organization ? exam.organization.name : ''
  const ages =
    [
      exam.minimumAge != null ? `Min ${exam.minimumAge}` : '',
      exam.maximumAge != null ? `Max ${exam.maximumAge}` : '',
      exam.ageRelaxation,
    ]
      .filter(Boolean)
      .join(' · ') || ''

  const patternValue = [
    exam.examPattern?.mode && `Mode: ${exam.examPattern.mode}`,
    exam.examPattern?.duration && `Duration: ${exam.examPattern.duration}`,
    exam.examPattern?.questions && `Questions: ${exam.examPattern.questions}`,
    exam.examPattern?.marks && `Marks: ${exam.examPattern.marks}`,
    exam.examPattern?.subjects?.length ? `Subjects:\n${exam.examPattern.subjects.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <Modal title={exam.examName} onClose={onClose} maxWidth={760}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SBadge color={STATUS_COLOR[exam.status] || 'gray'}>{exam.status || 'Date Not Available'}</SBadge>
        <SBadge color="purple">{exam.governmentType || 'Central'}</SBadge>
        {exam.category && <SBadge color="blue">{exam.category}</SBadge>}
        {!exam.isActive && <SBadge color="gray">Archived</SBadge>}
      </div>

      <Section
        title="Overview"
        rows={[
          { label: 'Exam Name', value: exam.examName },
          { label: 'Short Name', value: exam.shortName },
          { label: 'Conducting Body', value: exam.conductingBody || orgName },
          { label: 'Organization', value: orgName },
          { label: 'Category', value: exam.category },
          { label: 'Description', value: exam.description },
          { label: 'Vacancy', value: exam.vacancyInfo },
        ]}
      />

      <Section
        title="Dates"
        rows={[
          ...DATE_LABELS.map(([key, label]) => ({ label, value: fmtDateValue(exam[key]) })),
          { label: 'Source Date Notes', value: exam.datesNotes },
        ]}
      />

      <Section
        title="Eligibility"
        rows={[
          { label: 'Qualification', value: exam.qualification },
          { label: 'Age Limit', value: ages },
          { label: 'Eligibility Details', value: exam.additionalEligibility },
        ]}
      />

      <Section
        title="Recruitment"
        rows={[
          { label: 'Posts', value: exam.posts },
          { label: 'Salary / Remuneration', value: exam.salary },
          { label: 'Selection Process', value: exam.selectionProcess },
          { label: 'Admit Card', value: exam.admitCardInfo },
          { label: 'Result', value: exam.resultInfo },
          { label: 'Cutoff', value: exam.cutoffInfo },
        ]}
      />

      <Section
        title="Exam Information"
        rows={[
          { label: 'Exam Pattern', value: patternValue },
          { label: 'Syllabus', value: exam.syllabus },
        ]}
      />

      <Section
        title="Links"
        rows={[
          { label: 'Official Website', value: asLink(exam.officialWebsite) },
          { label: 'Application Link', value: asLink(exam.applicationUrl) },
          { label: 'Notification Link', value: asLink(exam.notificationUrl) },
          { label: `Source (${exam.sourceWebsite || 'External'})`, value: asLink(exam.sourceUrl) },
          { label: 'Last Checked', value: formatDateTime(exam.sourceLastChecked) },
        ]}
      />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <SBtn variant="outline" onClick={onClose}>Close</SBtn>
        {onEdit && <SBtn onClick={() => onEdit(exam)}>Edit Exam</SBtn>}
      </div>
    </Modal>
  )
}
