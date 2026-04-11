/**
 * SSE (Server-Sent Events) 服务
 * 用于接收后端决策通知推送
 */

import type { Signal } from '@maneki/shared-types';

type SignalCallback = (signal: Signal) => void;
type ConnectionCallback = (connected: boolean) => void;

class SSEService {
  private eventSource: EventSource | null = null;
  private signalCallbacks: SignalCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url: string = '/sse/signals') {
    this.url = url;
  }

  /**
   * 连接到 SSE 端点
   */
  connect(): void {
    if (this.eventSource) {
      console.warn('SSE 已连接');
      return;
    }

    console.log('正在连接 SSE...');

    this.eventSource = new EventSource(this.url);

    // 连接成功
    this.eventSource.onopen = () => {
      console.log('SSE 连接成功');
      this.notifyConnectionChange(true);
    };

    // 接收信号事件
    this.eventSource.addEventListener('signal', (event) => {
      try {
        const signal: Signal = JSON.parse(event.data);
        console.log('收到决策信号:', signal);
        this.notifySignal(signal);
      } catch (error) {
        console.error('解析信号数据失败:', error);
      }
    });

    // 心跳保活（可选，浏览器自动处理）
    this.eventSource.addEventListener('ping', () => {
      console.debug('SSE 心跳');
    });

    // 错误处理（浏览器会自动重连，这里只是记录日志）
    this.eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      this.notifyConnectionChange(false);
      // EventSource 会自动尝试重连，无需手动处理
    };
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.notifyConnectionChange(false);
      console.log('SSE 连接已断开');
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 订阅信号通知
   */
  onSignal(callback: SignalCallback): () => void {
    this.signalCallbacks.push(callback);
    return () => {
      this.signalCallbacks = this.signalCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 订阅连接状态变化
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  private notifySignal(signal: Signal): void {
    this.signalCallbacks.forEach(callback => {
      try {
        callback(signal);
      } catch (error) {
        console.error('信号回调执行失败:', error);
      }
    });
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('连接状态回调执行失败:', error);
      }
    });
  }
}

// 单例实例
export const sseService = new SSEService();

// 导出类以便测试或创建多个实例
export { SSEService };
