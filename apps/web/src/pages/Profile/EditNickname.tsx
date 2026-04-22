/**
 * 修改昵称 Modal
 */

import React, { useState, useEffect } from 'react'
import { Modal, Input, Form, message } from 'antd'
import { useUserProfileStore } from '../../stores/userProfile'

interface EditNicknameProps {
  open: boolean
  currentNickname: string
  onClose: () => void
}

const EditNickname: React.FC<EditNicknameProps> = ({ open, currentNickname, onClose }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { updateNickname } = useUserProfileStore()

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ nickname: currentNickname })
    }
  }, [open, currentNickname, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await updateNickname(values.nickname)
      message.success('昵称修改成功')
      onClose()
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message)
      }
      // 表单校验错误不提示
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="修改昵称"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="nickname"
          label="昵称"
          rules={[
            { required: true, message: '请输入昵称' },
            { min: 2, message: '昵称至少2个字符' },
            { max: 20, message: '昵称最多20个字符' },
            {
              pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/,
              message: '昵称只能包含中文、字母、数字或下划线',
            },
          ]}
        >
          <Input placeholder="请输入新昵称" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default EditNickname
