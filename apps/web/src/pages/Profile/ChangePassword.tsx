/**
 * 修改密码 Modal
 */

import React, { useState } from 'react'
import { Modal, Input, Form, message } from 'antd'
import { userApi } from '../../services/user'

interface ChangePasswordProps {
  open: boolean
  onClose: () => void
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ open, onClose }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (values.new_password !== values.confirm_password) {
        message.error('两次输入的新密码不一致')
        return
      }
      setLoading(true)
      await userApi.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      message.success('密码修改成功')
      form.resetFields()
      onClose()
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="确认修改"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="old_password"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password placeholder="请输入当前密码" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少6位' },
          ]}
        >
          <Input.Password placeholder="请输入新密码（至少6位）" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="确认新密码"
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ChangePassword
