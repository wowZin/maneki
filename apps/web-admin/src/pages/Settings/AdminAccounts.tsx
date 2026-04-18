/**
 * 管理员账户管理页面
 */

import React from 'react'
import { SafetyOutlined } from '@ant-design/icons'
import AdminAccountsComponent from '@/components/AdminAccounts'

const AdminAccountsPage: React.FC = () => {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <SafetyOutlined /> 管理员账户
      </h2>
      <AdminAccountsComponent />
    </div>
  )
}

export default AdminAccountsPage
