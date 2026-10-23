/**
 * NotificationContext.jsx
 *
 * PURPOSE — Admin-side only
 * ─────────────────────────
 * This context is used inside the Admin Panel.
 *
 * WHAT IT DOES:
 *   • Tracks all notifications SENT by admin (read-only audit list)
 *   • Provides stats: totalSent, sentToday, broadcasts, targeted
 *   • Listens for socket events that admin SHOULD know about
 *     (e.g. a notification was just created/deleted by another admin session)
 *
 * WHAT IT DOES NOT DO:
 *   • Does NOT join any student socket room
 *   • Does NOT show user-facing unread counts
 *   • Does NOT fire browser Notification alerts for user events
 *   • Does NOT receive per-user notification payloads
 *
 * Student-side notification logic is handled separately in the user frontend.
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
} from 'react'
import { io } from 'socket.io-client'
import { notificationService } from '../../services/notificationService'

const NotificationContext = createContext()

import { SOCKET_BASE_URL } from '../../config/apiConfig'

const SOCKET_URL = SOCKET_BASE_URL

export function NotificationProvider({ children }) {
    // ── Sent-history list (what admin has dispatched) ─────────────────────
    const [notifications, setNotifications] = useState([])
    // ── Admin alerts (system-generated, e.g. student registration) ─────
    const [adminAlerts, setAdminAlerts] = useState([])
    const [adminUnreadCount, setAdminUnreadCount] = useState(0)
    // ── Stats from the backend ──────────────────────────────────────────
    const [stats, setStats] = useState({
        totalSent: 0,
        broadcasts: 0,
        targeted: 0,
        unread: 0,
        sentToday: 0,
        activeStudents: 0,
        byType: [],
        recentActivity: 0,
    })
    const [loading, setLoading] = useState(false)
    const socketRef = useRef(null)

    // ── Fetch admin alerts (system-generated) ─────────────────────────────
    const fetchAdminAlerts = useCallback(async () => {
        try {
            const res = await notificationService.getAdminAlerts()
            setAdminAlerts(res.notifications || [])
            setAdminUnreadCount(res.unreadCount || 0)
        } catch (e) {
            console.warn('Could not fetch admin alerts:', e.message)
        }
    }, [])

    // ── Fetch sent notifications + fresh stats ────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true)
            const [listRes, statsRes] = await Promise.all([
                notificationService.getAll({ limit: 50 }),
                notificationService.getStats(),
            ])
            setNotifications(listRes.notifications || [])
            if (statsRes) setStats(statsRes)
        } catch (e) {
            console.warn('Could not fetch notifications:', e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Socket: listen ONLY for admin-relevant events ─────────────────────
    // Admin does NOT join "students" or "user_<id>" rooms.
    // We only sync state when another admin session creates/deletes entries.
    useEffect(() => {
        fetchNotifications()
        fetchAdminAlerts()

        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        socketRef.current = socket

        socket.on('connect', () => {
            console.log('🔔 [Admin] Notification socket connected:', socket.id)
            // ⚠️ IMPORTANT: Admin does NOT emit join_student or join_user_room.
            //    Admin stays in the default namespace room only.
        })

        // Someone in another admin tab created a new notification → refresh list
        // We listen to a dedicated "admin_notification_created" event only
        // (NOT the user-facing "new_notification" which goes to student rooms)
        socket.on('admin_notification_created', (notif) => {
            setNotifications((prev) => [notif, ...prev])
            setStats((s) => ({
                ...s,
                totalSent: s.totalSent + 1,
                broadcasts: notif.isBroadcast ? s.broadcasts + 1 : s.broadcasts,
                targeted: !notif.isBroadcast ? s.targeted + 1 : s.targeted,
                sentToday: s.sentToday + 1,
            }))
        })

        // A notification was edited by another admin tab
        socket.on('admin_notification_updated', (updated) => {
            setNotifications((prev) =>
                prev.map((n) => (n._id === updated._id ? updated : n))
            )
        })

        // A notification was deleted by another admin tab
        socket.on('admin_notification_deleted', ({ id }) => {
            setNotifications((prev) => prev.filter((n) => n._id !== id))
            setStats((s) => ({
                ...s,
                totalSent: Math.max(0, s.totalSent - 1),
            }))
        })

        // All notifications cleared
        socket.on('admin_notifications_cleared', () => {
            setNotifications([])
            setStats((s) => ({ ...s, totalSent: 0, broadcasts: 0, targeted: 0, sentToday: 0 }))
        })

        // Real-time admin alerts (e.g. new student registered)
        socket.on('new_admin_notification', (alert) => {
            setAdminAlerts((prev) => [alert, ...prev])
            setAdminUnreadCount((c) => c + 1)
        })

        socket.on('disconnect', () => {
            console.log('🔔 [Admin] Notification socket disconnected')
        })

        return () => {
            socket.disconnect()
        }
    }, [fetchNotifications, fetchAdminAlerts])

    // ── Context actions (admin-side CRUD) ─────────────────────────────────
    /**
     * deleteNotification: Admin deletes a sent notification.
     * Also updates local stats count.
     */
    const deleteNotification = useCallback(async (id) => {
        try {
            await notificationService.delete(id)
            setNotifications((prev) => prev.filter((n) => n._id !== id))
            setStats((s) => ({ ...s, totalSent: Math.max(0, s.totalSent - 1) }))
        } catch (e) {
            console.warn('delete failed:', e.message)
        }
    }, [])

    /**
     * addNotification: Called after admin successfully creates one,
     * updates the local sent-history list immediately.
     */
    const addNotification = useCallback((notif) => {
        setNotifications((prev) => [notif, ...prev])
        setStats((s) => ({
            ...s,
            totalSent: s.totalSent + 1,
            broadcasts: notif.isBroadcast ? s.broadcasts + 1 : s.broadcasts,
            targeted: !notif.isBroadcast ? s.targeted + 1 : s.targeted,
            sentToday: s.sentToday + 1,
        }))
    }, [])

    /**
     * markAdminAlertRead: Mark a system-generated admin alert as read.
     */
    const markAdminAlertRead = useCallback(async (id) => {
        try {
            await notificationService.markAdminAlertRead(id)
            setAdminAlerts((prev) =>
                prev.map((a) => (a._id === id ? { ...a, isRead: true } : a))
            )
            setAdminUnreadCount((c) => Math.max(0, c - 1))
        } catch (e) {
            console.warn('Mark admin alert read failed:', e.message)
        }
    }, [])

    /**
     * refreshStats: Force-fetch fresh stats from backend.
     */
    const refreshStats = useCallback(async () => {
        try {
            const statsRes = await notificationService.getStats()
            if (statsRes) setStats(statsRes)
        } catch (e) {
            console.warn('Stats refresh failed:', e.message)
        }
    }, [])

    return (
        <NotificationContext.Provider
            value={{
                // Sent-history list
                notifications,
                // Admin alerts (system-generated)
                adminAlerts,
                adminUnreadCount,
                // Stats
                stats,
                loading,
                // Actions
                fetchNotifications,
                fetchAdminAlerts,
                refreshStats,
                deleteNotification,
                addNotification,
                markAdminAlertRead,
            }}
        >
            {children}
        </NotificationContext.Provider>
    )
}

export const useNotifications = () => useContext(NotificationContext)
