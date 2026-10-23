/**
 * NotificationBell.jsx — Admin Panel Component
 *
 * Shows the admin a quick-view of recently SENT notifications.
 * This is a "sent outbox" view, NOT an inbox.
 *
 * Key points:
 *   • The bell counts TODAY's sent notifications (not unread count)
 *   • Admin emits "join_admin" so they join the "admins" socket room
 *   • Admin never joins "students" or "user_<id>" rooms
 *   • No unread badge for admin (admin is the sender, not recipient)
 *   • Shows last 15 sent notifications with type/level badges and time
 *   • Clicking each item opens a quick view; admin can delete from here
 */

import React, { useState, useRef, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useNotifications } from '../context/NotificationContext'
import styles from './NotificationBell.module.css'

const SOCKET_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api\/?$/, '')

const TYPE_META = {
    announcement: { icon: '📢', color: '#6c5ce7' },
    exam: { icon: '📝', color: '#e17055' },
    scholarship: { icon: '🎓', color: '#00b894' },
    career: { icon: '🎯', color: '#0984e3' },
    college: { icon: '🏫', color: '#fdcb6e' },
    course: { icon: '📘', color: '#a29bfe' },
    system: { icon: '⚙️', color: '#74b9ff' },
    counselling: { icon: '🤝', color: '#fd79a8' },
    student_registration: { icon: '🧑‍🎓', color: '#00b894' },
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false)
    const panelRef = useRef(null)
    const socketRef = useRef(null)

    const {
        notifications, // sent history
        adminAlerts,
        adminUnreadCount,
        stats,
        deleteNotification,
        markAdminAlertRead,
    } = useNotifications()

    const [activeTab, setActiveTab] = useState('alerts') // 'alerts' | 'sent'

    // ── Join the "admins" socket room on mount ────────────────────────────
    // This ensures admin gets multi-tab sync events but NEVER receives
    // student notification events.
    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        socketRef.current = socket
        socket.on('connect', () => {
            socket.emit('join_admin')   // join "admins" room only
            console.log('🔐 [Admin Bell] Joined admins room:', socket.id)
        })
        return () => socket.disconnect()
    }, [])

    // ── Close panel when clicking outside ────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Show unread admin alerts as the badge value
    const badgeCount = adminUnreadCount
    const recent = activeTab === 'alerts'
        ? (adminAlerts || []).slice(0, 15)
        : notifications.slice(0, 15)

    return (
        <div className={styles.wrapper} ref={panelRef}>
            {/* ── Bell Button ── */}
            <button
                id="notification-bell-btn"
                className={`${styles.bell} ${badgeCount > 0 ? styles.hasActivity : ''}`}
                onClick={() => setOpen((o) => !o)}
                title={`${badgeCount} unread notification${badgeCount !== 1 ? 's' : ''}`}
                aria-label="Admin notifications"
            >
                <span className={styles.bellIcon}>🔔</span>
                {badgeCount > 0 && (
                    <span className={styles.badge} title={`${badgeCount} unread`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                )}
            </button>

            {/* ── Dropdown Panel ── */}
            {open && (
                <div
                    className={styles.panel}
                    id="notification-panel"
                    role="dialog"
                    aria-label="Sent Notifications"
                >
                    {/* Header with tabs */}
                    <div className={styles.panelHeader}>
                        <div className={styles.panelTitle}>
                            <span>🔔</span>
                            <span>Notifications</span>
                            {badgeCount > 0 && (
                                <span className={styles.titleBadge}>
                                    {badgeCount} unread
                                </span>
                            )}
                        </div>
                        <div className={styles.statsRow}>
                            <button
                                className={styles.statChip}
                                style={{
                                    color: activeTab === 'alerts' ? '#fff' : '#00b894',
                                    background: activeTab === 'alerts' ? '#00b894' : 'var(--surface2)',
                                    cursor: 'pointer', border: '1px solid var(--border)',
                                }}
                                onClick={() => setActiveTab('alerts')}
                            >
                                🧑‍🎓 Alerts {adminUnreadCount > 0 ? `(${adminUnreadCount})` : ''}
                            </button>
                            <button
                                className={styles.statChip}
                                style={{
                                    color: activeTab === 'sent' ? '#fff' : '#6c5ce7',
                                    background: activeTab === 'sent' ? '#6c5ce7' : 'var(--surface2)',
                                    cursor: 'pointer', border: '1px solid var(--border)',
                                }}
                                onClick={() => setActiveTab('sent')}
                            >
                                📤 Sent ({stats?.totalSent ?? 0})
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className={styles.list}>
                        {recent.length === 0 ? (
                            <div className={styles.empty}>
                                <div className={styles.emptyIcon}>📭</div>
                                <p>No notifications sent yet</p>
                                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                                    Go to Notifications page to create one
                                </span>
                            </div>
                        ) : (
                            recent.map((n) => {
                                const meta = TYPE_META[n.type] || TYPE_META.announcement
                                const isAlert = activeTab === 'alerts'
                                return (
                                    <div
                                        key={n._id}
                                        className={`${styles.item} ${isAlert && !n.isRead ? styles.unread : ''}`}
                                        id={`notif-item-${n._id}`}
                                        onClick={() => {
                                            if (isAlert && !n.isRead) markAdminAlertRead(n._id)
                                        }}
                                        style={isAlert ? { cursor: 'pointer' } : {}}
                                    >
                                        {/* Accent bar */}
                                        <div
                                            className={styles.accentBar}
                                            style={{ background: meta.color }}
                                        />

                                        {/* Icon */}
                                        <div
                                            className={styles.typeIcon}
                                            style={{
                                                background: `${meta.color}22`,
                                                color: meta.color,
                                            }}
                                        >
                                            {meta.icon}
                                        </div>

                                        {/* Content */}
                                        <div className={styles.content}>
                                            <div className={styles.itemTitle}>
                                                {n.title}
                                                {isAlert && !n.isRead && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: 8, height: 8,
                                                        borderRadius: '50%',
                                                        background: '#e17055',
                                                        marginLeft: 6,
                                                        verticalAlign: 'middle',
                                                    }} />
                                                )}
                                            </div>
                                            <div className={styles.itemMsg}>{n.message}</div>
                                            <div className={styles.itemMeta}>
                                                <span
                                                    className={styles.typePill}
                                                    style={{
                                                        background: `${meta.color}22`,
                                                        color: meta.color,
                                                    }}
                                                >
                                                    {n.type}
                                                </span>
                                                {!isAlert && n.isBroadcast ? (
                                                    <span className={styles.broadcastPill}>
                                                        📡 All
                                                    </span>
                                                ) : !isAlert ? (
                                                    <span className={styles.levelPill}>
                                                        👤 Targeted
                                                    </span>
                                                ) : null}
                                                <span className={styles.time}>
                                                    {timeAgo(n.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Delete action (only for sent tab) */}
                                        {!isAlert && (
                                            <div className={styles.actions}>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => deleteNotification(n._id)}
                                                    title="Delete notification"
                                                    id={`delete-notif-${n._id}`}
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className={styles.panelFooter}>
                        {activeTab === 'alerts'
                            ? `${adminAlerts?.length ?? 0} alert${(adminAlerts?.length ?? 0) !== 1 ? 's' : ''} — click to mark as read`
                            : notifications.length > 15
                                ? `Showing 15 of ${notifications.length} — visit Notifications page for full list`
                                : `📊 ${stats?.activeStudents ?? '?'} active students in system`}
                    </div>
                </div>
            )}
        </div>
    )
}
