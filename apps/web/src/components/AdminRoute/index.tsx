/**
 * 管理员路由守卫
 * 检查用户是否为管理员
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { Spin, Result } from 'antd'

interface AdminRouteProps {
  children: React.ReactNode
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
      />
    )
  }

  return <>{children}</>
}

export default AdminRoute
