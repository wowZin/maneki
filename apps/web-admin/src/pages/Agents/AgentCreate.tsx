/**
 * 新增 Agent 表单页
 */

import React, { useState } from 'react'
import { Card, Form, Input, Select, Button, message, Row, Col, Tabs } from 'antd'
import { ArrowLeftOutlined, SaveOutlined, RobotOutlined } from '@ant-design/icons'
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
    .replace(/`([^`]+)`/gim, '<code class="bg-[var(--color-bg-tertiary)] px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-auto text-sm"><code>$1</code></pre>')
    .replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gim, '<ul class="pl-5 list-disc">$&</ul>')
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
    if (value.length > 30) return Promise.reject(new Error('Agent 名称不能超过 30 个字符'))
    return Promise.resolve()
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/agents')}>返回列表</Button>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight m-0 flex items-center gap-3">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white text-base flex items-center justify-center">
              <RobotOutlined />
            </span>
            新增 Agent
          </h1>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={() => form.submit()}
          className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] !border-none"
        >
          保存
        </Button>
      </div>

      <Card className="rounded-[var(--radius-lg)] border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="max-w-3xl">
          <Form.Item name="name" label="Agent 名称" rules={[{ required: true, message: '请输入 Agent 名称' }, { validator: validateName }]} extra="不超过 30 个字符，创建后不可修改">
            <Input placeholder="例如：趋势跟踪专家" maxLength={30} showCount />
          </Form.Item>

          <Form.Item name="description" label="功能描述" rules={[{ max: 300, message: '功能描述不能超过 300 个字符' }]}>
            <TextArea rows={3} placeholder="简要描述该 Agent 的核心功能和适用场景" maxLength={300} showCount />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select placeholder="请选择" options={[
                  { label: '技术面', value: 'technical' },
                  { label: '基本面', value: 'fundamental' },
                  { label: '情绪面', value: 'sentiment' },
                  { label: '资金面', value: 'capital' },
                  { label: '决策', value: 'decision' },
                  { label: '自定义', value: 'custom' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select allowClear placeholder="请选择" options={[
                  { label: '趋势', value: 'trend' },
                  { label: '量能', value: 'volume' },
                  { label: '突破', value: 'breakout' },
                  { label: '情绪', value: 'sentiment' },
                  { label: '自定义', value: 'custom' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="model" label="模型选择" extra="后续可根据需要扩展更多模型">
            <Select allowClear placeholder="请选择 LLM 模型" options={[
              { label: 'Qwen-Turbo', value: 'qwen-turbo' },
              { label: 'Qwen-Plus', value: 'qwen-plus' },
              { label: 'Qwen-Max', value: 'qwen-max' },
              { label: 'GPT-4o', value: 'gpt-4o' },
              { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
            ]} />
          </Form.Item>

          <Form.Item name="prompt" label="提示词（Prompt）" rules={[{ required: true, message: '请输入提示词' }]}>
            <Tabs activeKey={previewKey} onChange={setPreviewKey} items={[
              {
                key: 'edit', label: '编辑',
                children: (
                  <TextArea
                    rows={12}
                    placeholder="在此输入 Agent 的系统提示词，支持 Markdown 格式..."
                    value={promptValue}
                    onChange={(e) => { setPromptValue(e.target.value); form.setFieldValue('prompt', e.target.value) }}
                    className="font-mono"
                  />
                ),
              },
              {
                key: 'preview', label: '预览',
                children: (
                  <div
                    className="min-h-[280px] p-3 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(promptValue) || '<span class="text-[var(--color-text-tertiary)]">暂无内容</span>' }}
                  />
                ),
              },
            ]} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default AgentCreate
