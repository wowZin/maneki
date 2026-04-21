import api from '../services/api'

export interface AuditLog {
  id: number
  admin_name: string
  action: string
  target_type: string
  target_name: string
  detail: string
  ip_addr: string
  created_at: string
}

export const auditApi = {
  list: (params?: {
    page?: number
    page_size?: number
    start_date?: string
    end_date?: string
    admin_name?: string
    action?: string
  }) => api.get('/v1/admin/audit-logs', { params }),

  export: (params?: {
    start_date?: string
    end_date?: string
    admin_name?: string
    action?: string
  }) =>
    api.get('/v1/admin/audit-logs/export', {
      params,
      responseType: 'blob',
    }),
}
