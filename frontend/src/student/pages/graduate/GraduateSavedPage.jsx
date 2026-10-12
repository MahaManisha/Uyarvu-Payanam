import React, { useEffect, useState } from 'react'
import { FiBookmark, FiTrash2, FiExternalLink } from 'react-icons/fi'
import { userActionService } from '../../../services/userActionService'

export default function GraduateSavedPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const res = await userActionService.getSavedList('GraduateExam')
      if (res.success) setItems(res.data || [])
    } catch {
      setError('Could not load saved opportunities.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (contentId) => {
    try {
      await userActionService.unsaveItem(contentId)
      setItems((prev) => prev.filter((i) => String(i.contentId?._id || i.contentId) !== String(contentId)))
    } catch {
      setError('Could not remove the item.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Saved Opportunities</h1>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No saved opportunities yet. Save exams from the Government Exams page to find them here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {items.map((item) => {
            const exam = item.contentId || {}
            const id = String(exam._id || item.contentId)
            return (
              <div key={item._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{exam.examName || 'Opportunity'}</h3>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  {exam.governmentType ? `${exam.governmentType}` : ''}{exam.state ? ` · ${exam.state}` : ''}
                </div>
                {exam.applicationEndDate && <div style={{ fontSize: 12, color: '#475569' }}>Apply by: {exam.applicationEndDate}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {exam.applicationUrl && (
                    <a href={exam.applicationUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
                      Official site <FiExternalLink size={12} />
                    </a>
                  )}
                  <button onClick={() => remove(id)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <FiTrash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
