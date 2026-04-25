/**
 * 简单错误边界 - 捕获渲染错误并显示
 */

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444' }}>页面渲染出错</h2>
          <pre
            style={{
              background: '#f8fafc',
              padding: 16,
              borderRadius: 8,
              textAlign: 'left',
              overflow: 'auto',
              maxWidth: 800,
              margin: '20px auto',
              fontSize: 13,
            }}
          >
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
