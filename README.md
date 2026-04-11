# 股票分析智能应用 - Maneki

> 基于多Agent决策的实时涨停预测系统

## 项目架构

本项目采用 **Monorepo** 架构管理前后端代码，使用 pnpm workspaces 进行依赖管理。

```
maneki/
├── apps/
│   ├── web/                 # React前端 (Vite + React 18 + TypeScript)
│   └── api/                 # Python后端 (FastAPI + AsyncIO)
├── packages/
│   ├── shared-types/        # 共享 TypeScript 类型定义
│   └── ts-config/           # 共享 TypeScript 配置
├── infra/
│   ├── docker-compose.dev.yml   # 本地开发环境
│   └── docker-compose.yml       # 生产环境
├── docs/
│   ├── architecture.md      # 架构文档
│   └── polars_tech_guide.md # Polars 技术指南
├── package.json             # 根 package.json (pnpm workspaces)
├── pnpm-workspace.yaml      # pnpm 工作区配置
└── turbo.json               # Turbo 构建配置
```

## 快速开始

### 前置要求

- Node.js >= 18
- pnpm >= 8
- Python >= 3.11
- Docker & Docker Compose

### 1. 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖
cd apps/api && pip install -r requirements.txt
```

### 2. 启动基础设施

```bash
# 启动数据库、Redis、RabbitMQ
docker-compose -f infra/docker-compose.dev.yml up -d
```

### 3. 启动开发服务

```bash
# 同时启动前后端 (使用 turbo)
pnpm dev

# 或分别启动
pnpm --filter web dev      # 前端: http://localhost:5173
pnpm --filter api dev      # 后端: http://localhost:8000
```

## 技术栈

### 前端 (apps/web)
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具（快速冷启动、HMR） |
| Zustand | 状态管理 |
| SSE (EventSource) | 决策通知实时推送 |
| ECharts / AntV | 股票 K 线/指标图表 |
| Ant Design | UI 组件库 |

### 后端 (apps/api)
| 技术 | 用途 |
|------|------|
| FastAPI | 高性能异步 API |
| SSE (StreamingResponse) | 决策通知推送（轻量级） |
| AsyncIO | 异步编程 |
| Celery | 定时任务、后台计算 |
| Polars | 复盘数据分析（高性能） |
| NumPy / Numba | 数值计算、加速 |
| TimescaleDB | 时序数据存储 |
| Redis | 实时缓存 |
| RabbitMQ | 消息队列 |

## 开发指南

### 代码规范

```bash
# 前端代码检查
pnpm lint

# 类型检查
pnpm type-check

# 后端代码检查
cd apps/api && ruff check .
```

### 数据库迁移

```bash
cd apps/api
alembic revision --autogenerate -m "描述"
alembic upgrade head
```

### 添加共享包

```bash
# 在 packages/ 下创建新包
cd packages/my-package
pnpm init

# 其他应用引用
pnpm --filter web add @maneki/shared-types
```

## 部署

### 本地开发
```bash
docker-compose -f infra/docker-compose.dev.yml up -d
pnpm dev
```

### 生产构建
```bash
# 构建所有应用
pnpm build

# 或使用 Docker
docker-compose -f infra/docker-compose.yml up -d
```

## 文档

- [架构设计](docs/architecture.md)
- [Polars 技术指南](docs/polars_tech_guide.md)
- [API 文档](http://localhost:8000/docs) - 后端启动后访问

## 许可证

MIT
