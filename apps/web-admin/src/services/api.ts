/**
 * Admin API 基础配置 - 增强安全版
 */

import axios from 'axios'
import { message } from 'antd'
import { generateNonce } from '@/utils/security'

// 错误码映射
const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '无权访问此资源',
  404: '请求的资源不存在',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '服务暂时不可用',
  503: '服务维护中',
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  // 启用 cookie 支持
  withCredentials: true,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // Cookie 自动携带 token，无需手动设置 Authorization

    // 禁用缓存
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    config.headers['Pragma'] = 'no-cache'
    config.headers['Expires'] = '0'

    // 添加安全头
    config.headers['X-Request-Nonce'] = generateNonce()
    config.headers['X-Request-Time'] = Date.now().toString()

    // 添加来源检查（CSP 配合）
    config.headers['X-Frame-Options'] = 'DENY'

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 检查响应头安全
    const contentType = response.headers['content-type']

    // 确保返回的是 JSON
    if (contentType && !contentType.includes('application/json')) {
      console.error('Unexpected response type:', contentType)
      return Promise.reject(new Error('响应格式异常'))
    }

    return response
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response

      // 处理特定错误码
      switch (status) {
        case 401:
          // 避免在登录/改密页面触发无限跳转循环
          if (window.location.pathname === '/login' || window.location.pathname === '/change-password') {
            break
          }
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
          break

        case 403:
          message.error('权限不足：' + (data?.detail || '禁止访问'))
          break

        case 429:
          message.error('请求过于频繁，请 ' + (data?.retry_after || '稍后') + ' 再试')
          break

        default:
          message.error(data?.detail || ERROR_MESSAGES[status] || '请求失败')
      }
    } else if (error.request) {
      message.error('网络连接失败，请检查网络')
    } else {
      message.error('请求配置错误')
    }

    return Promise.reject(error)
  }
)

export default api
