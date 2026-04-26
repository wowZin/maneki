/**
 * 回测分析页
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Typography, Row, Col } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import BacktestForm from './BacktestForm'
import BacktestProgress from './BacktestProgress'
import BacktestResult from './BacktestResult'
import BacktestHistory from './BacktestHistory'
import { backtestApi, BacktestProgressResponse, BacktestResponse, BacktestJob } from '../../services/backtest'

const { Title } = Typography

const POLL_INTERVAL = 3000 // 3秒轮询

const Backtest: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [progress, setProgress] = useState<BacktestProgressResponse | null>(null)
  const [result, setResult] = useState<BacktestResponse | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [historyJobs, setHistoryJobs] = useState<BacktestJob[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const agentIdParam = searchParams.get('agent_id')
  const preselectedAgentId = agentIdParam ? Number(agentIdParam) : undefined

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await backtestApi.getBacktests({ limit: 20, offset: 0 })
      setHistoryJobs(res.items as BacktestJob[])
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const fetchProgress = useCallback(async (jobId: number) => {
    try {
      const res = await backtestApi.getBacktestProgress(jobId)
      setProgress(res)
      return res.status
    } catch (err) {
      console.error('Failed to fetch progress:', err)
      return 'failed'
    }
  }, [])

  const fetchResult = useCallback(async (jobId: number) => {
    try {
      const res = await backtestApi.getBacktest(jobId)
      setResult(res)
      return res.status
    } catch (err) {
      console.error('Failed to fetch result:', err)
      return 'failed'
    }
  }, [])

  useEffect(() => {
    if (!activeJobId) {
      setProgress(null)
      setResult(null)
      return
    }

    setProgressLoading(true)
    fetchProgress(activeJobId).then(() => {
      setProgressLoading(false)
    })

    const interval = setInterval(async () => {
      const status = await fetchProgress(activeJobId)
      if (status === 'completed') {
        await fetchResult(activeJobId)
        clearInterval(interval)
        fetchHistory()
      } else if (status === 'failed') {
        clearInterval(interval)
        fetchHistory()
      }
    }, POLL_INTERVAL)

    return () => {
      clearInterval(interval)
    }
  }, [activeJobId, fetchProgress, fetchResult, fetchHistory])

  const handleBacktestCreated = (jobId: number) => {
    setActiveJobId(jobId)
    setResult(null)
    fetchHistory()
  }

  const handleRetry = () => {
    setActiveJobId(null)
    setProgress(null)
    setResult(null)
  }

  const handleSelectJob = (jobId: number) => {
    setActiveJobId(jobId)
    setResult(null)
    setProgress(null)
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <HistoryOutlined style={{ marginRight: 8 }} />
        回测分析
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <BacktestForm
            preselectedAgentId={preselectedAgentId}
            onBacktestCreated={handleBacktestCreated}
          />
        </Col>
        <Col xs={24} lg={8}>
          <BacktestHistory
            jobs={historyJobs}
            loading={historyLoading}
            onSelectJob={handleSelectJob}
          />
        </Col>
      </Row>

      {activeJobId && (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={16}>
            <BacktestProgress
              progress={progress}
              loading={progressLoading}
              onRetry={handleRetry}
            />
          </Col>
        </Row>
      )}

      {result?.result && (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={16}>
            <BacktestResult result={result.result} />
          </Col>
        </Row>
      )}
    </div>
  )
}

export default Backtest
