/**
 * 管理员路由守卫
 * 检查用户是否为管理员
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { Spin, Result } from 'antd'
import { useAuthStore } from '../../stores/auth'

interface AdminRouteProps {
  children: React.ReactNode
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    )
  }

  // 未登录
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 不是管理员
  if (user.role !== 'super' && user.role !== 'admin') {
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
    </>
  )
}

export default AdminRoute
