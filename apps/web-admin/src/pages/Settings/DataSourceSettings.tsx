/**
 * 数据源设置页面（多 Tab）
 */
import React, { useState } from 'react'
import { Card, Tabs } from 'antd'
import { DatabaseOutlined, FileTextOutlined, StockOutlined, TrophyOutlined , InfoCircleOutlined } from '@ant-design/icons'
import NewsSyncSettings from './SyncSettings'

const DataSourceSettings: React.FC = () => {
  const [activeKey, setActiveKey] = useState('news')

  const items = [
    {
      key: 'news',
      label: (
        <span>
          <FileTextOutlined />
          <span className="ml-1">新闻同步</span>
        </span>
      ),
      children: <NewsSyncSettings />,
    },
    {
      key: 'quotes',
      label: (
        <span>
          <StockOutlined />
          <span className="ml-1">行情数据</span>
        </span>
      ),
      children: (
        <Card title="行情数据同步设置" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mt-4">
          <p className="text-[var(--color-text-secondary)] text-center py-10">行情数据同步设置（开发中）</p>
        </Card>
      ),
    },
    {
      key: 'dragon',
      label: (
        <span>
          <TrophyOutlined />
          <span className="ml-1">龙虎榜</span>
        </span>
      ),
      children: (
        <Card title="龙虎榜数据同步设置" className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mt-4">
          <p className="text-[var(--color-text-secondary)] text-center py-10">龙虎榜数据同步设置（开发中）</p>
        </Card>
      ),
    },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <DatabaseOutlined />
          </span>
          数据源设置
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            配置各数据源的同步策略与参数</p>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Tabs activeKey={activeKey} onChange={setActiveKey} items={items} type="card" />
      </Card>
    </div>
  )
}

export default DataSourceSettings
