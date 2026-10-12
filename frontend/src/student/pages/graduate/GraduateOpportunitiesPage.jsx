import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import graduateService from '../../../services/graduateService'
import { SCard, SBtn, SLoader, SBadge, SInput } from '../../components/ui'
import { FiBriefcase, FiSearch, FiExternalLink, FiFilter, FiCheckCircle } from 'react-icons/fi'

const CATEGORY_TABS = [
  { label: 'ALL', value: 'ALL' },
  { label: 'GOVERNMENT JOBS', value: 'GOVERNMENT_EXAMS' },
  { label: 'PRIVATE JOBS', value: 'PRIVATE_JOBS' },
  { label: 'HIGHER STUDIES', value: 'HIGHER_STUDIES' },
  { label: 'PSU', value: 'PSU' },
  { label: 'RESEARCH', value: 'RESEARCH' },
  { label: 'ENTREPRENEURSHIP', value: 'ENTREPRENEURSHIP' }
]

export default function GraduateOpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'ALL'

  const [activeTab, setActiveTab] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOpportunities = async () => {
    setLoading(true)
    try {
      const res = await graduateService.getOpportunities(activeTab, searchQuery)
      if (res?.success) {
        setOpportunities(res.opportunities || [])
      } else {
        setError('Failed to load opportunities.')
      }
    } catch (err) {
      console.warn('Fetch opportunities error:', err)
      setError('Could not connect to opportunity engine API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOpportunities()
  }, [activeTab, searchQuery])

  const handleApplyNow = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('Official application URL unavailable or opening soon.')
    }
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="s-anim-up">

      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          <FiBriefcase size={14} /> GRADUATE OPPORTUNITY EXPLORER
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>
          Career & Post-Graduation Opportunities
        </h1>
        <p style={{ fontSize: 14, color: 'var(--s-text3)', margin: '4px 0 0' }}>
          Verified government notifications, higher education entrance routes, PSU recruitments & corporate roles.
        </p>
      </div>

      {/* SEARCH & CATEGORY TABS */}
      <SCard style={{ padding: 20, borderRadius: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <SInput
              placeholder="Search by opportunity name, organization, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              icon={<FiSearch />}
            />
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORY_TABS.map(tab => {
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value)
                  setSearchParams({ category: tab.value })
                }}
                style={{
                  padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                  whiteSpace: 'nowrap', border: 'none',
                  background: isActive ? '#2563eb' : '#f1f5f9',
                  color: isActive ? '#fff' : '#475569',
                  fontSize: 12.5, fontWeight: isActive ? 800 : 600,
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </SCard>

      {/* CONTENT GRID */}
      {loading ? (
        <div style={{ height: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <SLoader />
          <div style={{ fontSize: 13, color: 'var(--s-text3)', fontWeight: 600 }}>Filtering & verifying eligibility...</div>
        </div>
      ) : opportunities.length === 0 ? (
        <SCard style={{ padding: 40, textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 6px' }}>No opportunities found</h3>
          <p style={{ fontSize: 13, color: 'var(--s-text3)' }}>Try selecting a different category or adjusting your search term.</p>
        </SCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {opportunities.map((opp) => {
            const evalRes = opp.eligibilityEvaluation || {}
            const isEligible = evalRes.eligible !== false

            return (
              <SCard key={opp._id} style={{ padding: 24, borderRadius: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <SBadge color={isEligible ? 'green' : 'orange'}>
                      {isEligible ? '✓ Appears Eligible' : 'Check Requirements'}
                    </SBadge>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 10 }}>
                      {opp.matchScore || 90}% Match
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 4px' }}>
                    {opp.opportunityName}
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--s-text3)', fontWeight: 700, marginBottom: 12 }}>
                    🏛 {opp.organization}
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, margin: '0 0 14px' }}>
                    {opp.description?.substring(0, 130)}...
                  </p>

                  <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid var(--s-border)', marginBottom: 16 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 2 }}>
                      Stated Eligibility:
                    </div>
                    <div style={{ fontSize: 12, color: '#334155' }}>
                      {opp.eligibility || 'Graduate Degree'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--s-border)' }}>
                  <Link to={`/graduate/opportunities/${opp._id}`} style={{ flex: 1 }}>
                    <SBtn variant="secondary" style={{ width: '100%', padding: '8px 0', borderRadius: 10, fontSize: 12 }}>
                      View Details
                    </SBtn>
                  </Link>
                  <SBtn
                    variant="primary"
                    onClick={() => handleApplyNow(opp.applicationUrl)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    Apply Now <FiExternalLink size={12} />
                  </SBtn>
                </div>
              </SCard>
            )
          })}
        </div>
      )}

    </div>
  )
}
