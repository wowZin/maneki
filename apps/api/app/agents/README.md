# 多Agent决策系统

## 概述

本模块实现了多Agent协同决策系统，每个Agent都有自己的特色系统提示词，根据上游提供的股票代码，获取相关信息来辅助涨停判断。

## 架构设计

### 1. Agent基类 (`base/agent.py`)

所有Agent必须继承`BaseAgent`类，实现以下核心方法：

- `get_system_prompt()`: 返回Agent特色的系统提示词
- `gather_information()`: 根据股票代码获取相关信息
- `analyze()`: 执行分析并返回决策结果

**决策类型枚举**：
- `strong_buy`: 强烈推荐买入（涨停概率>80%）
- `buy`: 推荐买入（涨停概率>60%）
- `hold`: 观望（涨停概率40-60%）
- `sell`: 建议卖出（涨停概率<40%）
- `strong_sell`: 强烈建议卖出（涨停概率<20%）
- `abstain`: 放弃（信息不足）

### 2. 具体Agent实现

#### 情绪Agent (`specialized/sentiment_agent.py`)

**特色**：分析市场情绪、新闻资讯、舆情热度

**信息获取**：
- 市场整体情绪（涨跌停家数比例、连板高度）
- 股票新闻（公司新闻、行业新闻、政策消息）
- 社交媒体情绪（股吧、雪球热度）
- 板块情绪

**分析权重**：
- 消息驱动：40%
- 情绪热度：30%
- 板块效应：20%
- 时机判断：10%

#### 技术Agent (`specialized/technical_agent.py`)

**特色**：分析技术指标、K线形态、量价关系

**信息获取**：
- K线形态（一字板、T字板、突破板等）
- 技术指标（MACD、KDJ、RSI、均线）
- 量价分析（换手率、量比、封单量）
- 价格水平（支撑位、压力位）

**分析权重**：
- 涨停形态：35%
- 趋势结构：25%
- 量价配合：25%
- 技术指标：15%

#### 资金Agent (`specialized/capital_agent.py`)

**特色**：分析资金流向、主力动向、龙虎榜数据

**信息获取**：
- 主力资金流向（净流入、大单占比）
- 龙虎榜数据（知名游资、机构席位）
- 主力持仓分析（成本区、筹码分布）
- 机构持仓变化

**分析权重**：
- 主力资金流入：40%
- 龙虎榜质量：25%
- 成交量健康度：20%
- 资金成本分析：15%

#### 基本面Agent (`specialized/fundamental_agent.py`)

**特色**：分析公司基本面、财务数据、行业地位

**信息获取**：
- 财务数据（营收增长、净利润、ROE、PE/PB）
- 行业信息（行业排名、市占率、景气度）
- 公司事件（业绩预增、重大合同、政策利好）
- 研报数据（机构评级、目标价）

**分析权重**：
- 业绩基本面：40%
- 估值水平：25%
- 行业景气度：20%
- 催化事件：15%

### 3. 系统提示词 (`prompts/`)

每个Agent都有专属的系统提示词，定义了：
- Agent的角色和核心能力
- 涨停预测分析框架
- 输出格式要求（JSON格式）
- 决策标准
- 特别提示

### 4. Agent注册表 (`registry.py`)

**功能**：
- Agent类注册（使用装饰器模式）
- Agent实例管理（单例模式）
- Agent发现和列表

**使用**：
```python
from app.agents.registry import registry

# 自动注册
@registry.register
class MyAgent(BaseAgent):
    agent_type = "my_agent"
    ...

# 获取Agent实例
agent = registry.get("sentiment", llm_client, config)
```

### 5. 多Agent协调器 (`coordinator.py`)

**功能**：
- 协调多个Agent并行执行
- 聚合多个Agent的决策结果
- 生成综合信号

**决策聚合方法**：加权投票法
- 情绪Agent：25%
- 技术Agent：30%
- 资金Agent：30%
- 基本面Agent：15%

## 使用方法

### 方式1：使用Agent服务（推荐）

```python
from app.services.agent_service import analyze_with_agents

# 分析股票
results = await analyze_with_agents(
    stock_codes=["000001.SZ", "600519.SH"],
    market_context={"market_sentiment": "bullish"}
)

# 结果格式
{
    "000001.SZ": {
        "final_decision": "buy",
        "final_confidence": 0.75,
        "reasoning": "...",
        "bullish_agents": ["technical", "capital"],
        "bearish_agents": [],
        "agent_results": {...}
    }
}
```

### 方式2：使用单个Agent

```python
from app.agents import SentimentAgent
from app.agents.base.agent import AgentInput

# 创建Agent
agent = SentimentAgent()

# 创建输入
input_data = AgentInput(
    stock_codes=["000001.SZ"],
    market_context={...}
)

# 运行Agent
result = await agent.run(input_data)
```

### 方式3：使用协调器

```python
from app.agents.coordinator import MultiAgentCoordinator

# 创建协调器
coordinator = MultiAgentCoordinator(
    agent_types=["sentiment", "technical", "capital"]
)

# 运行分析
results = await coordinator.analyze(
    stock_codes=["000001.SZ", "600519.SH"]
)
```

## 扩展Agent

### 步骤1：创建新的Agent类

```python
from app.agents.base.agent import BaseAgent, AgentDecision, DecisionType
from app.agents.registry import registry

@registry.register
class MyAgent(BaseAgent):
    name = "我的Agent"
    agent_type = "my_agent"
    version = "1.0.0"
    description = "自定义Agent描述"

    def get_system_prompt(self) -> str:
        return """系统提示词..."""

    async def gather_information(self, stock_codes: List[str]) -> Dict:
        # 实现信息收集逻辑
        return {...}

    async def analyze(self, stock_codes, information, market_context):
        # 实现分析逻辑
        return [AgentDecision(...)]
```

### 步骤2：添加到Agent包导出

编辑 `app/agents/__init__.py` 和 `app/agents/specialized/__init__.py`，添加新Agent的导出。

### 步骤3：更新权重配置（可选）

在 `MultiAgentCoordinator._aggregate_decisions()` 中调整权重。

## 测试

运行测试脚本：

```bash
cd apps/api
python test_agents.py
```

## 待办事项

- [ ] 接入真实数据源（东方财富、同花顺、AKShare等）
- [ ] 实现LLM集成（OpenAI/Claude API调用）
- [ ] 添加Agent决策持久化
- [ ] 实现Agent决策可解释性报告
- [ ] 添加Agent性能评估和回测
- [ ] 支持动态Agent权重调整
