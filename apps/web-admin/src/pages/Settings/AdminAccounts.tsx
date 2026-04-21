/**
 * 管理员账户管理页面
 */

import React from 'react'
import { SafetyOutlined , InfoCircleOutlined } from '@ant-design/icons'
import AdminAccountsComponent from '@/components/AdminAccounts'

const AdminAccountsPage: React.FC = () => {
  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <SafetyOutlined />
          </span>
          管理员账户
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理平台管理员账户权限与安全</p>
      </div>
      <AdminAccountsComponent />
    </div>
  )
}

export default AdminAccountsPage
