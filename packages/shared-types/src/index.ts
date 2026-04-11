// 股票基础类型
export interface Stock {
  code: string;
  name: string;
  market: 'SH' | 'SZ' | 'BJ';
  industry?: string;
  listDate?: string;
}

// K线数据类型
export interface KLineData {
  time: string;
  code: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// 技术指标类型
export interface Indicator {
  time: string;
  code: string;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  macdDif?: number;
  macdDea?: number;
  macdHist?: number;
  kdjK?: number;
  kdjD?: number;
  kdjJ?: number;
  rsi6?: number;
  rsi12?: number;
  rsi24?: number;
}

// 信号类型
export type SignalType = 'buy' | 'sell' | 'watch' | 'alert';

export interface Signal {
  id: string;
  createdAt: string;
  code: string;
  signalType: SignalType;
  confidence: number;
  triggerPrice?: number;
  reason?: string;
  agentsVotes?: Record<string, AgentVote>;
}

// Agent投票
export interface AgentVote {
  agentType: string;
  decision: 'buy' | 'sell' | 'hold';
  score: number;
  reasoning?: string;
  weight: number;
}

// Agent决策
export interface AgentDecision {
  signalId: string;
  agentType: string;
  decision: 'buy' | 'sell' | 'hold';
  score: number;
  reasoning?: string;
  weight: number;
}

// 复盘结果
export interface ReplayResult {
  id: string;
  tradeDate: string;
  signalId: string;
  code: string;
  entryPrice: number;
  targetPrice?: number;
  stopLossPrice?: number;
  maxPrice: number;
  minPrice: number;
  closePrice: number;
  maxReturnPct: number;
  actualReturnPct: number;
  success: boolean;
  successType?: 'limit_up' | 'target_reached' | 'time_exit';
  failureReason?: 'fake_breakout' | 'reverse' | 'black_swan' | 'other';
  failureAnalysis?: string;
}

// WebSocket消息类型
export type WebSocketMessageType =
  | 'kline_update'
  | 'signal_new'
  | 'signal_update'
  | 'indicator_update'
  | 'market_status';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  timestamp: string;
  data: T;
}

// API响应类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 监控配置
export interface MonitorConfig {
  stockCount: number;
  signalThreshold: number;
  dataCollectionInterval: number;
  replayTime: string;
}
