/**
 * 通知配置页面
 */

import React from 'react'
import { Card, Alert } from 'antd'
import { BellOutlined } from '@ant-design/icons'

const NotificationSettings: React.FC = () => {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <BellOutlined /> 通知配置
      </h2>

      <Card>
        <Alert
          message="开发中"
          description="通知配置功能正在开发中"
          type="info"
          showIcon
        />
      </Card>
    </div>
  )
}

export default NotificationSettings