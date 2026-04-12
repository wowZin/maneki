# Maneki API (Python FastAPI)

用户认证、数据管理、Agent 调度和看板统计的 Python 后端服务。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         API 服务架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      API 路由层                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  /auth   │ │ /agents  │ │/dashboard│ │ /stocks  │   │   │
│  │  │  认证    │ │ Agent管理 │ │  看板    │ │  股票    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │                    业务逻辑层                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │   │
│  │  │ AgentService │ │DashboardStats│ │  AuthService │    │   │
│  │  │ Agent管理    │ │ 看板统计     │ │  认证授权    │    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘    │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │                    数据处理层                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │   │
│  │  │ Celery定时任务│ │  数据预聚合  │ │  Agent协调   │    │   │
│  │  │ • 回填结果   │ │  • 日统计    │ │  • 加权投票  │    │   │
│  │  │ • 聚合统计   │ │  • 用户统计  │ │  • 决策聚合  │    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘    │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │                    数据访问层                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │   │
│  │  │  PostgreSQL  │ │    Redis     │ │ Data-Service │    │   │
│  │  │  • 决策记录  │ │  • 缓存      │ │  • K线数据   │    │   │
│  │  │  • 统计数据  │ │  • Session   │ │  • 新闻舆情  │    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 运行时 |
| FastAPI | 0.100+ | Web 框架 |
| SQLAlchemy | 2.0+ | ORM (异步) |
| Celery | 5.3+ | 定时任务 |
| PostgreSQL | 15+ | 主数据库 |
| Redis | 7+ | 缓存/Celery Broker |
| Alembic | 1.12+ | 数据库迁移 |

## 目录结构

```
app/
├── api/v1/              # API 路由
│   ├── dashboard.py     # 看板数据接口（多维度分析）
│   ├── agents.py        # Agent 管理接口
│   └── auth.py          # 认证接口
├── models/              # SQLAlchemy 模型
│   ├── user.py          # 用户模型
│   └── decision.py      # 决策记录、统计表
├── schemas/             # Pydantic 模型
│   └── dashboard.py     # 看板数据 Schema
├── tasks/               # Celery 定时任务
│   ├── scheduler.py     # 任务调度配置
│   └── dashboard_stats.py # 统计数据聚合
├── agents/              # Agent 实现
│   ├── base/            # 基础 Agent 类
│   ├── specialized/     # 专用 Agent 实现
│   ├── prompts/         # 系统提示词
│   └── coordinator.py   # 多 Agent 协调器
├── core/                # 核心配置
│   ├── config.py        # 应用配置
│   └── auth.py          # 认证逻辑
└── db/                  # 数据库
    ├── base.py          # 基础模型
    └── session.py       # 会话管理
```

## 核心功能

### 1. 看板统计系统

**数据模型** (`models/decision.py`):

| 表名 | 用途 |
|------|------|
| `agent_decision_records` | 每次决策的原始记录 |
| `agent_daily_stats` | 每日聚合统计（预计算） |
| `user_overall_stats` | 用户整体统计（预计算） |

**数据流**:
```
决策记录 → 收盘回填结果 → 定时聚合 → 预计算统计表 → API查询
```

**定时任务** (`tasks/scheduler.py`):

| 任务 | 调度 | 说明 |
|------|------|------|
| backfill-results | 每15分钟 | 回填实际结果（交易时段） |
| aggregate-daily-stats | 15:30 | 聚合当日统计 |
| aggregate-user-stats | 16:00 | 聚合用户统计 |
| run-all-stats | 02:00 | 全量重新聚合 |

### 2. 多维度分析

支持4个维度的对比分析 (`api/v1/dashboard.py`):

| 维度 | 取值 | 说明 |
|------|------|------|
| 市场环境 | bull/bear/sideways | 牛市/熊市/震荡市表现对比 |
| 时间段 | morning/afternoon/close | 早盘/午盘/尾盘表现对比 |
| 信号强度 | high/medium/low | 高/中/低置信度对比 |
| 板块 | 动态 Top 5 | 板块表现排行 |

### 3. Agent 管理

**注册中心** (`agents/registry.py`):

```python
# 标准模板 Agent（所有用户）
STANDARD_AGENTS = {
    "sentiment_v1": {...},
    "technical_v1": {...},
    "capital_v1": {...},
}

# 用户自定义 Agent (VIP 用户)
user_custom_agents: Dict[str, AgentConfig]
```

**Agent 类型** (`agents/specialized/`):

| 类型 | 文件 | 功能 |
|------|------|------|
| sentiment | `sentiment_agent.py` | 情绪分析 |
| technical | `technical_agent.py` | 技术分析 |
| capital | `capital_agent.py` | 资金流向 |
| fundamental | `fundamental_agent.py` | 基本面分析 |

**多 Agent 协调** (`agents/coordinator.py`):
- 并行执行多个 Agent
- 加权投票聚合决策
- 默认权重：technical 30%, capital 30%, sentiment 25%, fundamental 15%

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置数据库连接

# 运行迁移
alembic upgrade head

# 启动服务
uvicorn app.main:app --reload --port 8000

# 启动 Celery Worker
celery -A app.tasks.scheduler worker --loglevel=info

# 启动 Celery Beat (定时任务)
celery -A app.tasks.scheduler beat --loglevel=info
```

## 环境变量

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/maneki

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 数据源
DATA_SERVICE_URL=http://localhost:8001
```

## API 文档

启动后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要接口

```
# 看板
GET  /api/v1/dashboard/my-stats          # 用户看板数据（多维度）

# Agent 管理
POST /api/v1/agents                      # 创建自定义 Agent
GET  /api/v1/agents/my-agents            # 获取用户 Agent 列表
PUT  /api/v1/agents/{id}                 # 更新 Agent
POST /api/v1/agents/{id}/toggle          # 启用/停用 Agent

# 认证
POST /api/v1/auth/register               # 用户注册
POST /api/v1/auth/login                  # 用户登录
GET  /api/v1/auth/me                     # 当前用户信息
```

## 测试

```bash
pytest app/tests/ -v
```
