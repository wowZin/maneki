/**
 * 管理员认证状态管理 - Cookie 版本 (httpOnly)
 * Token 存储在 httpOnly Cookie 中，前端无法直接访问，更安全
 */

import { create } from 'zustand'

interface User {
  id: string
  email: string
  username: string
  is_superuser: boolean
  avatar_url?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  login: (user: User) => void
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
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include', // 携带 Cookie
      })

      if (response.ok) {
        const user = await response.json()
        set({ user, isAuthenticated: true, isLoading: false })
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
