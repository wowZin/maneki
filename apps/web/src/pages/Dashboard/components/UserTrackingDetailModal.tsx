import React, { useState, useEffect } from 'react'
import { Modal, Table, Tag, Spin, Empty, Typography } from 'antd'
import { overviewApi, type UserTrackingDetailItem } from '../../../services/overview'

const { Text } = Typography

interface UserTrackingDetailModalProps {
  visible: boolean
  date: string | null
  onClose: () => void
}

const UserTrackingDetailModal: React.FC<UserTrackingDetailModalProps> = ({ visible, date, onClose }) => {
  const [data, setData] = useState<UserTrackingDetailItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const fetchData = async (page: number = 1) => {
    if (!date) return
    setLoading(true)
    setError(null)
    try {
      const res = await overviewApi.getUserTrackingDetail(date, page, pagination.pageSize)
      setData(res.items)
      setPagination({ current: page, pageSize: res.pagination.page_size, total: res.pagination.total })
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && date) {
      fetchData(1)
    }
  }, [visible, date])

  const columns = [
    {
      title: '股票代码',
      dataIndex: 'stock_code',
      key: 'stock_code',
      render: (code: string, record: UserTrackingDetailItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{code}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.stock_name}</Text>
        </div>
      ),
    },
    {
      title: '涨停状态',
      dataIndex: 'hit_status',
      key: 'hit_status',
      render: (status: boolean | null) => {
        if (status === null) return <Tag color="default">待复盘</Tag>
        return status ? <Tag color="success">涨停</Tag> : <Tag color="error">未涨停</Tag>
      },
    },
    {
      title: '涨跌幅',
      dataIndex: 'change_pct',
      key: 'change_pct',
      render: (pct: number) => (
        <span style={{ color: pct >= 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '收盘价',
      dataIndex: 'close_price',
      key: 'close_price',
      render: (price: number) => price.toFixed(2),
    },
  ]

  return (
    <Modal
      title={`${date} 选中股票明细`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      bodyStyle={{ padding: '16px 24px' }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <Empty description={error} />
      ) : data.length === 0 ? (
        <Empty description="当日无追踪记录" />
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="stock_code"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => fetchData(page),
          }}
          size="small"
        />
      )}
    </Modal>
  )
}

export default UserTrackingDetailModal
