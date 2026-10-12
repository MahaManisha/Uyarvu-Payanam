import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  FiTarget, FiSearch, FiCheckCircle, FiClock, FiCalendar,
  FiAward, FiArrowRight, FiBookOpen, FiFileText, FiExternalLink,
  FiAlertCircle, FiRefreshCw, FiTrendingUp, FiCheck, FiSliders, FiHelpCircle, FiXCircle
} from 'react-icons/fi'
import graduateService from '../../../services/graduateService'
import ExamCard from '../../components/graduate/ExamCard'

const CATEGORIES = [
  "ALL",
  "Government",
  "Engineering",
  "Management",
  "Higher Studies",
  "Banking",
  "Railway",
  "Defence",
  "State PSC",
  "PSU"
]

export default function GraduateRoadmapPage() {
  const params = useParams()
  const navigate = useNavigate()
  const examIdParam = params.examId || null

  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState(false)
  const [exams, setExams] = useState([])
  const [recommendedExams, setRecommendedExams] = useState([])
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Selected Exam Intelligence State
  const [activeExam, setActiveExam] = useState(null)
  const [activeTab, setActiveTab] = useState("STUDY PLAN")
  const [studyPlan, setStudyPlan] = useState(null)
  const [progressData, setProgressData] = useState(null)

  // Settings
  const [hoursPerDay, setHoursPerDay] = useState(2)
  const [studentLevel, setStudentLevel] = useState("Intermediate")
  const [savingPlan, setSavingPlan] = useState(false)

  // Mock Test State
  const [mockScore, setMockScore] = useState(75)
  const [mockTotal, setMockTotal] = useState(100)
  const [submittingMock, setSubmittingMock] = useState(false)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    fetchExamsList()
  }, [selectedCategory, debouncedSearch])

  useEffect(() => {
    if (examIdParam) {
      loadExamIntelligence(examIdParam)
    } else {
      setActiveExam(null)
    }
  }, [examIdParam])

  const fetchExamsList = async () => {
    try {
      setLoading(true)
      setErrorState(false)
      const res = await graduateService.getExams(selectedCategory, debouncedSearch)
      if (res.success && res.exams) {
        setExams(res.exams)
        setRecommendedExams(res.recommendedExams || [])
      } else {
        setExams([])
        setRecommendedExams([])
      }
    } catch (err) {
      console.error('Failed to load examinations:', err)
      setErrorState(true)
    } finally {
      setLoading(false)
    }
  }

  const loadExamIntelligence = async (examId) => {
    try {
      setLoading(true)
      setErrorState(false)
      const res = await graduateService.getExamById(examId)
      if (res.success && res.exam) {
        setActiveExam(res.exam)
        
        const planRes = await graduateService.getStudyPlan(examId)
        if (planRes.success && planRes.plan) {
          setStudyPlan(planRes.plan)
          setHoursPerDay(planRes.plan.hoursPerDay || 2)
          setStudentLevel(planRes.plan.studentLevel || "Intermediate")
        }

        const progRes = await graduateService.getExamProgress(examId)
        if (progRes.success) {
          setProgressData(progRes)
        }
      } else {
        setActiveExam(null)
      }
    } catch (err) {
      console.error('Failed to load exam intelligence:', err)
      setErrorState(true)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStudyPlan = async (e) => {
    e.preventDefault()
    if (!activeExam) return
    try {
      setSavingPlan(true)
      const res = await graduateService.saveStudyPlan(activeExam.examId, {
        hoursPerDay: Number(hoursPerDay),
        studentLevel
      })
      if (res.success && res.plan) {
        setStudyPlan(res.plan)
      }
    } catch (err) {
      console.error('Failed to update study plan:', err)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleSubmitMock = async (e) => {
    e.preventDefault()
    if (!activeExam) return
    try {
      setSubmittingMock(true)
      const res = await graduateService.submitMockTest(activeExam.examId, {
        mockTitle: `${activeExam.shortName} Practice Mock`,
        score: Number(mockScore),
        totalMarks: Number(mockTotal),
        mockType: "FULL_MOCK"
      })
      if (res.success) {
        await loadExamIntelligence(activeExam.examId)
      }
    } catch (err) {
      console.error('Failed to submit mock test:', err)
    } finally {
      setSubmittingMock(false)
    }
  }

  // Clear Search
  const handleClearFilters = () => {
    setSearchTerm("")
    setDebouncedSearch("")
    setSelectedCategory("ALL")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: EXAM DISCOVERY & SEARCH (When no examination is selected)
  // ══════════════════════════════════════════════════════════════════════════
  if (!examIdParam || !activeExam) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
        {/* Header Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 16, padding: '32px 36px', color: '#fff',
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <FiTarget size={16} /> EXAM INTELLIGENCE & PERSONALIZED ROADMAP
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 10px', color: '#fff' }}>
            Choose an Examination to Build Your Preparation Roadmap
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14.5, maxWidth: 820 }}>
            Select any competitive government, engineering, higher studies, or banking examination to access verified exam patterns, syllabus breakdowns, historical topic priorities, and an adaptive study plan.
          </p>
        </div>

        {/* Search & Category Filter Area */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 16, top: 16, color: '#64748b' }} size={18} />
            <input
              type="text"
              placeholder="Search examination (e.g. SSC CGL, GATE, UPSC, CAT, TNPSC, Banking)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px 14px 48px', borderRadius: 12,
                border: '1px solid #cbd5e1', fontSize: 15, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px', borderRadius: 20, border: 'none',
                  fontSize: 13, fontWeight: selectedCategory === cat ? 800 : 600,
                  background: selectedCategory === cat ? '#2563eb' : '#f1f5f9',
                  color: selectedCategory === cat ? '#fff' : '#475569',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results Count Header */}
          {!loading && !errorState && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {exams.length} {exams.length === 1 ? 'examination' : 'examinations'} found {selectedCategory !== 'ALL' && `in ${selectedCategory}`}
              </span>
              {(searchTerm || selectedCategory !== 'ALL') && (
                <button
                  onClick={handleClearFilters}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer', fontSize: 12.5 }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* LOADING SKELETON STATE */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, height: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: '40%', height: 20, background: '#f1f5f9', borderRadius: 6 }} />
                <div style={{ width: '70%', height: 26, background: '#f1f5f9', borderRadius: 6 }} />
                <div style={{ width: '100%', height: 60, background: '#f1f5f9', borderRadius: 6 }} />
                <div style={{ width: '100%', height: 40, background: '#f1f5f9', borderRadius: 8, marginTop: 'auto' }} />
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && errorState && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #fecaca', padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <FiAlertCircle size={40} style={{ color: '#dc2626' }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Unable to load examinations</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>An error occurred while communicating with the examination discovery API.</p>
            <button
              onClick={fetchExamsList}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !errorState && exams.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <FiSearch size={40} style={{ color: '#94a3b8' }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>No examinations found</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Try selecting another category or adjusting your search term.</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                onClick={handleClearFilters}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
              >
                VIEW ALL EXAMS
              </button>
            </div>
          </div>
        )}

        {/* CONTENT STATE: RECOMMENDED FOR YOU (When category is ALL & no search query) */}
        {!loading && !errorState && selectedCategory === 'ALL' && !debouncedSearch && recommendedExams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiAward style={{ color: '#2563eb' }} /> RECOMMENDED FOR YOU (Based on Profile Match)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {recommendedExams.map(ex => (
                <ExamCard key={ex.examId} exam={ex} />
              ))}
            </div>
          </div>
        )}

        {/* ALL EXAMINATIONS CARDS GRID */}
        {!loading && !errorState && exams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
              {selectedCategory === 'ALL' && !debouncedSearch ? 'ALL EXAMINATIONS' : `${selectedCategory} EXAMINATIONS`}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {exams.map(ex => (
                <ExamCard key={ex.examId} exam={ex} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: EXAM-SPECIFIC PREPARATION INTELLIGENCE ENVIRONMENT
  // ══════════════════════════════════════════════════════════════════════════
  const TABS = [
    "STUDY PLAN",
    "OVERVIEW",
    "ELIGIBILITY",
    "EXAM PATTERN",
    "SYLLABUS",
    "PRACTICE",
    "MOCK TESTS",
    "PROGRESS",
    "SOURCES"
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* Top Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 16, padding: '28px 32px', color: '#fff',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12 }}>
                {activeExam.category}
              </span>
              <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 700 }}>
                {activeExam.conductingOrganization}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: '4px 0 8px', color: '#fff' }}>
              {activeExam.name} ({activeExam.shortName})
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, maxWidth: 750 }}>
              {activeExam.purpose || activeExam.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {activeExam.applicationUrl && (
              <a
                href={activeExam.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#10b981', color: '#fff', textDecoration: 'none',
                  padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 13.5,
                  display: 'inline-flex', alignItems: 'center', gap: 8
                }}
              >
                APPLY NOW <FiExternalLink size={15} />
              </a>
            )}
            <button
              onClick={() => navigate('/graduate/applications')}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: 'pointer'
              }}
            >
              TRACK APPLICATION
            </button>
            <button
              onClick={() => navigate('/graduate/roadmap')}
              style={{
                background: 'transparent', color: '#94a3b8', border: 'none',
                padding: '10px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer'
              }}
            >
              Switch Exam
            </button>
          </div>
        </div>

        {/* Readiness Bar */}
        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Exam Readiness Score</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#38bdf8' }}>
              {progressData?.readinessScore || 0}% • <span style={{ fontSize: 16, color: '#fff' }}>{progressData?.readinessStatus || "Getting Started"}</span>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: '#cbd5e1', maxWidth: 450 }}>
            {progressData?.disclaimer || "Empirical compatibility estimate based on syllabus coverage and practice accuracy."}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 18px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: activeTab === tab ? 800 : 600,
              color: activeTab === tab ? '#2563eb' : '#64748b',
              borderBottom: activeTab === tab ? '3px solid #2563eb' : '3px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 1: PERSONALIZED STUDY PLAN ────────────────────────────────────── */}
      {activeTab === "STUDY PLAN" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Custom Settings Form */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiSliders style={{ color: '#2563eb' }} /> Customize Your Exam Preparation Intensity
            </h3>
            <form onSubmit={handleUpdateStudyPlan} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Available Daily Study Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  style={{ width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Current Subject Mastery Level
                </label>
                <select
                  value={studentLevel}
                  onChange={(e) => setStudentLevel(e.target.value)}
                  style={{ width: 160, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700 }}
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingPlan}
                style={{
                  marginTop: 18, background: '#2563eb', color: '#fff', border: 'none',
                  padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 13.5, cursor: 'pointer'
                }}
              >
                {savingPlan ? 'Recalculating...' : 'Recalculate Schedule'}
              </button>
            </form>
          </div>

          {/* Exam Phases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
              Exam Preparation Roadmap Phases ({activeExam.shortName})
            </h3>

            {studyPlan?.phases?.map(phase => (
              <div key={phase.phaseNumber} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: 12 }}>
                    {phase.weekRange}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                  {phase.title}
                </h4>
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
                  {phase.description}
                </p>
              </div>
            ))}
          </div>

          {/* 14-Day Daily Schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
              14-Day Daily Study Schedule ({hoursPerDay} Hours / Day)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {studyPlan?.dailySchedule?.map(day => (
                <div key={day.dayNumber} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{day.dayName}</span>
                    <span style={{ fontSize: 12, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 10 }}>{day.totalMinutes} Mins</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {day.tasks.map((tsk, tIdx) => (
                      <div key={tIdx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 13 }}>
                        <div style={{ fontWeight: 700, color: '#334155' }}>
                          <Link to={`/graduate/roadmap/${activeExam.examId}/topic/${tsk.topicId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                            {tsk.topicName}
                          </Link>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span>{tsk.taskType}</span>
                          <span>{tsk.durationMinutes} mins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: OVERVIEW ────────────────────────────────────────────────────── */}
      {activeTab === "OVERVIEW" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Examination Overview</h3>
          <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.6, margin: 0 }}>
            {activeExam.description}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 10 }}>
            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Conducting Body</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{activeExam.conductingOrganization}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Exam Date</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981', marginTop: 4 }}>{activeExam.importantDates?.examDate || 'Verified'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ELIGIBILITY ────────────────────────────────────────────────── */}
      {activeTab === "ELIGIBILITY" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Official Eligibility Criteria</h3>
          <div style={{ fontSize: 14, color: '#334155', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><strong>Qualification:</strong> {activeExam.eligibility?.qualificationRequirements || activeExam.minimumQualification}</div>
            <div><strong>Age Limit:</strong> {activeExam.eligibility?.ageRequirements}</div>
            <div><strong>Nationality:</strong> {activeExam.eligibility?.nationality}</div>
          </div>
        </div>
      )}

      {/* ── TAB 4: EXAM PATTERN ───────────────────────────────────────────────── */}
      {activeTab === "EXAM PATTERN" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeExam.stages?.map((st, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{st.stageName}</h4>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                Duration: {st.durationMinutes} Mins • Total Questions: {st.totalQuestions} • Total Marks: {st.totalMarks}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {st.sections?.map(sec => (
                  <div key={sec.sectionId} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#334155' }}>{sec.name}</span>
                    <span style={{ fontSize: 13, color: '#2563eb' }}>{sec.questionCount} Questions / {sec.marks} Marks</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 5: SYLLABUS ───────────────────────────────────────────────────── */}
      {activeTab === "SYLLABUS" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeExam.stages?.map(st => (
            st.sections?.map(sec => (
              <div key={sec.sectionId} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{sec.name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {sec.syllabusTopics?.map(top => (
                    <div key={top.topicId} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <Link to={`/graduate/roadmap/${activeExam.examId}/topic/${top.topicId}`} style={{ textDecoration: 'none', fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                        {top.name}
                      </Link>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Est. Time: {top.estimatedHours} hrs • Priority: <strong style={{ color: '#d97706' }}>{top.syllabusWeight > 85 ? 'CRITICAL' : 'HIGH'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ))}
        </div>
      )}

      {/* ── TAB 6: PRACTICE ───────────────────────────────────────────────────── */}
      {activeTab === "PRACTICE" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Exam-Specific Practice Question Drills</h3>
          <p style={{ color: '#64748b', fontSize: 13.5 }}>
            Practice questions generated strictly based on official syllabus topics and verified exam difficulty.
          </p>
        </div>
      )}

      {/* ── TAB 7: MOCK TESTS ─────────────────────────────────────────────────── */}
      {activeTab === "MOCK TESTS" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Sectional & Full Mock Test Simulator</h3>
          <form onSubmit={handleSubmitMock} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="number"
              value={mockScore}
              onChange={(e) => setMockScore(e.target.value)}
              placeholder="Your Score"
              style={{ width: 120, padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
            <button type="submit" disabled={submittingMock} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 800 }}>
              {submittingMock ? 'Submitting...' : 'Record Mock Score'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 8: PROGRESS ───────────────────────────────────────────────────── */}
      {activeTab === "PROGRESS" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Exam Readiness & Weak Area Analytics</h3>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#2563eb' }}>Readiness Score: {progressData?.readinessScore || 0}%</div>
        </div>
      )}

      {/* ── TAB 9: SOURCES ───────────────────────────────────────────────────── */}
      {activeTab === "SOURCES" && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Verified Official Sources</h3>
          {activeExam.sources?.map((src, i) => (
            <div key={i} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{src.title}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{src.sourceType} • {src.confidence} Confidence</div>
              </div>
              <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ background: '#2563eb', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 12.5, fontWeight: 800 }}>
                OPEN SOURCE <FiExternalLink size={13} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
