import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import graduateService from '../../../services/graduateService'
import applicationService from '../../../services/applicationService'
import { SCard, SBtn, SLoader, SBadge, SSelect } from '../../components/ui'
import { FiCheckSquare, FiClock, FiExternalLink, FiBell, FiPlus, FiTrash2 } from 'react-icons/fi'

const STATUS_OPTIONS = [
  'NOT_STARTED',
  'PLANNING',
  'APPLIED',
  'EXAM_COMPLETED',
  'RESULT_WAITING',
  'SELECTED',
  'REJECTED'
]

const STATUSES = ['Interested', 'Planning to Apply', 'Applied', 'Exam / Interview Scheduled', 'Selected', 'Rejected']

export default function GraduateApplicationsPage() {
  const navigate = useNavigate()

  // Opportunity-linked applications (GraduateApplication model)
  const [applications, setApplications] = useState([])
  const [loadingOpp, setLoadingOpp] = useState(true)

  // Manual / private-job tracker (ApplicationTracker model)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', organization: '', location: '', status: 'Interested', notes: '' })

  const [error, setError] = useState('')
  const loading = loadingOpp || loadingItems

  const fetchApplications = async () => {
    setLoadingOpp(true)
    try {
      const res = await graduateService.getApplications()
      if (res?.success) {
        setApplications(res.applications || [])
      } else {
        setError('Failed to fetch applications.')
      }
    } catch (err) {
      console.warn('Fetch applications error:', err)
      setError('Could not connect to application tracker API.')
    } finally {
      setLoadingOpp(false)
    }
  }

  const load = async () => {
    try {
      setLoadingItems(true)
      const res = await applicationService.list(statusFilter || undefined)
      if (res.success) setItems(res.data || [])
    } catch {
      setError('Could not load your application tracker.')
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => { fetchApplications() }, [])
  useEffect(() => { load() }, [statusFilter])

  /* ── Opportunity application actions ── */
  const handleStatusChange = async (appId, newStatus) => {
    try {
      const app = applications.find(a => a._id === appId)
      if (!app) return

      await graduateService.saveApplication({
        opportunityId: app.opportunityId?._id || app.opportunityId,
        status: newStatus
      })

      setApplications(prev => prev.map(a => a._id === appId ? { ...a, status: newStatus } : a))
    } catch (err) {
      alert('Failed to update status.')
    }
  }

  const handleSetReminder = async (oppId) => {
    try {
      const res = await graduateService.setReminder(oppId)
      if (res?.success) {
        alert(res.message || 'Reminder notification set!')
        fetchApplications()
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set reminder.')
    }
  }

  const handleOpenOfficial = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert('Official application portal link unavailable.')
    }
  }

  /* ── Manual / private-job tracker actions ── */
  const update = async (id, patch) => {
    try {
      const res = await applicationService.update(id, patch)
      if (res.success) setItems((prev) => prev.map((i) => (i._id === id ? { ...i, ...res.data } : i)))
    } catch { setError('Update failed.') }
  }

  const remove = async (id) => {
    try {
      await applicationService.remove(id)
      setItems((prev) => prev.filter((i) => i._id !== id))
    } catch { setError('Delete failed.') }
  }

  const addPrivate = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required.')
    try {
      const res = await applicationService.create({ ...form, contentType: 'PrivateJob' })
      if (res.success) {
        setItems((prev) => [res.data, ...prev])
        setForm({ title: '', organization: '', location: '', status: 'Interested', notes: '' })
        setShowForm(false)
        setError('')
      }
    } catch { setError('Could not add the record.') }
  }

  if (loading) {
    return (
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <SLoader />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-text3)' }}>
          Loading your application tracker & deadline alerts...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="s-anim-up">

      {/* HEADER */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            <FiCheckSquare size={14} /> APPLICATION TRACKER
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'var(--s-text)', margin: 0, fontFamily: 'var(--s-font-display)' }}>
            My Applications Tracker
          </h1>
          <p style={{ fontSize: 14, color: 'var(--s-text3)', margin: '4px 0 0' }}>
            Track your progress across government exams, higher study entrances, PSUs, and private applications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/graduate/opportunities">
            <SBtn variant="primary" style={{ borderRadius: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiPlus size={15} /> Find Opportunities
            </SBtn>
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            <FiPlus size={14} /> Track a job manually
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 12, marginBottom: 16 }}>{error}</div>}

      {/* MANUAL / PRIVATE JOB FORM */}
      {showForm && (
        <form onSubmit={addPrivate} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, display: 'grid', gap: 10, marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Track a private job manually</h3>
          <input placeholder="Job title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={input} />
          <input placeholder="Company / organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} style={input} />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={input} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...input, minHeight: 70 }} />
          <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Save record</button>
        </form>
      )}

      {/* SECTION 1 — OPPORTUNITY APPLICATIONS */}
      <h2 style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 14px' }}>
        Opportunity Applications
      </h2>
      {applications.length === 0 ? (
        <SCard style={{ padding: 40, textAlign: 'center', borderRadius: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--s-text)', margin: '0 0 8px' }}>
            No Applications Added Yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--s-text3)', maxWidth: 460, margin: '0 auto 20px' }}>
            Browse government exams, higher education routes, or private jobs and click "Add to My Applications" to track deadlines and status.
          </p>
          <Link to="/graduate/opportunities">
            <SBtn variant="primary">Explore Opportunities</SBtn>
          </Link>
        </SCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {applications.map((app) => {
            const opp = app.opportunityId || {}
            const isApplied = app.status === 'APPLIED' || app.status === 'EXAM_COMPLETED' || app.status === 'SELECTED'

            return (
              <SCard key={app._id} style={{ padding: 22, borderRadius: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--s-text)' }}>
                      {app.opportunityName || opp.opportunityName}
                    </span>
                    <SBadge color={isApplied ? 'green' : 'orange'}>
                      {app.status}
                    </SBadge>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--s-text3)', fontWeight: 600 }}>
                    🏛 {app.organization || opp.organization} • <span style={{ textTransform: 'uppercase', color: '#2563eb' }}>{app.category}</span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 8 }}>
                    Application Deadline: <strong>{app.deadline ? new Date(app.deadline).toLocaleDateString('en-IN') : 'Upcoming'}</strong>
                  </div>
                </div>

                {/* STATUS DROPDOWN & REMINDER BUTTON */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ width: 160 }}>
                    <SSelect
                      value={app.status}
                      onChange={e => handleStatusChange(app._id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </SSelect>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetReminder(opp._id || app.opportunityId)}
                    style={{
                      padding: '10px 14px', borderRadius: 10,
                      border: app.reminderSet ? '1px solid #bbf7d0' : '1px solid var(--s-border)',
                      background: app.reminderSet ? '#f0fdf4' : '#fff',
                      color: app.reminderSet ? '#15803d' : 'var(--s-text2)',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <FiBell size={14} /> {app.reminderSet ? 'Reminder Set' : 'Remind Me'}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/graduate/resume-builder?targetRole=${encodeURIComponent(app.opportunityName || opp.opportunityName || '')}&targetCompany=${encodeURIComponent(app.organization || opp.organization || '')}&targetCategory=${encodeURIComponent(app.category || 'JOB')}`)}
                    style={{
                      padding: '10px 14px', borderRadius: 10, border: '1px solid #bfdbfe',
                      background: '#eff6ff', color: '#1d4ed8',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    📄 Attach Resume
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenOfficial(app.officialApplicationUrl || opp.applicationUrl)}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: 'none',
                      background: 'var(--s-primary)', color: '#fff',
                      fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    Apply Portal <FiExternalLink size={13} />
                  </button>
                </div>
              </SCard>
            )
          })}
        </div>
      )}

      {/* SECTION 2 — MANUAL / PRIVATE JOB TRACKER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>
          Manual & Private Job Tracker
        </h2>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, maxWidth: 260 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {items.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Nothing tracked manually yet. Add a private job or informal application above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => (
            <div key={item._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{item.title}</h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{[item.organization, item.location, item.contentType === 'PrivateJob' ? 'Private' : 'Government'].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={item.status} onChange={(e) => update(item._id, { status: e.target.value })} style={{ ...input, padding: '7px 10px', maxWidth: 220 }}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => remove(item._id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
              <textarea
                defaultValue={item.notes || ''}
                onBlur={(e) => { if (e.target.value !== (item.notes || '')) update(item._id, { notes: e.target.value }) }}
                placeholder="Add notes… (saved when you click away)"
                style={{ ...input, marginTop: 10, minHeight: 54 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const input = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }
