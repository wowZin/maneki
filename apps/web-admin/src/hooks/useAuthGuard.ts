/**
 * 认证守卫 Hook
 * 强化版认证检查
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useAuthStore } from '../stores/auth'

interface AuthGuardOptions {
  requireSuperuser?: boolean
  redirectTo?: string
}

export const useAuthGuard = (options: AuthGuardOptions = {}) => {
  const { requireSuperuser = true, redirectTo = '/login' } = options
  const navigate = useNavigate()
  const { user, isLoading, isAuthenticated } = useAuthStore()
  const [isValidating, setIsValidating] = useState(true)

  useEffect(() => {
    const validateAuth = async () => {
      // 等待初始化完成
      if (isLoading) return

      // 未登录
      if (!isAuthenticated || !user) {
        message.error('请先登录')
        navigate(redirectTo)
        return
      }

      // 检查是否为管理员
      if (requireSuperuser && !user.is_superuser) {
        message.error('无权访问管理后台')
        navigate('/')
        return
      }

      setIsValidating(false)
    }

    validateAuth()
  }, [isLoading, isAuthenticated, user, navigate, redirectTo, requireSuperuser])

  return {
    isValidating: isLoading || isValidating,
    user,
    isAuthenticated,
    isSuperuser: user?.is_superuser ?? false,
  }
}

// 会话超时检查
export const useSessionTimeout = (timeoutMinutes = 30) => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [remainingTime, setRemainingTime] = useState(timeoutMinutes * 60)

  useEffect(() => {
    let lastActivity = Date.now()
    let warningShown = false

    const updateActivity = () => {
      lastActivity = Date.now()
      warningShown = false
    }

    // 监听用户活动
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => {
      document.addEventListener(event, updateActivity)
    })

    const checkInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity
      const timeoutMs = timeoutMinutes * 60 * 1000

      // 更新剩余时间
      setRemainingTime(Math.max(0, Math.floor((timeoutMs - inactiveTime) / 1000)))

      // 5分钟前警告
      if (inactiveTime > timeoutMs - 5 * 60 * 1000 && !warningShown) {
        warningShown = true
        message.warning('5分钟后将自动退出登录', 5)
      }

      // 超时退出
      if (inactiveTime > timeoutMs) {
        logout()
        message.error('会话已超时，请重新登录')
        navigate('/login')
      }
    }, 10000) // 每10秒检查一次

    return () => {
      clearInterval(checkInterval)
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity)
      })
    }
  }, [navigate, logout, timeoutMinutes])

  return { remainingTime }
}
