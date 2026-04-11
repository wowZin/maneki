/**
 * Maneki Admin 后台管理应用
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 布局
import AdminLayout from './components/AdminLayout'
import AdminRoute from './components/AdminRoute'

// 页面
import Overview from './pages/Overview'
import Users from './pages/Users'
import Agents from './pages/Agents'
import Rebates from './pages/Rebates'
import Settings from './pages/Settings'

// Ant Design 主题配置
const theme = {
  token: {
    colorPrimary: '#3b82f6',
    colorInfo: '#06b6d4',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 8,
    borderRadiusLG: 12,
  },
}

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* 管理后台路由 */}
          <Route
            path="/"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="users" element={<Users />} />
            <Route path="agents" element={<Agents />} />
            <Route path="rebates" element={<Rebates />} />
            <Route path="analytics" element={<div>数据统计（开发中）</div>} />
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
