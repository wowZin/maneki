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

// 页面
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import LandingPage from './pages/LandingPage'
import Marketplace from './pages/Marketplace'
import AgentDetail from './pages/AgentDetail'
import AgentCreate from './pages/AgentCreate'
import SignalCenter from './pages/SignalCenter'
import Backtest from './pages/Backtest'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuthStore } from './stores/auth'

// 根路由：未登录展示欢迎页，已登录进 Dashboard
const RootRoute: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <LandingPage />
  }
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  )
}

// 保护路由
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

// Ant Design 主题配置 - 暖色招财风格
const theme = {
  token: {
    colorPrimary: '#e67e22',
    colorInfo: '#d35400',
    colorSuccess: '#10b981',
    colorWarning: '#f39c12',
    colorError: '#ef4444',
    borderRadius: 12,
    borderRadiusLG: 16,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/pricing" element={
            <ErrorBoundary>
              <Pricing />
            </ErrorBoundary>
          } />

          {/* 根路由：未登录展示欢迎页，已登录进工作台 */}
          <Route path="/" element={<RootRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<div>股票监控（开发中）</div>} />
            <Route path="signals" element={<SignalCenter />} />
            <Route path="replay" element={<Backtest />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="marketplace/agents/:id" element={<AgentDetail />} />
            <Route path="marketplace/agents/create" element={<AgentCreate />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
