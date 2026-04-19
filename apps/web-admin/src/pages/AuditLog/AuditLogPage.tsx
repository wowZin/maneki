/**
 * 操作日志页面
 */

import React, { useState, useEffect } from 'react'
import { Table, Button, DatePicker, Input, Select, Space, message, Card, Tag } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { auditApi, AuditLog } from '../../api/audit'

const { RangePicker } = DatePicker

const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'create_admin', label: '创建管理员' },
  { value: 'disable_admin', label: '禁用管理员' },
  { value: 'enable_admin', label: '启用管理员' },
  { value: 'disable_user', label: '禁用用户' },
  { value: 'enable_user', label: '启用用户' },
  { value: 'reset_user_password', label: '重置用户密码' },
]

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [adminName, setAdminName] = useState('')
  const [action, setAction] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      if (adminName) {
        params.admin_name = adminName
      }
      if (action) {
        params.action = action
      }

      const res = await auditApi.list(params)
      if (res.data.code === 0) {
        setLogs(res.data.data.list)
        setTotal(res.data.data.total)
      }
    } catch (error) {
      message.error('获取操作日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchLogs()
  }

  const handleExport = async () => {
    try {
      const params: any = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      if (adminName) {
        params.admin_name = adminName
      }
      if (action) {
        params.action = action
      }

      const res = await auditApi.export(params)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${dayjs().format('YYYYMMDD')}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const getActionTag = (action: string) => {
    const colorMap: Record<string, string> = {
      login: 'green',
      logout: 'default',
      create_admin: 'blue',
      disable_admin: 'red',
      enable_admin: 'green',
      disable_user: 'red',
      enable_user: 'green',
      reset_user_password: 'orange',
    }
    const label = actionOptions.find(o => o.value === action)?.label || action
    return <Tag color={colorMap[action] || 'default'}>{label}</Tag>
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '操作人',
      dataIndex: 'admin_name',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 140,
      render: (action: string) => getActionTag(action),
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      width: 100,
    },
    {
      title: '对象名称',
      dataIndex: 'target_name',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_addr',
      width: 120,
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      width: 180,
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>操作日志</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Input
            placeholder="操作人"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            style={{ width: 150 }}
          />
          <Select
            placeholder="操作类型"
            value={action}
            onChange={setAction}
            options={actionOptions}
            style={{ width: 150 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps || 20)
          },
        }}
      />
    </div>
  )
}

export default AuditLogPage