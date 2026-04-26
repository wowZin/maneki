import React from 'react'
import { Card, List, Tag, Typography, Space, Button, Empty, Spin } from 'antd'
import { HistoryOutlined, EyeOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { BacktestJob } from '../../services/backtest'

const { Title, Text } = Typography

interface BacktestHistoryProps {
  jobs: BacktestJob[]
  loading: boolean
  onSelectJob: (jobId: number) => void
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
}

const BacktestHistory: React.FC<BacktestHistoryProps> = ({ jobs, loading, onSelectJob }) => {
  if (loading) {
    return (
      <Card className="glass-card">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card className="glass-card">
        <Empty description="暂无回测记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          回测历史
        </Title>

        <List
          dataSource={jobs}
          renderItem={(job) => {
            const status = statusMap[job.status] || { label: job.status, color: 'default' }
            const params = job.params || { start_date: '', end_date: '' }
            return (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => onSelectJob(job.id)}
                  >
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>Agent #{job.agent_id}</Text>
                      <Tag color={status.color}>{status.label}</Tag>
                    </Space>
                  }
                  description={
                    <Space size={16}>
                      <Text type="secondary">
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {params.start_date} ~ {params.end_date}
                      </Text>
                      <Text type="secondary">进度: {job.progress}%</Text>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Space>
    </Card>
  )
}

export default BacktestHistory
