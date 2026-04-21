/**
 * 管理员认证状态管理
 */

import { create } from 'zustand'
import { adminAuthApi } from '../api/auth'

export interface AdminUser {
  id: number
  name: string
  role: 'super' | 'admin'
  is_active?: boolean
  force_change_password?: boolean
  last_login_at?: string
  created_at?: string
}

interface AuthState {
  user: AdminUser | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  setUser: (user: AdminUser | null) => void
  setLoading: (loading: boolean) => void
  login: (user: AdminUser) => void
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),

  login: (user) => {
    set({ user, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  fetchUser: async () => {
    try {
      const { data: result } = await adminAuthApi.me()
      if (result.code === 0 && result.data) {
        set({ user: result.data, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch (error) {
      console.error('Fetch user error:', error)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))

// 初始化：检查当前登录状态
const initAuth = async () => {
  await useAuthStore.getState().fetchUser()
}

initAuth()
