import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Tag, Space, Popconfirm, message, Card, Select } from 'antd'
import {
  SearchOutlined, EyeOutlined, LockOutlined, UnlockOutlined, KeyOutlined,
  SortAscendingOutlined, SortDescendingOutlined, UserOutlined,

  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { userApi, User } from '../../api/user'
import { useUserLevelsStore } from '../../stores/userLevels'

const { Option } = Select

const UserListPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [vipLevels, setVipLevels] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<string>('desc')
  const navigate = useNavigate()
  const levels = useUserLevelsStore((s) => s.levels)
  const getLevelByValue = useUserLevelsStore((s) => s.getLevelByValue)

  useEffect(() => {
    useUserLevelsStore.getState().fetchLevels()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize, keyword }
      if (vipLevels.length > 0) params.vip_levels = vipLevels.join(',')
      if (sortBy) { params.sort_by = sortBy; params.sort_order = sortOrder }
      const res = await userApi.list(params)
      if (res.data.code === 0) {
        setUsers(res.data.data.data || res.data.data.list || [])
        setTotal(res.data.data.total)
      }
    } catch {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const handleSearch = () => { setPage(1); fetchUsers() }

  const handleToggleStatus = async (id: string, enable: boolean) => {
    try {
      const res = enable ? await userApi.enable(id) : await userApi.disable(id)
      if (res.data.code === 0) { message.success(enable ? '启用成功' : '禁用成功'); fetchUsers() }
      else message.error(res.data.message || '操作失败')
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  const handleResetPassword = async (id: string) => {
    try {
      const res = await userApi.resetPassword(id)
      if (res.data.code === 0) message.success(`密码已重置，临时密码：${res.data.data.temp_password}`)
      else message.error(res.data.message || '重置失败')
    } catch (error: any) {
      message.error(error.response?.data?.message || '重置失败')
    }
  }

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone
    return phone.substring(0, 3) + '****' + phone.substring(7)
  }

  const toggleAccuracySort = () => {
    if (sortBy === 'accuracy') { setSortBy(''); setSortOrder('desc') }
    else { setSortBy('accuracy'); setSortOrder('desc') }
    setPage(1)
    setTimeout(() => fetchUsers(), 0)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 100, ellipsis: true },
    { title: '昵称', dataIndex: 'name' },
    { title: '手机号', dataIndex: 'phone', render: (phone: string) => maskPhone(phone) },
    { title: '等级', dataIndex: 'vip_level', width: 100, render: (level: number) => {
      const l = getLevelByValue(level)
      return l ? <Tag color={l.color || 'default'}>{l.name}</Tag> : <Tag>等级 {level}</Tag>
    } },
    { title: '打板准确率', dataIndex: 'board_accuracy', width: 120, render: (v?: number | null) => (v != null ? `${v.toFixed(2)}%` : '--') },
    { title: '状态', dataIndex: 'is_active', render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? '启用' : '禁用'}</Tag> },
    { title: '注册时间', dataIndex: 'created_at', render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '最后登录', dataIndex: 'last_login_at', render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: User) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/users/${record.id}`)}>详情</Button>
          {record.is_active ? (
            <Popconfirm title="确定禁用该用户？" onConfirm={() => handleToggleStatus(record.id, false)}>
              <Button type="link" danger icon={<LockOutlined />}>禁用</Button>
            </Popconfirm>
          ) : (
            <Button type="link" icon={<UnlockOutlined />} onClick={() => handleToggleStatus(record.id, true)}>启用</Button>
          )}
          <Popconfirm title="确定重置该用户密码？" onConfirm={() => handleResetPassword(record.id)}>
            <Button type="link" icon={<KeyOutlined />}>重置密码</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
            <UserOutlined />
          </span>
          用户管理
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理平台注册用户、等级与权限</p>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-4">
        <Space wrap>
          <Input
            placeholder="搜索用户名或手机号"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
          />
          <Select
            mode="multiple"
            placeholder="选择等级"
            value={vipLevels}
            onChange={value => { setVipLevels(value); setPage(1) }}
            style={{ minWidth: 160 }}
            allowClear
          >
            {levels.map((l) => (
              <Option key={l.level_value} value={String(l.level_value)}>{l.name}</Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
          >搜索</Button>
          <Button
            icon={sortBy === 'accuracy' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            type={sortBy === 'accuracy' ? 'primary' : 'default'}
            onClick={toggleAccuracySort}
            className={sortBy === 'accuracy' ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none' : ''}
          >
            {sortBy === 'accuracy' ? '取消准确率排名' : '按准确率排名'}
          </Button>
        </Space>
      </Card>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps || 20) },
          }}
        />
      </Card>
    </div>
  )
}

export default UserListPage