import api from '../services/api'

export interface User {
  id: string
  name: string
  phone: string
  email?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  last_login_at?: string
  vip_level?: number
  vip_level_label?: string
  board_accuracy?: number | null
  agents?: UserAgentItem[]
}

export interface UserAgentItem {
  agent_id: number
  agent_name: string
  agent_type: string
  subscription_status: string | null
  subscription_end_date: string | null
  weight: number | null
  is_weight_enabled: boolean | null
  agent_rating: number
  agent_use_count: number
}

export const userApi = {
  list: (params?: {
    page?: number
    page_size?: number
    keyword?: string
    is_active?: boolean
    vip_levels?: string
    sort_by?: string
    sort_order?: string
  }) =>
    api.get('/v1/admin/users', { params }),

  detail: (id: string) =>
    api.get(`/v1/admin/users/${id}`),

  disable: (id: string) =>
    api.post(`/v1/admin/users/${id}/disable`),

  enable: (id: string) =>
    api.post(`/v1/admin/users/${id}/enable`),

  resetPassword: (id: string) =>
    api.post(`/v1/admin/users/${id}/reset-password`),
}
