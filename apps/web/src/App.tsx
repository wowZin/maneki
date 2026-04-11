/**
 * Maneki Web 前端应用
 * React + TypeScript + Vite + Ant Design
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 布局
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

// 页面
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'

// 管理后台页面
import AdminOverview from './pages/Admin/Overview'
import AdminUsers from './pages/Admin/Users'
import AdminAgents from './pages/Admin/Agents'
import AdminRebates from './pages/Admin/Rebates'
import AdminSettings from './pages/Admin/Settings'

// Ant Design 主题配置 - 科技蓝青色调
const theme = {
  token: {
    colorPrimary: '#3b82f6',
    colorInfo: '#06b6d4',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 12,
    borderRadiusLG: 16,
    fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    fontFamilyCode: "'JetBrains Mono', 'Fira Code', monospace",
  },
}

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* 受保护路由 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<div>股票监控（开发中）</div>} />
            <Route path="signals" element={<div>信号中心（开发中）</div>} />
            <Route path="replay" element={<div>回测分析（开发中）</div>} />
            <Route path="profile" element={<div>个人中心（开发中）</div>} />
            <Route path="settings" element={<div>设置（开发中）</div>} />
          </Route>

          {/* 管理后台路由 */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="agents" element={<AdminAgents />} />
            <Route path="rebates" element={<AdminRebates />} />
            <Route path="analytics" element={<div>数据统计（开发中）</div>} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
