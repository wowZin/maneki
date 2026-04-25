/**
 * Agent 筛选器组件
 */
import React from 'react'
import { Select, Space } from 'antd'

interface AgentFiltersProps {
  type: string
  category: string
  onTypeChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '技术面', value: 'technical' },
  { label: '基本面', value: 'fundamental' },
  { label: '情绪面', value: 'sentiment' },
  { label: '资金面', value: 'capital' },
  { label: '决策', value: 'decision' },
  { label: '自定义', value: 'custom' },
]

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '趋势', value: 'trend' },
  { label: '量能', value: 'volume' },
  { label: '突破', value: 'breakout' },
  { label: '情绪', value: 'sentiment' },
  { label: '自定义', value: 'custom' },
]

const AgentFilters: React.FC<AgentFiltersProps> = ({ type, category, onTypeChange, onCategoryChange }) => {
  return (
    <Space size={12} wrap>
      <Select
        placeholder="Agent 类型"
        value={type}
        onChange={onTypeChange}
        options={typeOptions}
        style={{ width: 140 }}
        size="middle"
      />
      <Select
        placeholder="分类"
        value={category}
        onChange={onCategoryChange}
        options={categoryOptions}
        style={{ width: 140 }}
        size="middle"
      />
    </Space>
  )
}

export default AgentFilters
