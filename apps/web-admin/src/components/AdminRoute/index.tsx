/**
 * 管理员路由守卫
 * 检查用户是否为管理员
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { Spin, Result, Tag, Tooltip } from 'antd'
import { useAuthStore } from '../../stores/auth'
import { useSessionTimeout } from '../../hooks/useAuthGuard'
import { ClockCircleOutlined } from '@ant-design/icons'

interface AdminRouteProps {
  children: React.ReactNode
}

// 会话倒计时组件
const SessionTimer: React.FC = () => {
  const { remainingTime } = useSessionTimeout(30)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isWarning = remainingTime < 300 // 5分钟警告

  return (
    <Tooltip title="会话剩余时间，超时将自动退出">
      <Tag
        icon={<ClockCircleOutlined />}
        color={isWarning ? 'error' : 'default'}
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
      >
        {formatTime(remainingTime)}
      </Tag>
    </Tooltip>
  )
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  // 未登录
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 不是超级用户
  if (!user.is_superuser) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，你没有权限访问管理后台"
        extra={
          <a href="/">
            <button>返回首页</button>
          </a>
        }
      />
    )
  }

  return (
    <>
      {children}
      <SessionTimer />
    </>
  )
}

export default AdminRoute
