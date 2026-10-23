// frontend/src/student/pages/memories/MyMemoriesPage.jsx
//
// Personal Memory Vault — add (voice / journal / email / document / story),
// search & filter, view, edit, delete and retry-processing UI plus the
// privacy toggle for using memories in the AI chat. Processing happens on the
// backend; this page polls while a memory is pending/processing and shows
// clear Ready / Processing / Failed states.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  FiPlus, FiSearch, FiMic, FiBook, FiMail, FiFileText, FiEdit3,
  FiEye, FiTrash2, FiRefreshCw, FiX, FiClock, FiAlertTriangle,
  FiLink, FiArchive, FiHeart, FiSquare, FiCheck,
} from 'react-icons/fi'
import { SCard, SBtn, SBadge, SLoader } from '../../components/ui'
import { memoryApi, MEMORY_TYPES, memoryTypeLabel } from '../../services/memoryApi'

import { API_BASE_URL, SOCKET_BASE_URL } from '../../../config/apiConfig'

const API_BASE = API_BASE_URL
const API_ORIGIN = SOCKET_BASE_URL

const TYPE_ICONS = { voice: <FiMic size={15} />, journal: <FiBook size={15} />, email: <FiMail size={15} />, document: <FiFileText size={15} />, story: <FiEdit3 size={15} /> }
const STATUS_STYLE = {
  ready: { color: 'green', label: 'Ready' },
  processing: { color: 'blue', label: 'Processing' },
  pending: { color: 'gray', label: 'Queued' },
  failed: { color: 'red', label: 'Failed' },
}

function assetUrl(fileUrl) {
  return fileUrl ? API_ORIGIN + fileUrl : ''
}

const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const contentPreview = (m, max = 150) => {
  const text = m.summary || m.content || m.voiceNote || m.audioTranscript || ''
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

// ── Small voice recorder (MediaRecorder) — no fake UI, real capture ────────
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [err, setErr] = useState('')
  const recRef = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)

  const stopTracks = () => {
    if (recRef.current?.stream) recRef.current.stream.getTracks().forEach((t) => t.stop())
  }
  const clear = () => {
    if (url) URL.revokeObjectURL(url)
    setBlob(null); setUrl(''); setSeconds(0)
  }

  const start = async () => {
    clear()
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      rec.stream = stream
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data) }
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        setBlob(b)
        setUrl(URL.createObjectURL(b))
        stopTracks()
        clearInterval(timer.current)
        setRecording(false)
      }
      recRef.current = rec
      rec.start()
      setRecording(true)
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch (e) {
      setErr('Microphone unavailable on this device — you can still attach an audio file or type a note.')
    }
  }

  const stop = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }

  useEffect(() => () => { clearInterval(timer.current); stopTracks() }, [])
  return { recording, blob, url, seconds, err, start, stop, clear, setErr }
}

export default function MyMemoriesPage() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  // ── state ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [byType, setByType] = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchUsed, setSearchUsed] = useState(false)
  const [useMemoryInChat, setUseMemoryInChat] = useState(true)

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [draft, setDraft] = useState({ type: 'voice', title: '', content: '', voiceNote: '', eventDate: '' })
  const [draftFile, setDraftFile] = useState(null)
  const [draftFileName, setDraftFileName] = useState('')
  const recorder = useVoiceRecorder()

  const viewing = items.find((m) => m.id === viewingId) || null

  // ── data loading ──────────────────────────────────────────────────────
  const load = useCallback(async (opts = {}) => {
    try {
      setLoading(true)
      setError('')
      const params = { limit: 50 }
      if ((opts.q ?? q).trim()) params.q = (opts.q ?? q).trim()
      if (typeFilter !== 'all') params.type = typeFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const res = await memoryApi.list(params)
      const data = res.data || {}
      setItems(data.items || [])
      setByType(data.byType || {})
      setPendingCount(data.statuses?.pending || 0)
      setFailedCount(data.statuses?.failed || 0)
      setSearchUsed(!!data.searchUsed)
    } catch (e) {
      setError('Could not load your memories. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [q, typeFilter, statusFilter])

  // De-bounce the search box; filter changes load immediately
  useEffect(() => {
    const t = setTimeout(() => load(), q.trim() ? 450 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, typeFilter, statusFilter])

  // Poll while any memory is still processing
  useEffect(() => {
    if (!items.some((m) => m.status === 'pending' || m.status === 'processing')) return
    const t = setInterval(() => load(), 4000)
    return () => clearInterval(t)
  }, [items, load])

  // Settings
  useEffect(() => {
    memoryApi.getSettings().then((res) => setUseMemoryInChat(!!res.data?.useMemoryInChat)).catch(() => {})
  }, [])

  // Auto-open a memory via ?open=<id> (from AI chat source footnotes)
  useEffect(() => {
    const id = searchParams.get('open')
    if (id) {
      const found = items.find((m) => m.id === id)
      if (found) setViewingId(id)
      else memoryApi.get(id).then((res) => {
        if (res.data?.memory) {
          setItems((prev) => (prev.some((m) => m.id === id) ? prev : [res.data.memory, ...prev]))
          setViewingId(id)
        }
      }).catch(() => {})
    }
  }, [searchParams, items])

  // ── helpers ────────────────────────────────────────────────────────────
  const resetComposer = () => {
    setDraft({ type: 'voice', title: '', content: '', voiceNote: '', eventDate: '' })
    setDraftFile(null)
    setDraftFileName('')
    recorder.clear()
    setFormError('')
  }

  const openCreate = () => { resetComposer(); setEditingId(null); setComposerOpen(true) }

  const openEdit = (m) => {
    resetComposer()
    setDraft({
      type: m.type, title: m.title || '', content: m.content || '', voiceNote: m.voiceNote || '', eventDate: m.eventDate ? m.eventDate.slice(0, 10) : '',
    })
    setEditingId(m.id)
    setComposerOpen(true)
  }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('type', draft.type)
    if (draft.title.trim()) fd.append('title', draft.title.trim())
    if (draft.eventDate.trim()) fd.append('eventDate', draft.eventDate)
    if (draft.type === 'voice') {
      if (draft.voiceNote.trim()) fd.append('voiceNote', draft.voiceNote.trim())
      if (recorder.blob) {
        const name = `recording-${Date.now()}.webm`
        fd.append('file', new File([recorder.blob], name, { type: recorder.blob.type || 'audio/webm' }))
      } else if (draftFile) {
        fd.append('file', draftFile)
      }
    } else if (draft.type === 'document') {
      if (draftFile) fd.append('file', draftFile)
    } else {
      if (draft.content.trim()) fd.append('content', draft.content.trim())
    }
    return fd
  }

  const validateDraft = () => {
    if (draft.type === 'voice') {
      if (!recorder.blob && !draftFile && !draft.voiceNote.trim()) return 'Add a recording, an audio file, or type a short note.'
    } else if (draft.type === 'document') {
      if (!draftFile) return 'Attach a document (.txt, .md or .pdf) to save.'
    } else {
      if (!draft.content.trim()) return 'Write something to save as a memory.'
      if (draft.content.trim().length < 3) return 'Your memory is a little too short.'
    }
    return ''
  }

  const handleSave = async () => {
    const v = validateDraft()
    if (v) { setFormError(v); return }
    setSaving(true)
    setFormError('')
    try {
      const fd = buildFormData()
      if (editingId) {
        await memoryApi.update(editingId, fd)
      } else {
        await memoryApi.create(fd)
      }
      setComposerOpen(false)
      resetComposer()
      await load()
    } catch (e) {
      setFormError(e.response?.data?.message || 'Could not save the memory. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await memoryApi.remove(deletingId)
      setDeletingId(null)
      if (viewingId === deletingId) setViewingId(null)
      await load()
    } catch (e) {
      setError('Could not delete the memory.')
    }
  }

  const handleReprocess = async (id) => {
    try {
      await memoryApi.reprocess(id)
      await load()
    } catch (e) {
      /* surface via next load */
    }
  }

  const toggleMemoriesInChat = async (val) => {
    setUseMemoryInChat(val)
    try { await memoryApi.putSettings(val) }
    catch (e) { setError('Could not update setting right now.') }
  }

  const typeCount = (t) => (byType[t] != null ? byType[t] : 0)
  const totalCount = MEMORY_TYPES.reduce((s, t) => s + (byType[t.id] || 0), 0)

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', color: '#6d28d9', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
              <FiArchive size={13} /> Personal Memory Vault
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--s-text)', margin: 0 }}>My Memories</h1>
          <p style={{ fontSize: 13.5, color: 'var(--s-text3)', margin: '4px 0 0', maxWidth: 620 }}>
            Your private diary of life — voice notes, journal entries, emails, documents and stories.
            The AI assistant can gently reference these when you ask about your past.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <SBtn variant="primary" icon={<FiPlus size={15} />} onClick={openCreate}>New Memory</SBtn>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--s-text2)', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={useMemoryInChat}
              onChange={(e) => toggleMemoriesInChat(e.target.checked)}
              style={{ accentColor: 'var(--s-primary)', width: 15, height: 15 }}
            />
            <FiHeart size={13} /> Let the AI use my memories when answering
          </label>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--s-error-l)', color: 'var(--s-error)', fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--s-text3)' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your memories — try describing an event in your own words…"
            style={{ width: '100%', padding: '11px 40px', borderRadius: 12, border: '1px solid var(--s-border)', fontSize: 13.5, outline: 'none', background: '#fff' }}
          />
          {searchUsed && q.trim() && (
            <span style={{ position: 'absolute', right: 12, top: 12, fontSize: 11, fontWeight: 700, color: '#ca8a04' }}>relevance-sorted</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} label={`All (${totalCount})`} />
          {MEMORY_TYPES.map((t) => (
            <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(typeFilter === t.id ? 'all' : t.id)} label={`${t.label} (${typeCount(t.id)})`} />
          ))}
          <span style={{ width: 1, height: 22, background: 'var(--s-border)', margin: '0 4px' }} />
          <FilterChip active={statusFilter === 'processing'} onClick={() => setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')} label={`Processing (${pendingCount})`} />
          <FilterChip active={statusFilter === 'failed'} onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')} label={`Failed (${failedCount})`} tone="red" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--s-text3)', fontSize: 13.5, padding: '30px 0' }}>
          <SLoader /> Loading your memories…
        </div>
      ) : items.length === 0 ? (
        <SCard style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
          {q.trim() || typeFilter !== 'all' || statusFilter !== 'all' ? (
            <>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--s-text)' }}>No memories match these filters</h3>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '6px 0 14px' }}>Try different search words or clear a filter.</p>
              <SBtn variant="ghost" onClick={() => { setQ(''); setTypeFilter('all'); setStatusFilter('all') }}>Clear filters</SBtn>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--s-text)' }}>Your memory vault is empty</h3>
              <p style={{ fontSize: 13, color: 'var(--s-text3)', margin: '6px 0 14px' }}>Save your first voice note, journal entry, letter, document or story — the AI can then recall it for you later.</p>
              <SBtn variant="primary" icon={<FiPlus size={15} />} onClick={openCreate}>Add your first memory</SBtn>
            </>
          )}
        </SCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {items.map((m) => {
            const st = STATUS_STYLE[m.status] || STATUS_STYLE.ready
            return (
              <SCard key={m.id} hover style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: 'var(--s-text2)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 9, background: 'var(--s-primary-l)', color: 'var(--s-primary)' }}>
                      {TYPE_ICONS[m.type] || <FiArchive size={14} />}
                    </span>
                    {m.title || memoryTypeLabel(m.type)}
                  </span>
                  <SBadge color={st.color} dot={m.status !== 'ready'} style={{ fontSize: 11 }}>{st.label}</SBadge>
                </div>

                <div style={{ fontSize: 13, color: 'var(--s-text2)', lineHeight: 1.5, minHeight: 40 }}>{contentPreview(m)}</div>

                {m.topics && m.topics.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {m.topics.slice(0, 4).map((t) => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--s-text3)', fontWeight: 600 }}>
                  <FiClock size={11} /> {fmtDate(m.eventDate || m.createdAt)} · {memoryTypeLabel(m.type)}
                </div>

                {m.status === 'failed' && m.processingError && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--s-error)', background: 'var(--s-error-l)', padding: '7px 9px', borderRadius: 8 }}>
                    <FiAlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{m.processingError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--s-border)' }}>
                  <SBtn size="sm" variant="ghost" icon={<FiEye size={13} />} onClick={() => setViewingId(m.id)}>View</SBtn>
                  <SBtn size="sm" variant="ghost" icon={<FiEdit3 size={13} />} onClick={() => openEdit(m)}>Edit</SBtn>
                  {m.status === 'failed' && (
                    <SBtn size="sm" variant="ghost" icon={<FiRefreshCw size={13} />} onClick={() => handleReprocess(m.id)}>Retry</SBtn>
                  )}
                  <SBtn size="sm" variant="danger" icon={<FiTrash2 size={13} />} onClick={() => setDeletingId(m.id)}>Delete</SBtn>
                </div>
              </SCard>
            )
          })}
        </div>
      )}

      {/* ── Composer / Edit modal ─────────────────────────────────────────── */}
      {composerOpen && (
        <Modal onClose={() => { if (!saving) { setComposerOpen(false); resetComposer() } }} title={editingId ? 'Edit memory' : 'Add a memory'}>
          {/* Type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
            {MEMORY_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, type: t.id }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                  padding: '10px 8px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', border: draft.type === t.id ? '2px solid var(--s-primary)' : '1px solid var(--s-border)',
                  background: draft.type === t.id ? 'var(--s-primary-l)' : '#fff',
                  color: draft.type === t.id ? 'var(--s-primary)' : 'var(--s-text2)',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <Field label="Title (optional)">
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Give it a short name…" style={inputStyle} />
          </Field>

          {/* Type-specific inputs */}
          {draft.type === 'voice' && (
            <>
              <Field label="Voice recording / audio file">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <SBtn variant={recorder.recording ? 'danger' : 'primary'} size="sm" icon={recorder.recording ? <FiSquare size={12} /> : <FiMic size={13} />} onClick={recorder.recording ? recorder.stop : recorder.start}>
                    {recorder.recording ? `Stop (${recorder.seconds}s)` : 'Record'}
                  </SBtn>
                  <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>or</span>
                  <input type="file" accept="audio/*" onChange={(e) => { setDraftFile(e.target.files?.[0] || null); setDraftFileName(e.target.files?.[0]?.name || '') }} style={{ fontSize: 12, maxWidth: 260 }} />
                </div>
                {recorder.err && <div style={{ fontSize: 12, color: 'var(--s-error)', marginTop: 6 }}>{recorder.err}</div>}
                {recorder.url && <audio controls src={recorder.url} style={{ width: '100%', marginTop: 8 }} />}
                {draftFileName && !recorder.blob && <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 6 }}>Attached: {draftFileName}</div>}
              </Field>
              <Field label="Short note (optional, helps if transcription is unavailable)">
                <textarea value={draft.voiceNote} onChange={(e) => setDraft((d) => ({ ...d, voiceNote: e.target.value }))} rows={2} placeholder="What is this about?" style={inputStyle} />
              </Field>
            </>
          )}

          {draft.type === 'document' && (
            <Field label="Document (.txt, .md or .pdf)">
              <input type="file" accept=".txt,.md,.markdown,.pdf,.csv,.json,text/plain,application/pdf" onChange={(e) => { setDraftFile(e.target.files?.[0] || null); setDraftFileName(e.target.files?.[0]?.name || '') }} />
              {draftFileName && <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 6 }}>Attached: {draftFileName}</div>}
              <div style={{ fontSize: 11.5, color: 'var(--s-text3)', marginTop: 6 }}>The text will be extracted and indexed on the server — your original file stays intact.</div>
            </Field>
          )}

          {draft.type !== 'voice' && draft.type !== 'document' && (
            <Field label={draft.type === 'journal' ? 'Journal entry' : draft.type === 'email' ? 'Email / letter text' : 'Story / note'}>
              <textarea value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} rows={6} placeholder={draft.type === 'email' ? 'Paste the email or letter…' : 'Write freely — this is your private memory…'} style={inputStyle} />
            </Field>
          )}

          <Field label="Event date (optional)">
            <input type="date" value={draft.eventDate} onChange={(e) => setDraft((d) => ({ ...d, eventDate: e.target.value }))} style={inputStyle} />
          </Field>

          {formError && (
            <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--s-error-l)', color: 'var(--s-error)', fontSize: 12.5, fontWeight: 600 }}>{formError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <SBtn variant="ghost" onClick={() => { setComposerOpen(false); resetComposer() }} disabled={saving}>Cancel</SBtn>
            <SBtn variant="primary" onClick={handleSave} loading={saving} icon={<FiCheck size={14} />}>
              {editingId ? 'Save changes' : 'Save memory'}
            </SBtn>
          </div>
        </Modal>
      )}

      {/* ── View modal ──────────────────────────────────────────────────── */}
      {viewing && (
        <Modal onClose={() => setViewingId(null)} title={viewing.title || memoryTypeLabel(viewing.type)} wide>
          <MetaRow type={viewing.type} date={fmtDate(viewing.eventDate || viewing.createdAt)} status={viewing.status} />
          <div style={{ marginTop: 12 }}>
            {viewing.status === 'processing' || viewing.status === 'pending' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--s-text2)', padding: '12px 0' }}><SLoader /> Processing — the summary & topics will appear shortly.</div>
            ) : viewing.status === 'failed' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--s-error)', background: 'var(--s-error-l)', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
                <FiAlertTriangle size={15} /> {viewing.processingError || 'Processing failed.'}
                <SBtn size="sm" variant="ghost" icon={<FiRefreshCw size={12} />} onClick={() => { handleReprocess(viewing.id); setViewingId(null) }}>Retry</SBtn>
              </div>
            ) : null}

            {/* Audio / document attachment */}
            {viewing.fileUrl && (
              <AttachmentBlock memory={viewing} />
            )}

            {viewing.hasTranscript && viewing.audioTranscript && (
              <Section label="Transcript">
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--s-text2)', margin: 0 }}>{viewing.audioTranscript}</p>
              </Section>
            )}

            {(viewing.content || viewing.voiceNote) && (
              <Section label={viewing.type === 'document' ? 'Extracted text' : viewing.type === 'voice' ? 'Your note' : 'Original text'}>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--s-text2)', margin: 0, whiteSpace: 'pre-wrap' }}>{viewing.content || viewing.voiceNote}</p>
              </Section>
            )}

            {viewing.summary && (
              <Section label="Summary (AI-generated — your original text is untouched)">
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--s-text2)', margin: 0 }}>{viewing.summary}</p>
              </Section>
            )}

            {viewing.topics && viewing.topics.length > 0 && (
              <Section label="Topics">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {viewing.topics.map((t) => <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{t}</span>)}
                </div>
              </Section>
            )}

            {viewing.entities && viewing.entities.length > 0 && (
              <Section label="Mentioned people / places">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {viewing.entities.map((e) => <span key={e} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>{e}</span>)}
                </div>
              </Section>
            )}

            {!viewing.summary && viewing.status === 'ready' && (
              <p style={{ fontSize: 12.5, color: 'var(--s-text3)', marginTop: 10 }}>
                No AI summary was generated for this memory (the original text is always kept).
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18, borderTop: '1px solid var(--s-border)', paddingTop: 14 }}>
            <SBtn variant="ghost" icon={<FiEdit3 size={13} />} onClick={() => { setViewingId(null); openEdit(viewing) }}>Edit</SBtn>
            <SBtn variant="danger" icon={<FiTrash2 size={13} />} onClick={() => { setViewingId(null); setDeletingId(viewing.id) }}>Delete</SBtn>
            <SBtn variant="primary" onClick={() => setViewingId(null)}>Close</SBtn>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────── */}
      {deletingId && (
        <Modal onClose={() => setDeletingId(null)} title="Delete this memory?">
          <p style={{ fontSize: 13.5, color: 'var(--s-text2)', margin: '0 0 4px' }}>
            This permanently removes the memory and its attached file. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <SBtn variant="ghost" onClick={() => setDeletingId(null)}>Cancel</SBtn>
            <SBtn variant="danger" icon={<FiTrash2 size={13} />} onClick={handleDelete}>Delete memory</SBtn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── small presentational helpers ───────────────────────────────────────────

function FilterChip({ active, onClick, label, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        border: active ? '1.5px solid var(--s-primary)' : '1px solid var(--s-border)',
        background: active ? 'var(--s-primary-l)' : '#fff',
        color: active ? 'var(--s-primary)' : (tone === 'red' ? 'var(--s-error)' : 'var(--s-text2)'),
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--s-border)',
  fontSize: 13.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--s-text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      {children}
    </div>
  )
}

function Modal({ children, title, onClose, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 18, padding: 22, width: '100%',
          maxWidth: wide ? 720 : 540, maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--s-text)' }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--s-text3)', display: 'inline-flex' }} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--s-text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      {children}
    </div>
  )
}

function MetaRow({ type, date, status }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.ready
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <SBadge color="blue">{memoryTypeLabel(type)}</SBadge>
      <SBadge color="gray"><FiClock size={11} /> {date}</SBadge>
      <SBadge color={st.color}>{st.label}</SBadge>
    </div>
  )
}

function AttachmentBlock({ memory }) {
  const src = assetUrl(memory.fileUrl)
  const isAudio = (memory.mimeType || '').startsWith('audio/')
  return (
    <Section label={isAudio ? 'Recording' : 'Attached file'}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid var(--s-border)', borderRadius: 10, padding: 10 }}>
        {isAudio ? (
          <audio controls src={src} style={{ flex: '1 1 260px', minWidth: 200 }} />
        ) : (
          <a href={src} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--s-primary)' }}>
            <FiLink size={14} /> Open original file
          </a>
        )}
        {memory.fileName && <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>{memory.fileName}</span>}
      </div>
    </Section>
  )
}