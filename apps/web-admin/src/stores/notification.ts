/**
 * 通知状态管理
 */
import { create } from 'zustand'
import { notificationApi, type NotificationItem } from '../services/notification'

interface NotificationState {
  unreadCount: number
  notifications: NotificationItem[]
  loading: boolean

  fetchStats: () => Promise<void>
  fetchList: (params?: { page?: number; pageSize?: number; unread?: boolean }) => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  loading: false,

  fetchStats: async () => {
    try {
      const result: any = await notificationApi.getStats()
      if (result.code === 0) {
        set({ unreadCount: result.data?.unread_count || 0 })
      }
    } catch {
      // ignore
    }
  },

  fetchList: async (params = {}) => {
    set({ loading: true })
    try {
      const result: any = await notificationApi.getNotifications(params)
      if (result.code === 0) {
        set({ notifications: result.data || [] })
      }
    } catch {
      // ignore
    } finally {
      set({ loading: false })
    }
  },

  markRead: async (id: number) => {
    try {
      await notificationApi.markRead(id)
      set((state) => ({
        unreadCount: Math.max(0, state.unreadCount - 1),
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
      }))
    } catch {
      // ignore
    }
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllRead()
      set({
        unreadCount: 0,
        notifications: get().notifications.map((n) => ({ ...n, is_read: true })),
      })
    } catch {
      // ignore
    }
  },
}))
