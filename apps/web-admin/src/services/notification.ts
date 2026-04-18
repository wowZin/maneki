/**
 * 通知 API 服务
 */
import api from './api'

export interface NotificationItem {
  id: number
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
}

export interface NotificationQueryParams {
  page?: number
  pageSize?: number
  unread?: boolean
}

export interface NotificationResponse {
  data: NotificationItem[]
  page: number
  pageSize: number
  total: number
}

export const notificationApi = {
  /**
   * 获取通知列表
   */
  getNotifications: async (params: NotificationQueryParams = {}): Promise<NotificationResponse> => {
    const { data } = await api.get('/v1/admin/notifications', { params })
    return data
  },

  /**
   * 标记单条已读
   */
  markRead: async (id: number) => {
    const { data } = await api.post(`/v1/admin/notifications/${id}/read`)
    return data
  },

  /**
   * 标记全部已读
   */
  markAllRead: async () => {
    const { data } = await api.post('/v1/admin/notifications/read-all')
    return data
  },

  /**
   * 获取通知统计（未读数）
   */
  getStats: async () => {
    const { data } = await api.get('/v1/admin/notifications/stats')
    return data
  },
}
