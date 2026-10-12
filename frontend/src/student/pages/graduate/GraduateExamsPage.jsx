import React, { useState, useEffect, useMemo } from 'react'
import {
  FiBook, FiCalendar, FiExternalLink, FiSearch, FiBookmark,
  FiClipboard, FiFilter
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import graduateService from '../../../services/graduateService'
import { graduateExamService } from '../../../services/graduateExamService'
import { userActionService } from '../../../services/userActionService'
import applicationService from '../../../services/applicationService'
import {
  generatePersonalizedExamsGuide,
  getEffectiveAcademicHierarchy
} from '../../services/graduatePersonalizationEngine'
import GraduateExamImage from '../../components/common/GraduateExamImage'
import GraduateCourseImage from '../../components/common/GraduateCourseImage'

const PAGE_SIZE = 6

export default function GraduateExamsPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({})
  const [tab, setTab] = useState('all') // 'all' | 'personalized'

  // DB exams state
  const [exams, setExams] = useState([])
  const [examsLoading, setExamsLoading] = useState(false)
  const [examsError, setExamsError] = useState('')
  const [search, setSearch] = useState('')
  const [govFilter, setGovFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [savedIds, setSavedIds] = useState(new Set())
  const [trackedIds, setTrackedIds] = useState(new Set())
  const [notice, setNotice] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await graduateService.getProfile()
      if (res.success && res.profile) setProfile(res.profile)
    } catch (err) {
      console.error('Failed to load profile for exams:', err)
    } finally {
      setLoading(false)
    }
    fetchExams()
    fetchSavedAndTracked()
  }

  const fetchExams = async () => {
    try {
      setExamsLoading(true)
      setExamsError('')
      const res = await graduateExamService.getExams()
      if (res.success) setExams(res.data || [])
    } catch {
      setExamsError('Could not load government exams right now. Please try again.')
    } finally {
      setExamsLoading(false)
    }
  }

  const fetchSavedAndTracked = async () => {
    try {
      const saved = await userActionService.getSavedList('GraduateExam')
      if (saved.success) {
        setSavedIds(new Set((saved.data || []).map((s) => String(s.contentId?._id || s.contentId))))
      }
    } catch { /* not logged in or no data */ }
    try {
      const tracked = await applicationService.list()
      if (tracked.success) {
        setTrackedIds(new Set((tracked.data || []).map((t) => String(t.examId?._id || t.examId)).filter(Boolean)))
      }
    } catch { /* ignore */ }
  }

  const toggleSave = async (exam) => {
    const id = String(exam._id)
    try {
      if (savedIds.has(id)) {
        await userActionService.unsaveItem(id)
        setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
        setNotice('Removed from saved opportunities.')
      } else {
        await userActionService.saveItem(id, 'GraduateExam')
        setSavedIds((prev) => new Set(prev).add(id))
        setNotice('Saved to your opportunities.')
      }
    } catch { setNotice('Action failed. Please try again.') }
  }

  const trackExam = async (exam) => {
    try {
      const res = await applicationService.create({ examId: exam._id })
      if (res.success) {
        setTrackedIds((prev) => new Set(prev).add(String(exam._id)))
        setNotice(res.duplicate ? 'Already in your application tracker.' : 'Added to your application tracker.')
      }
    } catch { setNotice('Could not add to tracker.') }
  }

  const eligibilityFor = (exam) => {
    const degree = String(profile.degree || '').toLowerCase()
    const degrees = (exam.eligibleDegrees || []).map((d) => String(d).toLowerCase())
    const qualification = String(exam.qualification || '').toLowerCase()
    if (degree && (degrees.some((d) => d.includes(degree) || degree.includes(d)) || qualification.includes(degree))) {
      return { label: 'Eligible', bg: '#d1fae5', fg: '#047857' }
    }
    if (degrees.length > 0 || qualification) {
      return { label: 'Not eligible', bg: '#fee2e2', fg: '#b91c1c' }
    }
    return { label: 'Possibly eligible — verify', bg: '#fef3c7', fg: '#b45309' }
  }

  const filtered = useMemo(() => {
    let list = exams
    if (govFilter) list = list.filter((e) => e.governmentType === govFilter)
    if (statusFilter) list = list.filter((e) => e.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((e) =>
        (e.examName || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.state || '').toLowerCase().includes(q) ||
        (e.organization?.name || '').toLowerCase().includes(q)
      )
    }
    if (sortBy === 'deadline') {
      list = [...list].sort((a, b) => String(a.applicationEndDate || '9999').localeCompare(String(b.applicationEndDate || '9999')))
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => (a.examName || '').localeCompare(b.examName || ''))
    }
    return list
  }, [exams, govFilter, statusFilter, search, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search, govFilter, statusFilter, sortBy])

  const academic = getEffectiveAcademicHierarchy(profile)
  const examsGuide = generatePersonalizedExamsGuide(profile || {})
  const personalized = (examsGuide.recommendedExams || []).filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    ex.category.toLowerCase().includes(search.toLowerCase())
  )

  // Shared handler: open the official application portal with a safe fallback
  const handleApplyNow = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('Official application URL unavailable or opening soon.')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 16, padding: '26px 30px', color: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <FiBook size={16} /> Government Exams
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 6px' }}>
          Competitive exam opportunities for {academic.degree || 'graduates'}
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
          Browse real, admin-managed government exams. Check eligibility, save opportunities, and track your applications.
        </p>
      </div>

      {notice && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['all', 'All Government Exams'], ['personalized', 'Personalized Guide']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 16px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: tab === id ? '#2563eb' : '#fff', color: tab === id ? '#fff' : '#475569', borderColor: tab === id ? '#2563eb' : '#e2e8f0'
          }}>{label}</button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '8px 12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px' }}>
          <FiSearch color="#94a3b8" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams, org, state..." style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%' }} />
        </div>
        <select value={govFilter} onChange={(e) => setGovFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="">All types</option>
          <option value="Central">Central</option>
          <option value="State">State</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="">All statuses</option>
          {['Upcoming', 'Application Open', 'Application Closed', 'Exam Scheduled', 'Result Released', 'TBA'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="newest">Sort: Newest</option>
          <option value="name">Sort: Name</option>
          <option value="deadline">Sort: Deadline</option>
        </select>
      </div>

      {tab === 'personalized' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {personalized.map((ex, idx) => (
            <div key={idx} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ marginBottom: 14 }}><GraduateExamImage exam={ex} height={160} borderRadius={12} /></div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: ex.isSelected ? '#d1fae5' : '#eff6ff', color: ex.isSelected ? '#047857' : '#2563eb' }}>
                {ex.isSelected ? 'Selected in Profile' : ex.category}
              </span>
              <h3 style={{ margin: '10px 0 6px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{ex.name}</h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>{ex.purpose}</p>
              {ex.officialUrl && (
                <a href={ex.officialUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
                  View Official Exam Site <FiExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
          {personalized.length === 0 && <EmptyState message="No personalized exams match your search." />}
        </div>
      ) : (
        <>
          {examsLoading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading exams…</div>}
          {examsError && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 14 }}>{examsError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {pageItems.map((exam) => {
              const elig = eligibilityFor(exam)
              return (
                <div key={exam._id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: elig.bg, color: elig.fg }}>{elig.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{exam.governmentType}{exam.state ? ` · ${exam.state}` : ''}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{exam.examName}</h3>
                  <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{exam.organization?.name || exam.conductingBody || 'Organization not specified'}</div>
                  {exam.qualification && <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}><strong>Eligibility:</strong> {exam.qualification}</p>}
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#475569' }}>
                    {exam.applicationEndDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiCalendar size={12} /> Apply by {exam.applicationEndDate}</span>}
                    {exam.examDate && <span>Exam: {exam.examDate}</span>}
                  </div>
                  {!elig.label.startsWith('Eligible') && exam.eligibilityNote === undefined && null}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <button onClick={() => handleApplyNow(exam.applicationUrl)} style={{ ...pill, background: '#2563eb', color: '#fff' }}>
                      Apply officially <FiExternalLink size={12} />
                    </button>
                    <button onClick={() => toggleSave(exam)} style={{ ...pill, background: savedIds.has(String(exam._id)) ? '#fef3c7' : '#f1f5f9', color: '#0f172a' }}>
                      <FiBookmark size={12} /> {savedIds.has(String(exam._id)) ? 'Saved' : 'Save'}
                    </button>
                    <button onClick={() => trackExam(exam)} disabled={trackedIds.has(String(exam._id))} style={{ ...pill, background: trackedIds.has(String(exam._id)) ? '#d1fae5' : '#f1f5f9', color: '#0f172a' }}>
                      <FiClipboard size={12} /> {trackedIds.has(String(exam._id)) ? 'Tracking' : 'Track'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {!examsLoading && pageItems.length === 0 && <EmptyState message="No exams match your filters." />}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={pageBtn}>Prev</button>
              <span style={{ alignSelf: 'center', fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} style={pageBtn}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const pill = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }
const pageBtn = { padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }

function EmptyState({ message }) {
  return <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1px dashed #e2e8f0' }}>{message}</div>
}
