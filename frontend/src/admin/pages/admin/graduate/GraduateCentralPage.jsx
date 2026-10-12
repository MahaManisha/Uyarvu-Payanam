import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SCard, SLoader, SEmpty, SBadge, SBtn, SAlert, DataTable, TR, TD, ActionBtn,
  FiltersRow, SearchInput, FilterSelect,
} from '../../../components/UI'
import { graduateExamService } from '../../../../services/graduateExamService'
import GraduateOrgModal from './GraduateOrgModal'
import GraduateCentralExamDetails from './GraduateCentralExamDetails'

const STATUS_OPTIONS = [
  'TBA',
  'Upcoming',
  'Application Open',
  'Application Closed',
  'Exam Scheduled',
  'Result Released',
  'Archived',
]

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

const QUALIFICATION_FALLBACK = 'Check latest official notification'

/** Date-only values ("2026-06-01") are parsed as local dates; full ISO
 *  timestamps (updatedAt/sourceLastChecked) parse as-is. */
const fmtDate = (iso) => {
  if (!iso) return ''
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

const fmtDateTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** "21 Oct 2026 → 27 Nov 2026", "27 Nov 2026", or "" when neither exists. */
const dateRange = (start, end) => [fmtDate(start), fmtDate(end)].filter(Boolean).join(' → ')

/**
 * GraduateCentralPage — Central Government tab. Two areas:
 *
 *  1. Synced Central exams — a searchable/filterable table of every Central
 *     examination record (the Central sync from the EasyShiksha source lands
 *     here), with a Sync button, status/category/body filters and a grouped
 *     View Details modal.
 *  2. Organizations (UPSC, SSC, IBPS/SBI, Railways, other central bodies),
 *     each linking to its own exam table.
 */
export default function GraduateCentralPage() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orgModal, setOrgModal] = useState(false)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [body, setBody] = useState('All')
  const [status, setStatus] = useState('All')

  const [viewing, setViewing] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [toasts, setToasts] = useState([])

  const toast = (type, msg) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [orgRes, examRes] = await Promise.all([
        graduateExamService.getOrganizations({ governmentType: 'Central', includeInactive: 1 }),
        graduateExamService.getExams({ governmentType: 'Central', includeInactive: 1 }),
      ])
      setOrgs(orgRes.data || [])
      setExams(examRes.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load Central Government data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  /* ── Sync (admin-only endpoint; summary comes back from the source run) ── */
  const handleSync = async () => {
    setSyncing(true)
    try {
      const summary = await graduateExamService.syncCentralExams()
      toast(
        'success',
        `Sync complete — ${summary.totalFound} found: ${summary.created} new, ${summary.updated} updated, ` +
          `${summary.unchanged} unchanged, ${summary.failed} failed.`
      )
      await fetchData()
    } catch (err) {
      toast('error', err?.response?.data?.message || 'Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const categories = useMemo(() => [...new Set(exams.map((e) => e.category).filter(Boolean))].sort(), [exams])
  const bodies = useMemo(
    () =>
      [...new Set(exams.map((e) => (typeof e.organization === 'object' && e.organization ? e.organization.name : '').trim()).filter(Boolean))]
        .sort(),
    [exams]
  )
  const lastSynced = useMemo(() => {
    const stamps = exams.map((e) => e.sourceLastChecked).filter(Boolean).sort()
    return stamps.length ? stamps[stamps.length - 1] : ''
  }, [exams])

  const filtered = exams.filter((e) => {
    if (category !== 'All' && e.category !== category) return false
    if (body !== 'All' && (typeof e.organization === 'object' && e.organization ? e.organization.name : '') !== body) return false
    if (status !== 'All') {
      if (status === 'Archived') {
        if (e.isActive && e.status !== 'Archived') return false
      } else if (status === 'Date Not Available') {
        if (e.status && e.status !== 'Date Not Available') return false
      } else if (e.status !== status) {
        return false
      }
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase()
      const haystack = [e.examName, e.shortName, e.category, e.conductingBody, e.qualification, e.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })

  return (
    <div>
      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map((t) => (
          <SAlert key={t.id} type={t.type} style={{ minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            {t.msg}
          </SAlert>
        ))}
      </div>

      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)' }}>
        <Link to="/admin/graduate-exams" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Graduate Exams</Link>
        {' '}→ Central Government
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '12px 0 6px', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'Nunito', fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
          Central Government
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SBtn onClick={handleSync} disabled={syncing || loading}>
            {syncing ? 'Syncing…' : '⟳ Sync from EasyShiksha'}
          </SBtn>
          <SBtn variant="outline" onClick={() => setOrgModal(true)}>＋ Add Organization</SBtn>
        </div>
      </div>
      <p style={{ margin: '0 0 18px', color: 'var(--text3)', fontSize: 14, fontWeight: 600 }}>
        Union-level recruitment organizations — open one to manage its examinations. Sync pulls Central-only exams
        from the EasyShiksha source; it never touches State records.
      </p>

      {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}
      {loading && <SLoader />}

      {!loading && !error && (
        <>
          {/* ── Synced Central exams ─────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'Nunito', fontSize: 17, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
              Central Examinations
            </h3>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text3)' }}>
              {lastSynced ? `Last synced: ${fmtDateTime(lastSynced)}` : 'Not synced yet'}
            </span>
          </div>

          <FiltersRow>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by exam, body, category or eligibility…" />
            <FilterSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>
            <FilterSelect value={body} onChange={(e) => setBody(e.target.value)}>
              <option value="All">All Conducting Bodies</option>
              {bodies.map((b) => <option key={b} value={b}>{b}</option>)}
            </FilterSelect>
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </FilterSelect>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginLeft: 'auto' }}>
              {filtered.length} of {exams.length} exam{exams.length === 1 ? '' : 's'}
            </span>
          </FiltersRow>

          {exams.length === 0 ? (
            <SEmpty
              icon="🏛️"
              title="No Central examinations yet"
              desc="Click “⟳ Sync from EasyShiksha” to discover Central Government exams from the source, or open an organization to add one manually."
            />
          ) : filtered.length === 0 ? (
            <SEmpty icon="🔍" title="No matches" desc="No examinations match the current search or filter." />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: '8px 12px', overflowX: 'auto', marginBottom: 28 }}>
              <DataTable
                columns={['Exam Name', 'Conducting Body', 'Category', 'Application Date', 'Exam Date', 'Eligibility', 'Status', 'Last Updated', 'Actions']}
                data={filtered}
                renderRow={(exam) => (
                  <TR key={exam._id} style={!exam.isActive ? { opacity: 0.55 } : undefined}>
                    <TD>
                      <div style={{ fontWeight: 800, color: 'var(--text)' }}>{exam.examName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                        {[exam.shortName, exam.sourceWebsite].filter(Boolean).join(' · ')}
                      </div>
                    </TD>
                    <TD style={{ maxWidth: 200 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                        {exam.conductingBody ||
                          (typeof exam.organization === 'object' && exam.organization ? exam.organization.name : '') ||
                          '—'}
                      </span>
                    </TD>
                    <TD>{exam.category ? <SBadge color="blue">{exam.category}</SBadge> : '—'}</TD>
                    <TD style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {dateRange(exam.applicationStartDate, exam.applicationEndDate) || '—'}
                    </TD>
                    <TD style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {fmtDate(exam.examDate) || '—'}
                    </TD>
                    <TD style={{ maxWidth: 240 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                        {(() => {
                          const text = exam.qualification || (exam.additionalEligibility || '').split(/[.!?]/)[0] || QUALIFICATION_FALLBACK
                          return text.length > 96 ? `${text.slice(0, 96)}…` : text
                        })()}
                      </span>
                    </TD>
                    <TD>
                      <SBadge color={STATUS_COLOR[exam.status] || 'gray'}>{exam.status || 'Date Not Available'}</SBadge>
                      {!exam.isActive && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: '#64748b' }}>ARCHIVED</div>}
                    </TD>
                    <TD style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(exam.updatedAt) || '—'}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <ActionBtn onClick={() => setViewing(exam)}>View Details</ActionBtn>
                        <ActionBtn style={{ color: 'var(--primary)' }} onClick={() => navigate(`/admin/graduate-exams/exam/${exam._id}`)}>Edit</ActionBtn>
                      </div>
                    </TD>
                  </TR>
                )}
              />
            </div>
          )}

          {/* ── Organizations ────────────────────────────────────────────── */}
          <h3 style={{ fontFamily: 'Nunito', fontSize: 17, fontWeight: 900, color: 'var(--text)', margin: '0 0 10px' }}>
            Organizations
          </h3>
          {orgs.length === 0 ? (
            <SEmpty icon="🏢" title="No central organizations yet" desc="Add a Central organization (e.g. UPSC) and it will appear here." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {orgs.map((org) => (
                <SCard key={org._id} hover style={{ cursor: 'pointer' }} >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 26 }}>🏢</span>
                    <SBadge color={org.isActive ? 'green' : 'gray'}>{org.isActive ? 'Active' : 'Archived'}</SBadge>
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontFamily: 'Nunito', fontSize: 18, fontWeight: 900, color: 'var(--text)', lineHeight: 1.3 }}>
                    {org.name}
                  </h3>
                  {org.description && (
                    <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text2)' }}>{org.description}</p>
                  )}
                  {org.officialWebsite && (
                    <p style={{ margin: '0 0 16px', fontSize: 13 }}>
                      <a href={org.officialWebsite} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        Official website ↗
                      </a>
                    </p>
                  )}
                  <button
                    onClick={() => navigate(`/admin/graduate-exams/organization/${org._id}`)}
                    style={{
                      background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10,
                      padding: '10px 0', width: '100%', fontFamily: 'Outfit', fontWeight: 800, fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Manage Examinations →
                  </button>
                </SCard>
              ))}
            </div>
          )}

          <p style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>
            Synced records are owned by the EasyShiksha source: dates, status and extracted details are refreshed on
            every sync run; organization grouping, archive state and manual edits stay under your control.
          </p>
        </>
      )}

      {/* View Details modal */}
      {viewing && (
        <GraduateCentralExamDetails
          exam={viewing}
          onClose={() => setViewing(null)}
          onEdit={(exam) => {
            const id = exam._id
            setViewing(null)
            navigate(`/admin/graduate-exams/exam/${id}`)
          }}
        />
      )}

      {orgModal && (
        <GraduateOrgModal
          open
          onClose={() => setOrgModal(false)}
          onSaved={() => { fetchData() }}
          org={{ governmentType: 'Central', state: '' }}
        />
      )}
    </div>
  )
}
