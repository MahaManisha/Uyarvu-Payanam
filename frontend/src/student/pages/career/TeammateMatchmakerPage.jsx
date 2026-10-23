import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useCollegeProfile } from '../../context/CollegeProfileContext'
import { useCollegeTheme } from '../../context/CollegeThemeContext'
import { getCollegeFeatureEligibility } from '../../services/collegeFeatureEligibilityEngine'
import axiosInstance from '../../../config/axios'
import {
  FiUsers, FiPlus, FiSearch, FiFilter, FiCheck, FiClock,
  FiTarget, FiAward, FiMessageSquare, FiX, FiCheckCircle,
  FiAlertCircle, FiArrowRight, FiTrash2, FiUserCheck, FiCompass,
  FiCpu, FiZap, FiCalendar, FiSend
} from 'react-icons/fi'

const EVENT_CATEGORIES = [
  { key: 'all', label: 'All Projects' },
  { key: 'hackathon', label: '🏆 Hackathons (SIH)' },
  { key: 'mini_project', label: '⚡ Mini Projects' },
  { key: 'final_year_project', label: '🎓 Final Year Capstone' },
  { key: 'symposium', label: '🚀 Tech Symposiums' },
  { key: 'paper_presentation', label: '📄 Paper Presentations' },
  { key: 'ideathon', label: '💡 Ideathons' }
]

const DOMAIN_OPTIONS = [
  'All Domains',
  'AI / ML & Data Science',
  'IoT & Embedded Systems',
  'Web & Full Stack Development',
  'Robotics & Mechatronics',
  'Core Hardware & VLSI',
  'Cybersecurity & Cloud',
  'App Development (Flutter/React Native)',
  'Blockchain & Web3',
  'Open Innovation'
]

const COMMON_SKILL_SUGGESTIONS = [
  'React / Next.js',
  'Python / FastAPI',
  'YOLO / Computer Vision',
  'ESP32 / Embedded C',
  'ROS2 / Robotics',
  'Flutter / React Native',
  'UI/UX Design (Figma)',
  'Node.js / Express',
  'Machine Learning / PyTorch',
  'Verilog / FPGA',
  'Solidity / Web3',
  'PostgreSQL / MongoDB',
  'Docker & Cloud',
  'Hardware PCB Design (KiCAD)'
]

// Verified Real-World Competitions Default
const VERIFIED_COMPETITIONS_DEFAULT = [
  {
    id: 'sih-2026',
    name: 'Smart India Hackathon (SIH 2026)',
    shortName: 'SIH 2026',
    organizer: 'Ministry of Education (MoE) & AICTE, Govt of India',
    officialWebsite: 'https://www.sih.gov.in',
    badge: '🏆 Govt of India'
  },
  {
    id: 'tnsi-2026',
    name: 'Tamil Nadu Student Innovators (TNSI)',
    shortName: 'TNSI (EDII-TN)',
    organizer: 'EDII-TN, Government of Tamil Nadu',
    officialWebsite: 'https://editn.in',
    badge: '🏛️ Govt of Tamil Nadu'
  },
  {
    id: 'naan-mudhalvan-ideathon',
    name: 'Naan Mudhalvan AI Innovation Challenge',
    shortName: 'Naan Mudhalvan Challenge',
    organizer: 'Tamil Nadu Skill Development Corporation (TNSDC)',
    officialWebsite: 'https://naanmudhalvan.tn.gov.in',
    badge: '⚡ TNSDC Mission'
  },
  {
    id: 'kurukshetra-2026',
    name: 'Anna University CEG Kurukshetra',
    shortName: 'CEG Kurukshetra',
    organizer: 'College of Engineering, Guindy (Anna University)',
    officialWebsite: 'https://kurukshetra.org.in',
    badge: '🚀 Anna University'
  },
  {
    id: 'final-year-capstone',
    name: 'B.E. Final Year Capstone Project',
    shortName: 'Final Year Capstone',
    organizer: 'Anna University Curriculum',
    officialWebsite: 'https://www.annauniv.edu',
    badge: '🎓 Final Year'
  }
]

export default function TeammateMatchmakerPage() {
  const { student } = useStudentAuth()
  const { profile } = useCollegeProfile()
  const { theme, themeKey } = useCollegeTheme()
  const isGamified = themeKey === 'gamified'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const flags = getCollegeFeatureEligibility(profile)
  const myId = student?._id || student?.id

  // Tab: 'browse' | 'post' | 'my-teams'
  const initialTab = searchParams.get('action') === 'post' ? 'post' : (searchParams.get('tab') || 'browse')
  const [activeTab, setActiveTab] = useState(initialTab)

  // Listings & Filter States
  const [listings, setListings] = useState([])
  const [competitions, setCompetitions] = useState(VERIFIED_COMPETITIONS_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDomain, setSelectedDomain] = useState('All Domains')
  const [onlyOpen, setOnlyOpen] = useState(false)

  // My Teams State
  const [myTeamsData, setMyTeamsData] = useState({ createdTeams: [], joinedTeams: [], pendingRequests: [] })
  const [loadingMyTeams, setLoadingMyTeams] = useState(false)

  // Join Request Modal
  const [joinModalListing, setJoinModalListing] = useState(null)
  const [joinPitch, setJoinPitch] = useState('')
  const [submittingJoin, setSubmittingJoin] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  // Post Idea Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'hackathon',
    eventName: 'Smart India Hackathon (SIH 2026)',
    domain: 'AI / ML & Data Science',
    description: '',
    problemStatement: '',
    skillsLookingFor: [],
    customSkill: '',
    teamSizeMax: 4,
    deadline: ''
  })
  const [posting, setPosting] = useState(false)

  // Student Profile Skills normalized for matching
  const studentSkills = useMemo(() => {
    return (profile?.skills || []).map(s => s.toLowerCase().trim())
  }, [profile])

  // Fetch Listings
  const fetchListings = async () => {
    try {
      setLoading(true)
      const params = {}
      if (selectedCategory !== 'all') params.category = selectedCategory
      if (selectedDomain !== 'All Domains') params.domain = selectedDomain
      if (searchQuery.trim()) params.q = searchQuery.trim()
      if (onlyOpen) params.onlyOpen = 'true'

      const res = await axiosInstance.get('/teammate-matchmaker/listings', { params })
      if (res.data?.success) {
        setListings(res.data.listings || [])
      }
    } catch (err) {
      console.warn('Failed to load listings:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Real Competitions for Hackathon Bar
  const fetchCompetitions = async () => {
    try {
      const res = await axiosInstance.get('/teammate-matchmaker/competitions')
      if (res.data?.success) {
        setCompetitions(res.data.competitions || [])
      }
    } catch (err) {
      console.warn('Failed to load real competitions:', err.message)
    }
  }

  // Fetch My Teams
  const fetchMyTeams = async () => {
    try {
      setLoadingMyTeams(true)
      const res = await axiosInstance.get('/teammate-matchmaker/my-teams')
      if (res.data?.success) {
        setMyTeamsData({
          createdTeams: res.data.createdTeams || [],
          joinedTeams: res.data.joinedTeams || [],
          pendingRequests: res.data.pendingRequests || []
        })
      }
    } catch (err) {
      console.warn('Failed to load my teams:', err.message)
    } finally {
      setLoadingMyTeams(false)
    }
  }

  useEffect(() => {
    fetchListings()
    fetchCompetitions()
  }, [selectedCategory, selectedDomain, onlyOpen])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchListings()
    }, 400)
    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  useEffect(() => {
    const action = searchParams.get('action')
    const tab = searchParams.get('tab')
    if (action === 'post') setActiveTab('post')
    else if (tab) setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    if (activeTab === 'my-teams') {
      fetchMyTeams()
    }
  }, [activeTab])

  // 1-Click Request to Join
  const handleOpenJoinModal = (listing) => {
    setJoinModalListing(listing)
    setJoinPitch(`Hey! I would love to join your team for ${listing.eventName}. I can help with ${profile?.skills?.slice(0, 3).join(', ') || 'technical development'}.`)
  }

  const handleSendJoinRequest = async () => {
    if (!joinModalListing) return
    try {
      setSubmittingJoin(true)
      const res = await axiosInstance.post(`/teammate-matchmaker/listings/${joinModalListing._id}/join-request`, {
        message: joinPitch
      })
      if (res.data?.success) {
        setFeedbackMsg({ type: 'success', text: '🎉 Request sent successfully! The team creator has been notified.' })
        setJoinModalListing(null)
        fetchListings()
        setTimeout(() => setFeedbackMsg(null), 4000)
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit request.'
      })
    } finally {
      setSubmittingJoin(false)
    }
  }

  // Creator responds to request (Accept/Reject)
  const handleRespondRequest = async (listingId, requestId, action) => {
    try {
      const res = await axiosInstance.post(`/teammate-matchmaker/listings/${listingId}/respond-request`, {
        requestId,
        action
      })
      if (res.data?.success) {
        setFeedbackMsg({
          type: 'success',
          text: action === 'accepted' ? '✓ Teammate accepted into squad!' : '✕ Request declined.'
        })
        fetchMyTeams()
        fetchListings()
        setTimeout(() => setFeedbackMsg(null), 3000)
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update request.'
      })
    }
  }

  // Delete listing
  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this team idea?')) return
    try {
      const res = await axiosInstance.delete(`/teammate-matchmaker/listings/${listingId}`)
      if (res.data?.success) {
        setFeedbackMsg({ type: 'success', text: 'Listing removed.' })
        fetchMyTeams()
        fetchListings()
        setTimeout(() => setFeedbackMsg(null), 3000)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete listing.')
    }
  }

  // Post Form Handlers
  const handleAddSkillTag = (skillName) => {
    if (!skillName.trim()) return
    const clean = skillName.trim()
    if (!formData.skillsLookingFor.includes(clean)) {
      setFormData(prev => ({
        ...prev,
        skillsLookingFor: [...prev.skillsLookingFor, clean],
        customSkill: ''
      }))
    }
  }

  const handleRemoveSkillTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      skillsLookingFor: prev.skillsLookingFor.filter(s => s !== tag)
    }))
  }

  const handleCreateTeamSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in the project title and description.')
      return
    }

    try {
      setPosting(true)
      const res = await axiosInstance.post('/teammate-matchmaker/listings', formData)
      if (res.data?.success) {
        setFeedbackMsg({
          type: 'success',
          text: '🚀 Team idea posted! Students can now request to join your squad.'
        })
        setFormData({
          title: '',
          category: 'hackathon',
          eventName: 'Smart India Hackathon (SIH 2026)',
          domain: 'AI / ML & Data Science',
          description: '',
          problemStatement: '',
          skillsLookingFor: [],
          customSkill: '',
          teamSizeMax: 4,
          deadline: ''
        })
        setActiveTab('browse')
        fetchListings()
        setTimeout(() => setFeedbackMsg(null), 4000)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post team.')
    } finally {
      setPosting(false)
    }
  }

  // Check if a skill matches student's profile
  const isSkillMatched = (skillName) => {
    const sNorm = skillName.toLowerCase()
    return studentSkills.some(myS => sNorm.includes(myS) || myS.includes(sNorm))
  }

  // Open Chat with Creator or Team
  const handleOpenChat = (listing) => {
    if (listing.conversationId) {
      navigate('/college/peer-chat', {
        state: {
          conversationId: listing.conversationId,
          teamTitle: listing.title
        }
      })
    } else if (listing.creatorId && listing.creatorId.toString() !== myId?.toString()) {
      navigate('/college/peer-chat', {
        state: {
          peerId: listing.creatorId,
          peerName: listing.creatorName,
          teamTitle: listing.title
        }
      })
    } else {
      navigate('/college/peer-chat')
    }
  }

  return (
    <div className="s-anim-up" style={{ paddingBottom: 50, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── TOP HERO BANNER ── */}
      <div style={{
        background: isGamified
          ? 'linear-gradient(135deg, #0e1e38 0%, #1e1b4b 100%)'
          : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: '#fff',
        padding: '34px 38px',
        borderRadius: 24,
        boxShadow: isGamified ? '0 10px 30px rgba(99,102,241,0.2)' : '0 10px 30px rgba(79,70,229,0.25)',
        marginBottom: 26,
        position: 'relative',
        border: isGamified ? '1px solid rgba(129,140,248,0.3)' : 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 680 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12
            }}>
              <FiZap size={13} color="#fef08a" /> College Hackathon &amp; Project Squad Hub
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px', color: '#fff', fontFamily: theme.fontDisplay }}>
              🚀 Hackathon Teammate Finder
            </h1>
            <p style={{ fontSize: 14, color: '#e0e7ff', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
              Assemble complementary squads for <strong>Smart India Hackathon (SIH 2026)</strong>, Tamil Nadu State Innovation Challenges, College Symposiums, and Mini/Final-Year Projects. No more solo struggles—find your missing tech teammates.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div style={{
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 20,
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{listings.length}</div>
              <div style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 700 }}>Open Projects</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#a7f3d0' }}>
                {listings.reduce((acc, curr) => acc + (curr.slotsLeft || 0), 0)}
              </div>
              <div style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 700 }}>Open Slots</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fef08a' }}>
                {myTeamsData.createdTeams.length + myTeamsData.joinedTeams.length}
              </div>
              <div style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 700 }}>My Squads</div>
            </div>
          </div>
        </div>

        {/* Live Hackathon Highlights Banner with REAL VERIFIED COMPETITIONS */}
        <div style={{
          marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#fef08a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔥 Verified Competitions:
          </span>
          {competitions.map(comp => (
            <div
              key={comp.id}
              onClick={() => {
                setSearchQuery(comp.name)
                setSelectedCategory('hackathon')
              }}
              style={{
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)',
                padding: '5px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                border: '1px solid rgba(255,255,255,0.2)', transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              title={`Click to filter teams for ${comp.name}. Organizer: ${comp.organizer}`}
            >
              <span>{comp.badge}</span>
              <span>{comp.shortName || comp.name}</span>
              {comp.officialWebsite && (
                <a
                  href={comp.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 11, fontWeight: 900, paddingLeft: 2 }}
                  title={`Open official site: ${comp.officialWebsite}`}
                >
                  ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEEDBACK ALERT ── */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 18px', borderRadius: 14, marginBottom: 20,
          background: feedbackMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${feedbackMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          color: feedbackMsg.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10
        }}>
          {feedbackMsg.type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* ── NAVIGATION TABS ── */}
      <div style={{
        display: 'flex', gap: 12, borderBottom: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
        marginBottom: 24, paddingBottom: 8
      }}>
        <button
          onClick={() => setActiveTab('browse')}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'browse' ? (isGamified ? '#6366f1' : '#4f46e5') : 'transparent',
            color: activeTab === 'browse' ? '#fff' : (isGamified ? '#94a3b8' : '#64748b'),
            fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <FiSearch size={16} /> Explore Open Teams ({listings.length})
        </button>

        <button
          onClick={() => setActiveTab('post')}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'post' ? (isGamified ? '#6366f1' : '#4f46e5') : 'transparent',
            color: activeTab === 'post' ? '#fff' : (isGamified ? '#94a3b8' : '#64748b'),
            fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <FiPlus size={16} /> Post a Team Idea
        </button>

        <button
          onClick={() => setActiveTab('my-teams')}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'my-teams' ? (isGamified ? '#6366f1' : '#4f46e5') : 'transparent',
            color: activeTab === 'my-teams' ? '#fff' : (isGamified ? '#94a3b8' : '#64748b'),
            fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <FiUsers size={16} /> My Squads &amp; Requests
          {(myTeamsData.createdTeams.length > 0 || myTeamsData.joinedTeams.length > 0) && (
            <span style={{
              background: activeTab === 'my-teams' ? '#fff' : '#6366f1',
              color: activeTab === 'my-teams' ? '#4f46e5' : '#fff',
              fontSize: 10, fontWeight: 900, padding: '1px 6px', borderRadius: 8
            }}>
              {myTeamsData.createdTeams.length + myTeamsData.joinedTeams.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: BROWSE OPEN TEAMS
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'browse' && (
        <div>
          {/* SEARCH & FILTERS BAR */}
          <div style={{
            background: isGamified ? '#0f1f3d' : '#fff',
            borderRadius: 18, padding: '18px 22px', marginBottom: 24,
            border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`,
            display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{
                flex: 2, minWidth: 260, display: 'flex', alignItems: 'center', gap: 10,
                background: isGamified ? '#091326' : '#f8fafc',
                border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                borderRadius: 12, padding: '10px 14px'
              }}>
                <FiSearch size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search by project name, hackathon, tech skill (e.g. YOLO, React, ROS2)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    width: '100%', fontSize: 13, color: isGamified ? '#f8fafc' : '#0f172a', fontWeight: 600
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <FiX size={14} />
                  </button>
                )}
              </div>

              {/* Domain Dropdown */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <select
                  value={selectedDomain}
                  onChange={e => setSelectedDomain(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 12,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontWeight: 700, fontSize: 13, outline: 'none'
                  }}
                >
                  {DOMAIN_OPTIONS.map(d => (
                    <option key={d} value={d} style={{ background: isGamified ? '#0f1f3d' : '#fff' }}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Only Open Toggle */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: isGamified ? '#cbd5e1' : '#475569',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={onlyOpen}
                  onChange={e => setOnlyOpen(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }}
                />
                Only Open Slots
              </label>
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginRight: 4 }}>
                Category:
              </span>
              {EVENT_CATEGORIES.map(cat => {
                const active = selectedCategory === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      border: active ? 'none' : `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                      background: active ? '#4f46e5' : (isGamified ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                      color: active ? '#fff' : (isGamified ? '#cbd5e1' : '#64748b'),
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* LISTINGS GRID */}
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: 15, fontWeight: 700 }}>
              <div style={{ marginBottom: 12, fontSize: 28 }}>⚡</div>
              Scanning Engineering Projects &amp; Squads...
            </div>
          ) : listings.length === 0 ? (
            <div style={{
              background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 20,
              padding: '60px 20px', textAlign: 'center', border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🚀</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: '0 0 6px' }}>
                No Matching Teams Found
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 420, margin: '0 auto 20px' }}>
                Be the first to create a team for this hackathon or domain. Other engineering peers will be able to request to join!
              </p>
              <button
                onClick={() => setActiveTab('post')}
                style={{
                  padding: '10px 22px', borderRadius: 12, background: '#4f46e5', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer'
                }}
              >
                + Post Your Team Idea Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {listings.map(listing => {
                const currentMembers = listing.members || []
                const totalSlots = listing.teamSizeMax || 4
                const isFull = listing.slotsLeft === 0
                const isCreator = listing.isCreator
                const isMember = listing.isMember
                const hasRequested = listing.myRequestStatus === 'pending'
                const wasRejected = listing.myRequestStatus === 'rejected'

                return (
                  <div
                    key={listing._id}
                    style={{
                      background: isGamified ? '#0f1f3d' : '#fff',
                      borderRadius: 20,
                      padding: 24,
                      border: isGamified
                        ? '1px solid rgba(129,140,248,0.2)'
                        : '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    <div>
                      {/* Card Header: Event Badge & Slots */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: listing.category === 'hackathon' ? '#eef2ff' : '#fef3c7',
                            color: listing.category === 'hackathon' ? '#4338ca' : '#92400e',
                            fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 8,
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                          }}>
                            {listing.eventName || listing.category}
                          </span>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 4 }}>
                            {listing.domain}
                          </div>
                        </div>

                        {/* Slots indicator */}
                        <div style={{
                          textAlign: 'right', background: isFull ? '#fef2f2' : '#ecfdf5',
                          padding: '4px 10px', borderRadius: 8, border: `1px solid ${isFull ? '#fca5a5' : '#a7f3d0'}`
                        }}>
                          <div style={{
                            fontSize: 12, fontWeight: 900,
                            color: isFull ? '#dc2626' : '#059669'
                          }}>
                            {isFull ? 'Team Full' : `${listing.slotsLeft} slot${listing.slotsLeft > 1 ? 's' : ''} left`}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b' }}>
                            {currentMembers.length}/{totalSlots} filled
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: 16, fontWeight: 900, color: isGamified ? '#f8fafc' : '#0f172a',
                        margin: '0 0 10px', lineHeight: 1.4
                      }}>
                        {listing.title}
                      </h3>

                      {/* Description */}
                      <p style={{
                        fontSize: 13, color: isGamified ? '#94a3b8' : '#475569',
                        margin: '0 0 14px', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {listing.description}
                      </p>

                      {/* Skills Looking For */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>
                          Skills Needed:
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(listing.skillsLookingFor || []).map(skill => {
                            const matched = isSkillMatched(skill)
                            return (
                              <span
                                key={skill}
                                style={{
                                  fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 6,
                                  background: matched ? '#ecfdf5' : (isGamified ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                                  color: matched ? '#047857' : (isGamified ? '#cbd5e1' : '#334155'),
                                  border: matched ? '1px solid #6ee7b7' : '1px solid transparent',
                                  display: 'inline-flex', alignItems: 'center', gap: 4
                                }}
                                title={matched ? 'Matches a skill in your profile!' : ''}
                              >
                                {matched && '✓ '} {skill}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Team Roster Avatars Preview */}
                      <div style={{
                        padding: '10px 12px', borderRadius: 12,
                        background: isGamified ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        border: `1px solid ${isGamified ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                        marginBottom: 16
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                          Lead: <strong>{listing.creatorName}</strong> ({listing.creatorDepartment})
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {currentMembers.map((m, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: '#4f46e5', color: '#fff', fontSize: 11,
                                fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              title={`${m.name} (${m.role || 'Member'})`}
                            >
                              {m.name?.[0] || 'M'}
                            </div>
                          ))}
                          {Array.from({ length: listing.slotsLeft }).map((_, i) => (
                            <div
                              key={`empty-${i}`}
                              style={{
                                width: 26, height: 26, borderRadius: '50%',
                                border: '1.5px dashed #cbd5e1', color: '#94a3b8', fontSize: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              title="Open Slot"
                            >
                              +
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div style={{
                      display: 'flex', gap: 10, paddingTop: 14,
                      borderTop: `1px solid ${isGamified ? 'rgba(255,255,255,0.08)' : '#f1f5f9'}`
                    }}>
                      {isCreator ? (
                        <button
                          onClick={() => {
                            setActiveTab('my-teams')
                          }}
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 10,
                            background: '#047857', color: '#fff', border: 'none',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <FiUserCheck size={14} /> You Lead This Team →
                        </button>
                      ) : isMember ? (
                        <button
                          onClick={() => handleOpenChat(listing)}
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 10,
                            background: '#4f46e5', color: '#fff', border: 'none',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <FiMessageSquare size={14} /> Team Member (Open Chat)
                        </button>
                      ) : hasRequested ? (
                        <button
                          disabled
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 10,
                            background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                            fontWeight: 800, fontSize: 12, cursor: 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <FiClock size={14} /> Request Pending ⏳
                        </button>
                      ) : isFull ? (
                        <button
                          disabled
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 10,
                            background: '#f1f5f9', color: '#94a3b8', border: 'none',
                            fontWeight: 800, fontSize: 12, cursor: 'not-allowed'
                          }}
                        >
                          Team Full
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenJoinModal(listing)}
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: 10,
                            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                            color: '#fff', border: 'none', fontWeight: 800, fontSize: 13,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            boxShadow: '0 4px 12px rgba(79,70,229,0.25)'
                          }}
                        >
                          <FiPlus size={15} /> Request to Join
                        </button>
                      )}

                      {/* Chat with Lead Icon Button */}
                      {!isCreator && (
                        <button
                          onClick={() => handleOpenChat(listing)}
                          style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: isGamified ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                            color: isGamified ? '#cbd5e1' : '#475569',
                            border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title={`Chat with ${listing.creatorName}`}
                        >
                          <FiMessageSquare size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: POST A TEAM IDEA
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'post' && (
        <div style={{
          background: isGamified ? '#0f1f3d' : '#fff',
          borderRadius: 24, padding: 36,
          border: `1px solid ${isGamified ? 'rgba(0,245,212,0.15)' : '#e2e8f0'}`,
          maxWidth: 800, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: '0 0 6px' }}>
              💡 Form Your Engineering Project Squad
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              Pitch your hackathon problem statement or project idea and list the specific technical skills you need.
            </p>
          </div>

          <form onSubmit={handleCreateTeamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Project / Team Title *
              </label>
              <input
                type="text"
                placeholder="e.g. AI-Powered Smart Traffic Signal Control for SIH 2026"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12,
                  background: isGamified ? '#091326' : '#f8fafc',
                  border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                  color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 14, fontWeight: 600, outline: 'none'
                }}
              />
            </div>

            {/* Event Category & Hackathon Name Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  Project Type
                </label>
                <select
                  value={formData.category}
                  onChange={e => {
                    const cat = e.target.value
                    let defaultEvent = formData.eventName
                    if (cat === 'hackathon') defaultEvent = 'Smart India Hackathon (SIH 2026)'
                    else if (cat === 'final_year_project') defaultEvent = 'B.E. Final Year Capstone Project'
                    else if (cat === 'mini_project') defaultEvent = 'College Mini Project'
                    else if (cat === 'symposium') defaultEvent = 'Anna University CEG Kurukshetra'
                    else if (cat === 'ideathon') defaultEvent = 'Tamil Nadu Student Innovators (TNSI)'
                    setFormData({ ...formData, category: cat, eventName: defaultEvent })
                  }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 700, outline: 'none'
                  }}
                >
                  <option value="hackathon">Hackathon (e.g. SIH)</option>
                  <option value="mini_project">College Mini Project</option>
                  <option value="final_year_project">Final Year Capstone Project</option>
                  <option value="symposium">College Tech Symposium</option>
                  <option value="paper_presentation">Paper Presentation</option>
                  <option value="ideathon">Ideathon / Startup Pitch</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  Event / Competition Name
                </label>
                <input
                  type="text"
                  list="verified-competitions-datalist"
                  placeholder="Select verified or enter custom competition..."
                  value={formData.eventName}
                  onChange={e => setFormData({ ...formData, eventName: e.target.value })}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 14, fontWeight: 600, outline: 'none'
                  }}
                />
                <datalist id="verified-competitions-datalist">
                  {competitions.map(c => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.badge} {c.organizer}
                    </option>
                  ))}
                  <option value="College Mini Project" />
                  <option value="B.E. Final Year Capstone Project" />
                </datalist>
              </div>
            </div>

            {/* Domain & Team Size */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  Engineering Domain
                </label>
                <select
                  value={formData.domain}
                  onChange={e => setFormData({ ...formData, domain: e.target.value })}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 700, outline: 'none'
                  }}
                >
                  {DOMAIN_OPTIONS.filter(d => d !== 'All Domains').map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  Total Team Size (2 to 6 Members)
                </label>
                <select
                  value={formData.teamSizeMax}
                  onChange={e => setFormData({ ...formData, teamSizeMax: parseInt(e.target.value) })}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 700, outline: 'none'
                  }}
                >
                  <option value={2}>2 Members (Pair)</option>
                  <option value={3}>3 Members</option>
                  <option value={4}>4 Members (Standard Mini Project)</option>
                  <option value={5}>5 Members</option>
                  <option value={6}>6 Members (SIH Official Team Size)</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Project Overview &amp; What You're Building *
              </label>
              <textarea
                rows={4}
                placeholder="Explain the problem statement, hardware components, datasets, or web architecture your team will develop..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                required
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12,
                  background: isGamified ? '#091326' : '#f8fafc',
                  border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                  color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 600, outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            {/* Skills Needed Tag Input */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Technical Skills &amp; Roles You Are Looking For
              </label>

              {/* Tag Suggestions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {COMMON_SKILL_SUGGESTIONS.map(s => {
                  const isAdded = formData.skillsLookingFor.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => isAdded ? handleRemoveSkillTag(s) : handleAddSkillTag(s)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: isAdded ? 'none' : '1px dashed #cbd5e1',
                        background: isAdded ? '#4f46e5' : 'transparent',
                        color: isAdded ? '#fff' : (isGamified ? '#94a3b8' : '#475569'),
                        cursor: 'pointer'
                      }}
                    >
                      {isAdded ? '✓ ' : '+ '} {s}
                    </button>
                  )
                })}
              </div>

              {/* Custom skill adder */}
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Or type custom skill (e.g. ROS2 Navigation) and press Enter"
                  value={formData.customSkill}
                  onChange={e => setFormData({ ...formData, customSkill: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSkillTag(formData.customSkill)
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    background: isGamified ? '#091326' : '#f8fafc',
                    border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                    color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 600, outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddSkillTag(formData.customSkill)}
                  style={{
                    padding: '10px 16px', borderRadius: 10, background: '#475569',
                    color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>

              {/* Selected Tags Display */}
              {formData.skillsLookingFor.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {formData.skillsLookingFor.map(tag => (
                    <span
                      key={tag}
                      style={{
                        background: '#e0e7ff', color: '#4338ca', fontSize: 12, fontWeight: 800,
                        padding: '4px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      {tag}
                      <FiX size={13} style={{ cursor: 'pointer' }} onClick={() => handleRemoveSkillTag(tag)} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <button
                type="submit"
                disabled={posting}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79,70,229,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {posting ? 'Publishing Squad...' : '🚀 Post Team Idea & Open Join Requests'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                style={{
                  padding: '14px 20px', borderRadius: 12,
                  background: isGamified ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: isGamified ? '#cbd5e1' : '#475569', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 3: MY SQUADS & INCOMING REQUESTS
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'my-teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* SECTION 1: TEAMS I LEAD */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: 0 }}>
                  👑 Teams I Lead ({myTeamsData.createdTeams.length})
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                  Manage incoming join requests from classmates and launch your squad chat.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('post')}
                style={{
                  padding: '8px 16px', borderRadius: 10, background: '#4f46e5', color: '#fff',
                  border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                + New Team
              </button>
            </div>

            {loadingMyTeams ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>Loading squads...</div>
            ) : myTeamsData.createdTeams.length === 0 ? (
              <div style={{
                background: isGamified ? '#0f1f3d' : '#f8fafc', borderRadius: 16,
                padding: '30px 20px', textAlign: 'center', border: `1px solid ${isGamified ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>💡</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: isGamified ? '#fff' : '#0f172a' }}>You haven't posted any team ideas yet</div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 14px' }}>Post a project for SIH or mini projects to recruit peers!</p>
                <button
                  onClick={() => setActiveTab('post')}
                  style={{ padding: '8px 16px', borderRadius: 10, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Create Team Idea
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {myTeamsData.createdTeams.map(team => {
                  const pendingRequests = (team.joinRequests || []).filter(r => r.status === 'pending')
                  return (
                    <div
                      key={team._id}
                      style={{
                        background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 18, padding: 22,
                        border: `1px solid ${isGamified ? 'rgba(129,140,248,0.2)' : '#e2e8f0'}`,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 6 }}>
                              {team.eventName}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                              {team.domain}
                            </span>
                          </div>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: 0 }}>
                            {team.title}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleOpenChat(team)}
                            style={{
                              padding: '8px 14px', borderRadius: 10, background: '#4f46e5', color: '#fff',
                              border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <FiMessageSquare size={14} /> Open Team Chat
                          </button>
                          <button
                            onClick={() => handleDeleteListing(team._id)}
                            style={{
                              padding: '8px 12px', borderRadius: 10, background: '#fee2e2', color: '#dc2626',
                              border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer'
                            }}
                            title="Delete this listing"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Current Roster */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
                        Squad Members ({(team.members || []).length}/{team.teamSizeMax}):{' '}
                        {(team.members || []).map(m => m.name).join(', ')}
                      </div>

                      {/* Pending Join Requests Box */}
                      <div style={{
                        marginTop: 12, padding: '12px 14px', borderRadius: 12,
                        background: isGamified ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        border: `1px solid ${isGamified ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: isGamified ? '#cbd5e1' : '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FiUsers size={14} color="#6366f1" />
                          Pending Requests ({pendingRequests.length})
                        </div>

                        {pendingRequests.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            No pending requests right now. As engineering peers view your idea, their applications will show here.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {pendingRequests.map(req => (
                              <div
                                key={req._id}
                                style={{
                                  background: isGamified ? '#091326' : '#fff', padding: '10px 14px', borderRadius: 10,
                                  border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: isGamified ? '#fff' : '#0f172a' }}>
                                    {req.name} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>({req.department} • {req.year})</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: isGamified ? '#94a3b8' : '#475569', marginTop: 2 }}>
                                    "{req.message || 'Would love to join your team!'}"
                                  </div>
                                  {req.skills?.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                      {req.skills.slice(0, 4).map(s => (
                                        <span key={s} style={{ fontSize: 10, background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={() => handleRespondRequest(team._id, req._id, 'accepted')}
                                    style={{
                                      padding: '6px 14px', borderRadius: 8, background: '#059669', color: '#fff',
                                      border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                    }}
                                  >
                                    <FiCheck size={13} /> Accept into Team
                                  </button>
                                  <button
                                    onClick={() => handleRespondRequest(team._id, req._id, 'rejected')}
                                    style={{
                                      padding: '6px 12px', borderRadius: 8, background: '#f1f5f9', color: '#64748b',
                                      border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                                    }}
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: TEAMS I HAVE JOINED */}
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: '0 0 16px' }}>
              🤝 Squads I've Joined ({myTeamsData.joinedTeams.length})
            </h3>
            {myTeamsData.joinedTeams.length === 0 ? (
              <div style={{
                background: isGamified ? '#0f1f3d' : '#f8fafc', borderRadius: 16,
                padding: '24px 20px', textAlign: 'center', border: `1px solid ${isGamified ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                color: '#94a3b8', fontSize: 13
              }}>
                You haven't joined any other teams yet. Browse open projects to request an invite!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {myTeamsData.joinedTeams.map(team => (
                  <div
                    key={team._id}
                    style={{
                      background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 16, padding: 20,
                      border: `1px solid ${isGamified ? 'rgba(129,140,248,0.2)' : '#e2e8f0'}`
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: 6 }}>
                      Active Member
                    </span>
                    <h4 style={{ fontSize: 15, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', margin: '8px 0 4px' }}>
                      {team.title}
                    </h4>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                      Lead: {team.creatorName} • {team.eventName}
                    </div>
                    <button
                      onClick={() => handleOpenChat(team)}
                      style={{
                        width: '100%', padding: '9px', borderRadius: 10, background: '#4f46e5', color: '#fff',
                        border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <FiMessageSquare size={14} /> Open Team Chat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 1-CLICK REQUEST TO JOIN MODAL ── */}
      {joinModalListing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: isGamified ? '#0f1f3d' : '#fff', borderRadius: 20, maxWidth: 540, width: '100%',
            padding: 28, border: `1px solid ${isGamified ? 'rgba(0,245,212,0.2)' : '#e2e8f0'}`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: isGamified ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiZap color="#6366f1" size={18} /> Request to Join Team
              </div>
              <button
                onClick={() => setJoinModalListing(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <FiX size={18} />
              </button>
            </div>

            <div style={{
              background: isGamified ? '#091326' : '#f8fafc', padding: 14, borderRadius: 12,
              marginBottom: 16, border: `1px solid ${isGamified ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
                {joinModalListing.eventName}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isGamified ? '#fff' : '#0f172a', marginTop: 2 }}>
                {joinModalListing.title}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Lead: {joinModalListing.creatorName} ({joinModalListing.creatorDepartment})
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Your Introduction &amp; Skills Pitch
              </label>
              <textarea
                rows={3}
                value={joinPitch}
                onChange={e => setJoinPitch(e.target.value)}
                placeholder="Briefly state your relevant skills and what part of the project you would like to handle..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: isGamified ? '#091326' : '#fff',
                  border: `1px solid ${isGamified ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                  color: isGamified ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 600, outline: 'none', resize: 'vertical'
                }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Your department ({profile?.domain || 'Engineering'}) and skills ({profile?.skills?.slice(0, 3).join(', ') || 'General'}) will be sent with your request.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSendJoinRequest}
                disabled={submittingJoin}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, background: '#4f46e5', color: '#fff',
                  border: 'none', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                {submittingJoin ? 'Sending Request...' : 'Send 1-Click Request 🚀'}
              </button>
              <button
                onClick={() => setJoinModalListing(null)}
                style={{
                  padding: '12px 18px', borderRadius: 10, background: isGamified ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: isGamified ? '#cbd5e1' : '#475569', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
