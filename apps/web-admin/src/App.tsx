/**
 * Maneki Admin 后台管理应用
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 布局
import AdminLayout from './components/AdminLayout'
import AdminRoute from './components/AdminRoute'

// 页面
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Overview from './pages/Overview'
import Agents from './pages/Agents'
import AgentCreate from './pages/Agents/AgentCreate'
import Rebates from './pages/Rebates'
import Settings from './pages/Settings'
import DataSource from './pages/DataSource'
import NewsManagement from './pages/DataSource/NewsManagement'
import NewsDetail from './pages/DataSource/NewsDetail'
import TopListManagement from './pages/DataSource/TopListManagement'
import TopInstManagement from './pages/DataSource/TopInstManagement'
import HotMoneyManagement from './pages/DataSource/HotMoneyManagement'

// 系统设置子页面
import RebateSettings from './pages/Settings/RebateSettings'
import PricingSettings from './pages/Settings/PricingSettings'
import SystemSettings from './pages/Settings/SystemSettings'
import NotificationSettings from './pages/Settings/NotificationSettings'
import AdminAccounts from './pages/Settings/AdminAccounts'

// 新增页面
import AdminListPage from './pages/AdminSettings/AdminListPage'
import UserListPage from './pages/UserManagement/UserListPage'
import UserDetailPage from './pages/UserManagement/UserDetailPage'
import AuditLogPage from './pages/AuditLog/AuditLogPage'

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
      <AntdApp>
        <BrowserRouter>
          <Routes>
          {/* 登录页面 */}
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />

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
            <Route path="users" element={<UserListPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/create" element={<AgentCreate />} />
            <Route path="rebates" element={<Rebates />} />
            <Route path="analytics" element={<div>数据统计（开发中）</div>} />
            {/* 系统设置 - 旧页面，可以保留或重定向 */}
            <Route path="settings" element={<Settings />} />
            <Route path="datasource" element={<DataSource />} />
            <Route path="datasource/news" element={<NewsManagement />} />
            <Route path="datasource/news/:id" element={<NewsDetail />} />
            <Route path="datasource/top-list" element={<TopListManagement />} />
            <Route path="datasource/top-inst" element={<TopInstManagement />} />
            <Route path="datasource/hot-money" element={<HotMoneyManagement />} />
            {/* 系统设置 - 新页面 */}
            <Route path="settings/rebate" element={<RebateSettings />} />
            <Route path="settings/pricing" element={<PricingSettings />} />
            <Route path="settings/system" element={<SystemSettings />} />
            <Route path="settings/notification" element={<NotificationSettings />} />
            <Route path="settings/admin-accounts" element={<AdminAccounts />} />
            {/* 新增路由 */}
            <Route path="admin-settings" element={<AdminListPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
          </Route>

          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
