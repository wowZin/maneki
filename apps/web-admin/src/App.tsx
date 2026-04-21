import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AdminLayout from './components/AdminLayout'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Overview from './pages/Overview'
import Agents from './pages/Agents'
import AgentCreate from './pages/Agents/AgentCreate'
import RebateStatsPage from './pages/Rebates/RebateStatsPage'
import RebateRecordsPage from './pages/Rebates/RebateRecordsPage'
import RebateRulePage from './pages/Rebates/RebateRulePage'
import AntiArbitrageRulePage from './pages/Rebates/AntiArbitrageRulePage'
import Settings from './pages/Settings'
import DataSource from './pages/DataSource'
import NewsManagement from './pages/DataSource/NewsManagement'
import NewsDetail from './pages/DataSource/NewsDetail'
import TopListManagement from './pages/DataSource/TopListManagement'
import TopInstManagement from './pages/DataSource/TopInstManagement'
import HotMoneyManagement from './pages/DataSource/HotMoneyManagement'
import PricingSettings from './pages/Settings/PricingSettings'
import SystemSettings from './pages/Settings/SystemSettings'
import NotificationSettings from './pages/Settings/NotificationSettings'
import AdminAccounts from './pages/Settings/AdminAccounts'
import AdminListPage from './pages/AdminSettings/AdminListPage'
import UserListPage from './pages/UserManagement/UserListPage'
import UserDetailPage from './pages/UserManagement/UserDetailPage'
import NotificationListPage from './pages/Notifications/NotificationListPage'
import ProfilePage from './pages/Profile/ProfilePage'

const antdTheme = {
  token: {
    colorPrimary: '#7c3aed',
    colorInfo: '#3b82f6',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 10,
    borderRadiusLG: 14,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8f9fa',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    fontFamily: '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  algorithm: theme.defaultAlgorithm,
}

const App: React.FC = () => (
  <ConfigProvider locale={zhCN} theme={antdTheme}>
    <AntdApp>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
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
            <Route path="rebates" element={<RebateStatsPage />} />
            <Route path="rebates/records" element={<RebateRecordsPage />} />
            <Route path="rebates/rules" element={<RebateRulePage />} />
            <Route path="rebates/anti-arbitrage" element={<AntiArbitrageRulePage />} />
            <Route path="analytics" element={<div className="text-center text-[color:var(--color-text-secondary)] py-20">数据统计（开发中）</div>} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/pricing" element={<PricingSettings />} />
            <Route path="settings/system" element={<SystemSettings />} />
            <Route path="settings/notification" element={<NotificationSettings />} />
            <Route path="settings/admin-accounts" element={<AdminAccounts />} />
            <Route path="datasource" element={<DataSource />} />
            <Route path="datasource/news" element={<NewsManagement />} />
            <Route path="datasource/news/:id" element={<NewsDetail />} />
            <Route path="datasource/top-list" element={<TopListManagement />} />
            <Route path="datasource/top-inst" element={<TopInstManagement />} />
            <Route path="datasource/hot-money" element={<HotMoneyManagement />} />
            <Route path="admin-settings" element={<AdminListPage />} />
            <Route path="notifications" element={<NotificationListPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AntdApp>
  </ConfigProvider>
)

export default App
