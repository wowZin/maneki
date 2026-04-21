/**
 * 用户管理页面
 */

import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Tag, Space, Popconfirm, message, Card } from 'antd'
import { SearchOutlined, EyeOutlined, LockOutlined, UnlockOutlined, KeyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { userApi, User } from '../../api/user'

const UserListPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const navigate = useNavigate()

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await userApi.list({ page, page_size: pageSize, keyword })
      if (res.data.code === 0) {
        setUsers(res.data.data.data || res.data.data.list || [])
        setTotal(res.data.data.total)
      }
    } catch (error) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchUsers()
  }

  const handleToggleStatus = async (id: string, enable: boolean) => {
    try {
      const res = enable ? await userApi.enable(id) : await userApi.disable(id)
      if (res.data.code === 0) {
        message.success(enable ? '启用成功' : '禁用成功')
        fetchUsers()
      } else {
        message.error(res.data.message || '操作失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  const handleResetPassword = async (id: string) => {
    try {
      const res = await userApi.resetPassword(id)
      if (res.data.code === 0) {
        message.success(`密码已重置，临时密码：${res.data.data.temp_password}`)
      } else {
        message.error(res.data.message || '重置失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '重置失败')
    }
  }

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone
    return phone.substring(0, 3) + '****' + phone.substring(7)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      ellipsis: true,
    },
    {
      title: '昵称',
      dataIndex: 'name',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      render: (phone: string) => maskPhone(phone),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: User) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/users/${record.id}`)}>
            详情
          </Button>
          {record.is_active ? (
            <Popconfirm
              title="确定禁用该用户？"
              onConfirm={() => handleToggleStatus(record.id, false)}
            >
              <Button type="link" danger icon={<LockOutlined />}>
                禁用
              </Button>
            </Popconfirm>
          ) : (
            <Button type="link" icon={<UnlockOutlined />} onClick={() => handleToggleStatus(record.id, true)}>
              启用
            </Button>
          )}
          <Popconfirm
            title="确定重置该用户密码？"
            onConfirm={() => handleResetPassword(record.id)}
          >
            <Button type="link" icon={<KeyOutlined />}>
              重置密码
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>用户管理</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="搜索用户名或手机号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
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

export default UserListPage
