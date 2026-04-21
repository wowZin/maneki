/**
 * 管理员设置页面 - 超级管理员专用
 */

import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, message, Tag, Space, Popconfirm, Card } from 'antd'
import { PlusOutlined, LockOutlined, UnlockOutlined, SafetyOutlined , InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminApi, Admin } from '../../api/admin'

const AdminListPage: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const fetchAdmins = async () => {
    setLoading(true)
    try {
      const res = await adminApi.list({ page, page_size: pageSize })
      if (res.data.code === 0) {
        setAdmins(res.data.data.list)
        setTotal(res.data.data.total)
      }
    } catch {
      message.error('获取管理员列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [page, pageSize])

  const handleCreate = async (values: { name: string }) => {
    try {
      const res = await adminApi.create(values.name)
      if (res.data.code === 0) {
        message.success('管理员创建成功，初始密码为 111111')
        setModalVisible(false)
        form.resetFields()
        fetchAdmins()
      } else {
        message.error(res.data.message || '创建失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败')
    }
  }

  const handleToggleStatus = async (id: number, enable: boolean) => {
    try {
      const res = enable ? await adminApi.enable(id) : await adminApi.disable(id)
      if (res.data.code === 0) {
        message.success(enable ? '启用成功' : '禁用成功')
        fetchAdmins()
      } else {
        message.error(res.data.message || '操作失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '账户名称', dataIndex: 'name' },
    {
      title: '角色', dataIndex: 'role',
      render: (role: string) => <Tag color={role === 'super' ? 'red' : 'blue'}>{role === 'super' ? '超级管理员' : '管理员'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'is_active',
      render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? '启用' : '禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '最后登录', dataIndex: 'last_login_at', render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: Admin) => (
        <Space>
          {record.role !== 'super' && (
            <>
              {record.is_active ? (
                <Popconfirm title="确定禁用该管理员？" onConfirm={() => handleToggleStatus(record.id, false)}>
                  <Button type="link" danger icon={<LockOutlined />}>禁用</Button>
                </Popconfirm>
              ) : (
                <Button type="link" icon={<UnlockOutlined />} onClick={() => handleToggleStatus(record.id, true)}>启用</Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <SafetyOutlined />
            </span>
            管理员设置
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1.5">
            <InfoCircleOutlined />
            管理平台管理员账户与权限</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)} className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none">
          创建管理员
        </Button>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={admins}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps || 20) },
          }}
        />
      </Card>

      <Modal title="创建管理员" open={modalVisible} onCancel={() => { setModalVisible(false); form.resetFields() }} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="账户名称" rules={[
            { required: true, message: '请输入账户名称' },
            { min: 3, message: '至少3个字符' },
            { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '只能包含字母、数字、下划线，且不能以数字开头' },
          ]}>
            <Input placeholder="请输入账户名称" />
          </Form.Item>
          <p className="text-[var(--color-text-tertiary)] text-sm">初始密码固定为：111111，首次登录需强制修改</p>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminListPage
