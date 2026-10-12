import React, { useEffect, useState } from 'react'
import { FiBell, FiCalendar, FiExternalLink } from 'react-icons/fi'
import graduateService from '../../../services/graduateService'

export default function GraduateNotificationsPage() {
  const [data, setData] = useState({ alerts: [], announcements: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await graduateService.getNotifications()
        if (res.success) setData({ alerts: res.alerts || [], announcements: res.announcements || [] })
      } catch {
        setError('Could not load notifications.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Notifications</h1>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
      ) : (
        <>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#334155' }}>Deadline & exam reminders</h2>
            {data.alerts.length === 0 ? (
              <div style={empty}>No upcoming published deadlines or exam dates in the next 30 days.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.alerts.map((a, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${a.kind === 'deadline' ? '#f59e0b' : '#2563eb'}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{a.message}</div>
                    {a.actionUrl && (
                      <a href={a.actionUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
                        View official notice <FiExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#334155' }}>Announcements</h2>
            {data.announcements.length === 0 ? (
              <div style={empty}>No announcements right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.announcements.map((n) => (
                  <div key={n._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

const empty = { background: '#fff', border: '1px dashed #e2e8f0', borderRadius: 14, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }
