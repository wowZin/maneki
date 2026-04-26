import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Row, Col, message } from 'antd'
import type { SignalItem } from '../../services/signal'
import { signalApi } from '../../services/signal'
import SignalList from './SignalList'
import MyStats from './MyStats'
import MyFollows from './MyFollows'

const POLLING_INTERVAL = 15000 // 15秒轮询

const SignalCenter: React.FC = () => {
  const [signals, setSignals] = useState<SignalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestId, setLatestId] = useState<number | undefined>(undefined)
  const [followLoading, setFollowLoading] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSignals = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true)
    setError(null)
    try {
      const res = await signalApi.getSignals(20, isPolling ? latestId : undefined)
      if (isPolling && latestId && res.items.length > 0) {
        const newItems = res.items.map((item) => ({ ...item, is_new: true }))
        setSignals((prev) => {
          const combined = [...newItems, ...prev]
          return combined.slice(0, 50)
        })
      } else {
        setSignals(res.items)
      }
      if (res.latest_id) {
        setLatestId(res.latest_id)
      }
    } catch (e: any) {
      if (!isPolling) {
        setError(e?.response?.data?.error?.message || '加载失败')
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [latestId])

  useEffect(() => {
    fetchSignals()
    intervalRef.current = setInterval(() => fetchSignals(true), POLLING_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchSignals])

  const handleFollow = async (id: number) => {
    setFollowLoading(id)
    try {
      await signalApi.followSignal(id)
      message.success('关注成功')
      setSignals((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_followed: true } : s))
      )
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || '关注失败'
      message.error(msg)
    } finally {
      setFollowLoading(null)
    }
  }

  const handleUnfollow = async (id: number) => {
    setFollowLoading(id)
    try {
      await signalApi.unfollowSignal(id)
      message.success('已取消关注')
      setSignals((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_followed: false } : s))
      )
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || '取消关注失败'
      message.error(msg)
    } finally {
      setFollowLoading(null)
    }
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <SignalList
            signals={signals}
            loading={loading}
            error={error}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            followLoading={followLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <MyStats />
          <MyFollows />
        </Col>
      </Row>
    </div>
  )
}

export default SignalCenter
