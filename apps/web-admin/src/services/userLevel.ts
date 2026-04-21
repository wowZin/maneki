import api from './api'

export interface UserLevel {
  id: number
  code: string
  name: string
  level_value: number
  color: string
  sort_order: number
}

export const userLevelApi = {
  getList: async (): Promise<UserLevel[]> => {
    const { data } = await api.get('/v1/user-levels')
    return data.data || []
  },
}
