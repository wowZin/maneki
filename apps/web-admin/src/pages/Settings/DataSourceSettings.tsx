/**
 * 数据源设置页面（多 Tab）
 */
import React, { useState } from 'react'
import { Card, Tabs } from 'antd'
import {
  DatabaseOutlined,
  FileTextOutlined,
  StockOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import NewsSyncSettings from './SyncSettings'

const DataSourceSettings: React.FC = () => {
  const [activeKey, setActiveKey] = useState('news')

  const items = [
    {
      key: 'news',
      label: (
        <span>
          <FileTextOutlined />
          新闻同步
        </span>
      ),
      children: <NewsSyncSettings />,
    },
    {
      key: 'quotes',
      label: (
        <span>
          <StockOutlined />
          行情数据
        </span>
      ),
      children: (
        <Card title="行情数据同步设置" style={{ marginTop: 16 }}>
          <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
            行情数据同步设置（开发中）
          </p>
        </Card>
      ),
    },
    {
      key: 'dragon',
      label: (
        <span>
          <TrophyOutlined />
          龙虎榜
        </span>
      ),
      children: (
        <Card title="龙虎榜数据同步设置" style={{ marginTop: 16 }}>
          <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
            龙虎榜数据同步设置（开发中）
          </p>
        </Card>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={
          <span>
            <DatabaseOutlined /> 数据源设置
          </span>
        }
      >
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={items}
          type="card"
        />
      </Card>
    </div>
  )
}

export default DataSourceSettings
