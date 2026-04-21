/**
 * 系统通知配置 API 服务
 */
import api from './api'

export interface SystemNotification {
  id: number
  title: string
  content: string
  priority: number
  priority_label: string
  start_time: string
  end_time: string | null
  min_visible_level: number
  status: string
  status_label: string
  created_at: string
  updated_at: string
}

export interface NotificationListResponse {
  code: number
  message: string
  data: SystemNotification[]
  page: number
  page_size: number
  total: number
}

export interface CreateNotificationParams {
  title: string
  content: string
  priority: number
  start_time: string
  end_time?: string | null
  min_visible_level: number
}

export interface UpdateNotificationParams {
  title?: string
  content?: string
  priority?: number
  start_time?: string
  end_time?: string | null
  min_visible_level?: number
}

export const systemNotificationApi = {
  /**
   * 获取通知列表
   */
  getList: async (params?: {
    page?: number
    page_size?: number
    status?: string
    keyword?: string
  }): Promise<NotificationListResponse> => {
    const { data } = await api.get('/v1/admin/notifications', { params })
    return data
  },

  /**
   * 获取通知详情
   */
  getDetail: async (id: number) => {
    const { data } = await api.get(`/v1/admin/notifications/${id}`)
    return data
  },

  /**
   * 创建通知
   */
  create: async (params: CreateNotificationParams) => {
    const { data } = await api.post('/v1/admin/notifications', params)
    return data
  },

  /**
   * 更新通知
   */
  update: async (id: number, params: UpdateNotificationParams) => {
    const { data } = await api.put(`/v1/admin/notifications/${id}`, params)
    return data
  },

  /**
   * 失效通知
   */
  disable: async (id: number) => {
    const { data } = await api.post(`/v1/admin/notifications/${id}/disable`)
    return data
  },

  /**
   * 复制通知
   */
  duplicate: async (id: number) => {
    const { data } = await api.post(`/v1/admin/notifications/${id}/duplicate`)
    return data
  },
}
