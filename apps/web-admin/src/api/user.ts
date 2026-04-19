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
}

export const userApi = {
  list: (params?: { page?: number; page_size?: number; keyword?: string; is_active?: boolean }) =>
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
