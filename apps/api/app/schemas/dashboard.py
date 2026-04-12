"""
看板数据Schema - 支持用户维度隔离和多维度对比
"""
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from uuid import UUID


class UserAgentStats(BaseModel):
    """用户的单个Agent统计"""
    agent_id: str              # Agent唯一标识
    agent_name: str            # Agent名称
    agent_type: str            # Agent类型
    is_custom: bool            # 是否是自定义Agent
    is_active: bool            # 是否激活

    # 基础统计
    total_predictions: int
    success_count: int
    fail_count: int
    success_rate: float
    avg_confidence: float
    avg_return: Optional[float] = None

    # 决策分布
    decision_distribution: Dict[str, int]  # strong_buy/buy/hold/sell/strong_sell

    # 多维度统计（新增）
    market_condition_stats: Dict[str, Dict]  # 市场环境维度
    sector_stats: List[Dict]                 # 板块维度
    time_of_day_stats: Dict[str, Dict]      # 时间段维度
    confidence_level_stats: Dict[str, Dict]  # 信号强度维度

    daily_stats: List[Dict[str, Any]]


class MarketConditionStats(BaseModel):
    """市场环境统计"""
    condition: str           # bull/bear/sideways
    condition_name: str      # 牛市/熊市/震荡市
    predictions: int
    success_count: int
    success_rate: float


class SectorStats(BaseModel):
    """板块统计"""
    sector_code: str
    sector_name: str
    predictions: int
    success_count: int
    success_rate: float


class TimeOfDayStats(BaseModel):
    """时间段统计"""
    time_period: str         # morning/afternoon/close
    period_name: str         # 早盘/午盘/尾盘
    predictions: int
    success_count: int
    success_rate: float


class ConfidenceLevelStats(BaseModel):
    """信号强度统计"""
    level: str               # high/medium/low
    level_name: str          # 高/中/低置信度
    min_confidence: float
    max_confidence: float
    predictions: int
    success_count: int
    success_rate: float


class UserDashboardSummary(BaseModel):
    """用户看板汇总"""
    user_id: UUID
    selected_date: date

    # 基础统计
    total_predictions: int
    success_count: int
    success_rate: float
    compared_to_prev: float

    # Agent维度
    agent_count: int
    active_agent_count: int
    best_agent: Optional[UserAgentStats] = None
    worst_agent: Optional[UserAgentStats] = None
    agent_ranking: List[UserAgentStats]

    # 多维度汇总（新增）
    market_condition_summary: List[MarketConditionStats]
    top_sectors: List[SectorStats]          # Top 5 板块
    time_of_day_summary: List[TimeOfDayStats]
    confidence_level_summary: List[ConfidenceLevelStats]


class MultiDimensionTrend(BaseModel):
    """多维度趋势数据"""
    dates: List[str]

    # 基础趋势
    overall_success_rates: List[float]
    prediction_counts: List[int]

    # 市场环境趋势
    market_condition_trends: Dict[str, List[float]]  # bull/bear/sideways -> rates

    # 时间段趋势
    time_of_day_trends: Dict[str, List[float]]       # morning/afternoon/close -> rates

    # Agent趋势
    agent_trends: Dict[str, List[float]]


class DimensionComparison(BaseModel):
    """维度对比"""
    dimension_name: str      # 市场环境/板块/时间段
    dimension_key: str
    current_rate: float
    avg_rate: float
    best_value: str          # 该维度下表现最好的值
    best_rate: float
    worst_value: str
    worst_rate: float
    insight: str             # 洞察建议


class UserDashboardResponse(BaseModel):
    """用户看板完整响应"""
    summary: UserDashboardSummary
    trend_data: MultiDimensionTrend

    # 多维度对比（新增）
    dimension_comparisons: List[DimensionComparison]

    available_dates: List[str]
    user_agents: List[Dict[str, Any]]


class AgentDetailRequest(BaseModel):
    """Agent详细数据查询请求"""
    agent_id: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AgentDetailResponse(BaseModel):
    """Agent详细数据响应"""
    agent_id: str
    agent_name: str
    agent_type: str
    is_custom: bool

    # 时间范围统计
    total_predictions: int
    success_count: int
    success_rate: float

    # 多维度详情
    market_condition_details: List[MarketConditionStats]
    sector_details: List[SectorStats]
    time_of_day_details: List[TimeOfDayStats]
    confidence_level_details: List[ConfidenceLevelStats]

    # 按股票统计
    stock_stats: List[Dict[str, Any]]

    # 时间序列
    daily_records: List[Dict[str, Any]]

    # 信号分析
    signal_distribution: Dict[str, int]
    confidence_distribution: Dict[str, int]

    # 改进建议（新增）
    improvement_suggestions: List[str]
