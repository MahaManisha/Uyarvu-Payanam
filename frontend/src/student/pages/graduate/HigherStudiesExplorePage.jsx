import React, { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import higherStudiesService from '../../services/higherStudiesService'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { SCard, SBtn, SLoader, SInput } from '../../components/ui'
import { FiSearch, FiExternalLink, FiBookmark, FiCheck, FiClock } from 'react-icons/fi'

const CATEGORIES = ['All', 'Engineering & Technology', 'Medical Exams', 'Management & MBA Exams', 'Science Exams', 'Central University & Academic Exams', 'Pharmacy Exams', 'Law Exams']

export default function HigherStudiesExplorePage() {
  const { isAuthenticated } = useStudentAuth()
  const location = useLocation()
  const basePath = location.pathname.replace(/\/+$/, '') || '/higher-studies'
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [background, setBackground] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [savedIds, setSavedIds] = useState(new Set())

  const fetchCourses = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { page: String(page), limit: '12' }
      if (search) params.search = search
      if (category !== 'All') params.category = category
      if (background) params.background = background
      const res = await higherStudiesService.list(params)
      if (res?.success) { setCourses(res.courses || []); setTotalPages(res.pagination?.pages || 1) }
      else setError(res.message || 'Failed to load courses.')
    } catch { setError('Could not connect to the server.') } finally { setLoading(false) }
  }, [page, search, category, background])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  useEffect(() => {
    if (!isAuthenticated) return
    const fetchSaved = async () => {
      try {
        const res = await higherStudiesService.getSavedList()
        if (res?.success && res.data) setSavedIds(new Set(res.data.map(s => String(s.contentId?._id || s.contentId))))
      } catch { /* ignore */ }
    }
    fetchSaved()
  }, [isAuthenticated])

  const toggleSave = async (courseId) => {
    if (!isAuthenticated) return
    try {
      if (savedIds.has(courseId)) { await higherStudiesService.unsave(courseId); setSavedIds(prev => { const n = new Set(prev); n.delete(courseId); return n }) }
      else { await higherStudiesService.save(courseId); setSavedIds(prev => new Set(prev).add(courseId)) }
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="s-anim-up">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', color: '#5b21b6', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          🎓 HIGHER STUDIES
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>
          Explore Higher Studies
        </h1>
        <p style={{ fontSize: 14, color: 'var(--s-text3)', margin: '4px 0 0' }}>
          Explore national entrance exams for postgraduate and professional programs after graduation.
        </p>
      </div>

      {/* Search & Filters */}
      <SCard style={{ padding: 20, borderRadius: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} size={14} />
            <input placeholder="Search courses, specialisations..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }} />
          </div>
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <input placeholder="Academic background (e.g. B.E, B.Com, B.Sc)..." value={background} onChange={e => { setBackground(e.target.value); setPage(1) }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s-border)', fontSize: 13 }} />
          </div>
        </div>
      </SCard>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><SLoader /><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-text3)', marginTop: 12 }}>Loading courses...</div></div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: 'var(--s-text)' }}>{error}</div>
          <SBtn variant="primary" onClick={fetchCourses} style={{ marginTop: 16 }}>Retry</SBtn>
        </div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 700, color: 'var(--s-text)' }}>No courses found</div>
          <div style={{ fontSize: 13, color: 'var(--s-text3)', marginTop: 4 }}>Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {courses.map(course => (
              <SCard key={course._id} style={{ padding: 24, borderRadius: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#ede9fe', color: '#5b21b6' }}>{course.courseCategory}</div>
                    {isAuthenticated && (
                      <button onClick={() => toggleSave(course._id)} style={{ background: savedIds.has(course._id) ? '#dcfce7' : '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: savedIds.has(course._id) ? '#16a34a' : '#64748b' }}>{savedIds.has(course._id) ? <FiCheck size={14} /> : <FiBookmark size={14} />}</button>
                    )}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 4px' }}>{course.courseName}</h3>
                  <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 8 }}>{course.targetAcademicBackground || course.courseCategory}</div>
                  <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, margin: '0 0 12px' }}>{course.definition || course.detailedContent?.slice(0, 120) + '...'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {course.duration && <span style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: 'var(--s-text3)' }}><FiClock size={10} style={{ marginRight: 3 }} />{course.duration}</span>}
                    {course.studyMode && <span style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: 'var(--s-text3)' }}>{course.studyMode}</span>}
                    {course.fees && <span style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: 'var(--s-text3)' }}>{course.fees}</span>}
                  </div>
                  {course.eligibleDegree && <div style={{ fontSize: 11, color: 'var(--s-text3)', marginBottom: 8 }}><strong>Eligibility:</strong> {course.eligibleDegree}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--s-border)' }}>
                  <Link to={`${basePath}/${course._id}`} style={{ flex: 1 }}><SBtn variant="primary" style={{ width: '100%', padding: '8px 0', borderRadius: 10, fontSize: 12 }}>View Details</SBtn></Link>
                  {course.officialCourseUrl && <a href={course.officialCourseUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><FiExternalLink size={12} /></a>}
                </div>
              </SCard>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--s-border)', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12 }}>Prev</button>
              <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--s-text3)' }}>Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--s-border)', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12 }}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
