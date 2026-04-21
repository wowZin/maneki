/**
 * 新增 Agent 表单页
 */

import React, { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  message,
  Row,
  Col,
  Tabs,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/services/admin'

const { TextArea } = Input

// 简单的 Markdown 转 HTML（仅用于预览）
const markdownToHtml = (md: string): string => {
  if (!md) return ''
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code style="background:#f5f5f5;padding:2px 4px;border-radius:4px;">$1</code>')
    .replace(/```([\s\S]*?)```/gim, '<pre style="background:#f5f5f5;padding:12px;border-radius:8px;overflow:auto;"><code>$1</code></pre>')
    .replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gim, '<ul style="padding-left:20px;">$&</ul>')
    .replace(/\n/gim, '<br>')
}

const AgentCreate: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [previewKey, setPreviewKey] = useState('edit')
  const [promptValue, setPromptValue] = useState('')

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true)
      await adminApi.createAgent(values)
      message.success('Agent 创建成功')
      navigate('/agents')
    } catch (error: any) {
      const msg = error?.response?.data?.error || '创建失败'
      if (msg.includes('already exists')) {
        message.error('Agent 名称已存在，请更换')
      } else {
        message.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const validateName = async (_: any, value: string) => {
    if (!value) return Promise.resolve()
    if (value.length > 30) {
      return Promise.reject(new Error('Agent 名称不能超过 30 个字符'))
    }
    return Promise.resolve()
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/agents')}
            style={{ marginRight: 12 }}
          >
            返回列表
          </Button>
          <span style={{ fontSize: 20, fontWeight: 'bold' }}>新增 Agent</span>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={() => form.submit()}
          >
            保存
          </Button>
        </Col>
      </Row>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 720 }}
        >
          <Form.Item
            name="name"
            label="Agent 名称"
            rules={[
              { required: true, message: '请输入 Agent 名称' },
              { validator: validateName },
            ]}
            extra="不超过 30 个字符，创建后不可修改"
          >
            <Input
              placeholder="例如：趋势跟踪专家"
              maxLength={30}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="功能描述"
            rules={[{ max: 300, message: '功能描述不能超过 300 个字符' }]}
          >
            <TextArea
              rows={3}
              placeholder="简要描述该 Agent 的核心功能和适用场景"
              maxLength={300}
              showCount
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="类型"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select
                  placeholder="请选择"
                  options={[
                    { label: '技术面', value: 'technical' },
                    { label: '基本面', value: 'fundamental' },
                    { label: '情绪面', value: 'sentiment' },
                    { label: '资金面', value: 'capital' },
                    { label: '决策', value: 'decision' },
                    { label: '自定义', value: 'custom' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select
                  allowClear
                  placeholder="请选择"
                  options={[
                    { label: '趋势', value: 'trend' },
                    { label: '量能', value: 'volume' },
                    { label: '突破', value: 'breakout' },
                    { label: '情绪', value: 'sentiment' },
                    { label: '自定义', value: 'custom' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="model"
            label="模型选择"
            extra="后续可根据需要扩展更多模型"
          >
            <Select
              allowClear
              placeholder="请选择 LLM 模型"
              options={[
                { label: 'Qwen-Turbo', value: 'qwen-turbo' },
                { label: 'Qwen-Plus', value: 'qwen-plus' },
                { label: 'Qwen-Max', value: 'qwen-max' },
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="prompt"
            label="提示词（Prompt）"
            rules={[{ required: true, message: '请输入提示词' }]}
          >
            <Tabs
              activeKey={previewKey}
              onChange={setPreviewKey}
              items={[
                {
                  key: 'edit',
                  label: '编辑',
                  children: (
                    <TextArea
                      rows={12}
                      placeholder="在此输入 Agent 的系统提示词，支持 Markdown 格式..."
                      value={promptValue}
                      onChange={(e) => {
                        setPromptValue(e.target.value)
                        form.setFieldValue('prompt', e.target.value)
                      }}
                      style={{ fontFamily: 'monospace' }}
                    />
                  ),
                },
                {
                  key: 'preview',
                  label: '预览',
                  children: (
                    <div
                      style={{
                        minHeight: 280,
                        padding: 12,
                        border: '1px solid #d9d9d9',
                        borderRadius: 8,
                        background: '#fafafa',
                        overflow: 'auto',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(promptValue) || '<span style="color:#999">暂无内容</span>',
                      }}
                    />
                  ),
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default AgentCreate
