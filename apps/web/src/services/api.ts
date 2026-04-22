/**
 * API 服务 - Axios 配置和认证相关接口
 */

import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../stores/auth'

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// 创建 axios 实例
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，登出
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 认证相关接口
export interface RegisterData {
  email: string
  password: string
  username: string
  full_name?: string
}

export interface LoginData {
  username: string  // FastAPI-Users 使用 username 字段作为登录名
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

// 手机号登录相关接口
export interface PhoneTokenResponse {
  access_token: string
  jwt_token: string
  expire_time: number
}

export interface PhoneVerifyData {
  phone: string
  sp_token: string
}

export interface SendCodeData {
  phone: string
}

export interface CodeLoginData {
  phone: string
  code: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: {
    id: string
    email: string
    username: string
    nickname: string
    avatar_url: string
    vip_level: number
    vip_tier: string
    is_vip: boolean
    is_superuser: boolean
    is_active: boolean
    is_verified: boolean
  }
}

export const authApi = {
  // 注册
  register: async (data: RegisterData) => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  // 登录
  login: async (data: LoginData): Promise<AuthResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', data.username)
    formData.append('password', data.password)

    const response = await axios.post(
      `${API_BASE_URL}/api/v1/auth/jwt/login`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    return response.data
  },

  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await api.get('/auth/users/me')
    return response.data
  },

  // 登出（可选，后端可能不需要）
  logout: async () => {
    // JWT 无需后端登出，前端清除 token 即可
    return Promise.resolve()
  },

  // ========== 手机号登录 ==========

  // 获取号码认证 Token
  getPhoneAuthToken: async (): Promise<PhoneTokenResponse> => {
    const response = await api.post('/auth/phone/token')
    return response.data
  },

  // 号码认证登录
  verifyPhone: async (data: PhoneVerifyData): Promise<TokenResponse> => {
    const response = await api.post('/auth/phone/verify', data)
    return response.data
  },

  // 发送短信验证码
  sendSMSCode: async (data: SendCodeData) => {
    const response = await api.post('/auth/phone/send-code', data)
    return response.data
  },

  // 短信验证码登录
  loginByCode: async (data: CodeLoginData): Promise<TokenResponse> => {
    const response = await api.post('/auth/phone/login-by-code', data)
    return response.data
  },
}

export default api
