/**
 * 系统配置页面 - 已改为独立页面
 * 访问 /settings 自动跳转到 /settings/system
 */

import React from 'react'
import { Navigate } from 'react-router-dom'

const Settings: React.FC = () => {
  return <Navigate to="/settings/system" replace />
}

export default Settings