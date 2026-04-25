/**
 * 排序选择器组件
 */
import React from 'react'
import { Select } from 'antd'

interface SortSelectorProps {
  sortBy: string
  sortOrder: string
  onSortByChange: (value: string) => void
  onSortOrderChange: (value: string) => void
}

const sortOptions = [
  { label: '使用次数', value: 'use_count' },
  { label: '预测准确率', value: 'accuracy' },
  { label: '评分', value: 'rating' },
  { label: '最新发布', value: 'created_at' },
]

const orderOptions = [
  { label: '降序', value: 'desc' },
  { label: '升序', value: 'asc' },
]

const SortSelector: React.FC<SortSelectorProps> = ({ sortBy, sortOrder, onSortByChange, onSortOrderChange }) => {
  return (
    <Select
      value={`${sortBy}_${sortOrder}`}
      onChange={(value) => {
        const [by, order] = value.split('_')
        onSortByChange(by)
        onSortOrderChange(order)
      }}
      options={sortOptions.flatMap(opt =>
        orderOptions.map(order => ({
          label: `${opt.label} (${order.label})`,
          value: `${opt.value}_${order.value}`,
        }))
      )}
      style={{ width: 180 }}
      size="middle"
    />
  )
}

export default SortSelector
