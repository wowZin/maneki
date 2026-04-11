"""
Agent 市场相关 Schema
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, ConfigDict


# ========== 基础配置 Schema ==========

class DataSourceConfig(BaseModel):
    """数据源配置"""
    source: str = Field(..., description="数据源标识: kline/indicator/news/fund")
    enabled: bool = Field(True, description="是否启用")
    config: Optional[Dict[str, Any]] = Field(None, description="数据源特定配置")


# ========== 支持的模型列表 ==========

class SupportedModels:
    """支持的模型列表（用于下拉选择）"""

    OPENAI = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
    ]

    ANTHROPIC = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ]

    DEEPSEEK = [
        "deepseek-chat",
        "deepseek-reasoner",
    ]

    @classmethod
    def get_all_models(cls) -> List[str]:
        """获取所有支持的模型"""
        return cls.OPENAI + cls.ANTHROPIC + cls.DEEPSEEK

    @classmethod
    def get_models_by_provider(cls, provider: str) -> List[str]:
        """根据提供商获取模型列表"""
        provider_map = {
            "openai": cls.OPENAI,
            "anthropic": cls.ANTHROPIC,
            "deepseek": cls.DEEPSEEK,
        }
        return provider_map.get(provider, [])


class ModelConfig(BaseModel):
    """模型配置"""
    model_config = ConfigDict(protected_namespaces=())

    provider: str = Field(..., description="提供商: openai/anthropic/deepseek/custom")
    base_url: Optional[str] = Field(None, description="API Base URL（可选，使用默认）")
    api_key: str = Field(..., description="API Key (前端传入，后端加密存储)")
    model_name: str = Field(..., description="模型名称（从支持的列表中选择）")
    temperature: float = Field(0.7, ge=0, le=2, description="温度")
    max_tokens: int = Field(2000, ge=100, le=8000, description="最大token数")
    timeout: int = Field(30, ge=5, le=120, description="超时秒数")

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        """验证模型名称是否在支持列表中"""
        supported = SupportedModels.get_all_models()
        if v not in supported:
            raise ValueError(f"不支持的模型: {v}，请从支持的列表中选择")
        return v

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        """验证提供商"""
        allowed = ["openai", "anthropic", "deepseek", "custom"]
        if v not in allowed:
            raise ValueError(f"不支持的提供商: {v}，可选: {', '.join(allowed)}")
        return v


class PromptConfig(BaseModel):
    """提示词配置"""
    system_prompt: str = Field(..., min_length=10, description="系统提示词")
    user_prompt_template: str = Field(..., min_length=10, description="用户提示词模板")
    variables: Optional[List[str]] = Field(None, description="模板变量列表")


# ========== Agent Template (市场) Schemas ==========

class AgentTemplateCreate(BaseModel):
    """创建 Agent 模板"""
    name: str = Field(..., min_length=2, max_length=50, description="模板名称")
    description: Optional[str] = Field(None, max_length=500, description="描述")
    category: str = Field("custom", description="分类")
    tags: Optional[List[str]] = Field(None, description="标签")
    is_public: bool = Field(False, description="是否公开")
    is_featured: bool = Field(False, description="是否精选(免费用户可用)")

    # 配置
    data_sources: List[DataSourceConfig] = Field(default_factory=list)
    prompt: PromptConfig = Field(...)
    llm_config: ModelConfig = Field(...)
    reasoning_config: Optional[Dict[str, Any]] = Field(None)


class AgentTemplateUpdate(BaseModel):
    """更新 Agent 模板"""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_featured: Optional[bool] = None

    data_sources: Optional[List[DataSourceConfig]] = None
    prompt: Optional[PromptConfig] = None
    llm_config: Optional[ModelConfig] = None
    reasoning_config: Optional[Dict[str, Any]] = None


class AgentTemplateResponse(BaseModel):
    """Agent 模板响应"""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]]

    is_public: bool
    is_featured: bool
    creator_id: Optional[UUID]

    usage_count: int
    rating: Decimal
    rating_count: int

    data_sources: List[DataSourceConfig]
    prompt: PromptConfig
    llm_config: ModelConfig
    reasoning_config: Optional[Dict[str, Any]]

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentTemplateListItem(BaseModel):
    """Agent 模板列表项"""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]]

    is_public: bool
    is_featured: bool
    creator_name: Optional[str]

    usage_count: int
    rating: Decimal
    rating_count: int

    is_favorited: bool = False
    is_cloned: bool = False
    can_use: bool = False  # 当前用户是否有权限使用

    created_at: datetime


class AgentTemplateFilter(BaseModel):
    """Agent 模板筛选"""
    category: Optional[str] = None
    search: Optional[str] = None
    sort_by: str = Field("rating", description="排序: rating/usage/created")
    sort_order: str = Field("desc", description="asc/desc")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ========== User Agent Schemas ==========

class UserAgentCreate(BaseModel):
    """创建用户 Agent"""
    name: str = Field(..., min_length=2, max_length=50, description="Agent名称")
    description: Optional[str] = Field(None, max_length=500)
    category: str = Field("custom", description="分类")
    icon: Optional[str] = None
    color: Optional[str] = None

    # 配置
    data_sources: List[DataSourceConfig] = Field(default_factory=list)
    prompt: PromptConfig = Field(...)
    llm_config: ModelConfig = Field(...)
    reasoning_config: Optional[Dict[str, Any]] = None

    # 权重设置
    manual_weight_score: int = Field(100, ge=0, le=100)
    use_manual_weight: bool = Field(False)


class UserAgentCloneRequest(BaseModel):
    """从模板克隆 Agent

    用户可以修改：
    - name: 新名称
    - description: 新描述
    - llm_config: 模型配置（允许使用自己的 API Key 和模型）
    - other: 其他自定义配置
    """
    name: Optional[str] = Field(None, min_length=2, max_length=50, description="新名称（默认使用模板名）")
    llm_config: Optional[ModelConfig] = Field(None, description="自定义模型配置（可选，覆盖模板配置）")
    customizations: Optional[Dict[str, Any]] = Field(None, description="其他自定义修改")


class UserAgentUpdate(BaseModel):
    """更新用户 Agent"""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

    data_sources: Optional[List[DataSourceConfig]] = None
    prompt: Optional[PromptConfig] = None
    llm_config: Optional[ModelConfig] = None
    reasoning_config: Optional[Dict[str, Any]] = None

    manual_weight_score: Optional[int] = Field(None, ge=0, le=100)
    use_manual_weight: Optional[bool] = None

    is_active: Optional[bool] = None
    is_favorite: Optional[bool] = None
    sort_order: Optional[int] = None


class UserAgentWeightUpdate(BaseModel):
    """更新 Agent 权重分"""
    manual_weight_score: int = Field(..., ge=0, le=100, description="手动权重分")
    use_manual_weight: bool = Field(..., description="是否使用手动权重")


class UserAgentResponse(BaseModel):
    """用户 Agent 响应"""
    model_config = ConfigDict(protected_namespaces=())

    id: UUID
    agent_key: str
    name: str
    description: Optional[str]
    category: str
    icon: Optional[str]
    color: Optional[str]

    # 配置
    data_sources: List[DataSourceConfig]
    prompt: PromptConfig
    llm_config: Dict[str, Any]  # 脱敏后的模型配置
    reasoning_config: Optional[Dict[str, Any]]

    # 权重
    current_weight: int = Field(..., description="当前有效权重分")
    manual_weight_score: int
    use_manual_weight: bool
    auto_weight_score: int

    # 状态
    is_active: bool
    is_favorite: bool
    is_at_risk: bool
    is_available: bool

    # 统计
    total_signals: int
    success_count: int
    failure_count: int
    success_rate: Optional[Decimal]
    last_signal_at: Optional[datetime]

    # 来源
    template_id: Optional[UUID]
    template_name: Optional[str]

    sort_order: int
    created_at: datetime
    updated_at: datetime

    @field_validator("llm_config", mode="before")
    @classmethod
    def mask_api_key(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """脱敏 API Key"""
        if not v:
            return v
        result = v.copy()
        api_key = result.get("api_key", "")
        if api_key:
            # 脱敏显示：保留前4位和后4位，中间用****代替
            if len(api_key) > 8:
                result["api_key"] = f"{api_key[:4]}****{api_key[-4:]}"
            else:
                result["api_key"] = "****"
        return result

    model_config = ConfigDict(from_attributes=True)


class UserAgentListItem(BaseModel):
    """用户 Agent 列表项"""
    id: UUID
    agent_key: str
    name: str
    category: str
    icon: Optional[str]
    color: Optional[str]

    current_weight: int
    is_active: bool
    is_favorite: bool
    is_at_risk: bool

    total_signals: int
    success_rate: Optional[Decimal]
    last_signal_at: Optional[datetime]

    sort_order: int
    created_at: datetime


class UserAgentPublicResponse(BaseModel):
    """用户 Agent 公开响应（用于非 owner 查看，隐藏敏感信息）"""
    id: UUID
    agent_key: str
    name: str
    description: Optional[str]
    category: str
    icon: Optional[str]
    color: Optional[str]

    # 公开配置（隐藏提示词）
    data_sources: List[DataSourceConfig]
    # 提示词被隐藏
    llm_config: Dict[str, Any]  # 模型配置可以查看/修改
    reasoning_config: Optional[Dict[str, Any]]

    # 权重
    current_weight: int
    manual_weight_score: int
    use_manual_weight: bool
    auto_weight_score: int

    # 状态
    is_active: bool
    is_favorite: bool
    is_at_risk: bool
    is_available: bool

    # 统计
    total_signals: int
    success_count: int
    failure_count: int
    success_rate: Optional[Decimal]
    last_signal_at: Optional[datetime]

    # 来源
    template_id: Optional[UUID]
    template_name: Optional[str]

    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserAgentFilter(BaseModel):
    """用户 Agent 筛选"""
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_favorite: Optional[bool] = None
    search: Optional[str] = None


# ========== Agent 市场评价 Schemas ==========

class AgentMarketReviewCreate(BaseModel):
    """创建评价"""
    template_id: UUID
    rating: int = Field(..., ge=1, le=5, description="总体评分 1-5")
    comment: Optional[str] = Field(None, max_length=1000, description="评论")
    # 维度评分（可选）
    accuracy_rating: Optional[int] = Field(None, ge=1, le=5, description="准确性评分")
    speed_rating: Optional[int] = Field(None, ge=1, le=5, description="响应速度评分")
    usability_rating: Optional[int] = Field(None, ge=1, le=5, description="易用性评分")
    # 标签
    tags: Optional[List[str]] = Field(None, description="评价标签")


class AgentMarketReviewResponse(BaseModel):
    """评价响应"""
    id: int
    template_id: UUID
    user_id: UUID
    username: str
    rating: int
    comment: Optional[str]
    # 维度评分
    accuracy_rating: Optional[int]
    speed_rating: Optional[int]
    usability_rating: Optional[int]
    # 标签
    tags: Optional[List[str]]
    # 帮助度
    helpful_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentTemplateRatingStatsResponse(BaseModel):
    """评分统计响应"""
    template_id: UUID
    avg_rating: Decimal
    rating_count: int
    rating_distribution: Dict[str, int]
    # 维度评分
    avg_accuracy: Optional[Decimal]
    avg_speed: Optional[Decimal]
    avg_usability: Optional[Decimal]
    # 排名分数
    composite_score: Decimal
    hot_score: Decimal
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentRankingItem(BaseModel):
    """排名列表项"""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    creator_name: Optional[str]
    # 评分
    avg_rating: Decimal
    rating_count: int
    composite_score: Decimal
    hot_score: Decimal
    # 统计
    usage_count: int
    is_featured: bool
    is_public: bool
    created_at: datetime


# ========== 决策相关 Schemas ==========

class AgentVoteInput(BaseModel):
    """Agent 投票输入"""
    agent_id: UUID = Field(..., description="Agent ID")
    decision: str = Field(..., description="决策: buy/sell/hold")
    confidence: float = Field(..., ge=0, le=1)
    reasoning: Optional[str] = None


class AgentVoteResult(BaseModel):
    """Agent 投票结果"""
    model_config = ConfigDict(protected_namespaces=())

    agent_id: UUID
    agent_name: str
    agent_key: str
    decision: str
    confidence: float
    reasoning: Optional[str]
    weight_contribution: float = Field(..., description="权重贡献值")

    # 快照
    weight_score: int
    model_used: str
    inference_time_ms: Optional[int]


class WeightedDecisionRequest(BaseModel):
    """加权决策请求"""
    stock_code: str = Field(..., description="股票代码")

    # 可选：只使用指定 Agent
    agent_ids: Optional[List[UUID]] = Field(None, description="指定 Agent 列表")

    # 决策算法参数
    temperature: float = Field(1.0, ge=0.1, le=5.0)
    randomness: float = Field(0.1, ge=0, le=1.0)
    min_confidence: float = Field(0.5, ge=0, le=1.0, description="最低置信度阈值")

    # 输入数据（如果不传，后端自动获取）
    input_data: Optional[Dict[str, Any]] = Field(None, description="输入数据")


class WeightedDecisionResponse(BaseModel):
    """加权决策响应"""
    # 决策结果
    final_decision: str = Field(..., description="最终决策")
    confidence: float = Field(..., description="置信度")

    # 投票详情
    total_votes: int
    vote_breakdown: Dict[str, int] = Field(..., description="各选项票数")
    weighted_scores: Dict[str, float] = Field(..., description="各选项加权得分")

    # Agent 贡献
    agent_votes: List[AgentVoteResult]

    # 元信息
    algorithm_version: str
    execution_time_ms: int
    market_data_time: Optional[datetime]


# ========== 历史记录 Schemas ==========

class UserAgentHistoryResponse(BaseModel):
    """用户 Agent 历史响应"""
    date: str
    rank: int
    total_active_agents: int

    daily_signals: int
    daily_success: int
    daily_failure: int
    daily_success_rate: Optional[float]

    score_before: int
    score_after: int
    score_change: int
    adjustment_reason: str


class UserAgentStats(BaseModel):
    """用户 Agent 统计"""
    total_agents: int
    active_agents: int
    at_risk_agents: int

    avg_weight_score: float
    total_signals_generated: int
    overall_success_rate: Optional[float]

    top_performers: List[Dict[str, Any]]
    at_risk_agents_list: List[Dict[str, Any]]

    # VIP信息
    is_vip: bool = False
    vip_level: int = 0
    vip_expire_at: Optional[str] = None


# ========== 初始化 Schemas ==========

class DefaultAgentTemplate(BaseModel):
    """默认 Agent 模板"""
    agent_key: str
    name: str
    description: str
    category: str
    icon: str
    color: str
    data_sources: List[str]
    system_prompt: str
    user_prompt_template: str


class InitializeUserAgentsRequest(BaseModel):
    """初始化用户默认 Agent"""
    use_default_set: bool = Field(True, description="使用默认 Agent 套装")
    custom_agents: Optional[List[DefaultAgentTemplate]] = None
