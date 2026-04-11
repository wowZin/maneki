# Maneki - 股票分析智能应用

> 基于多Agent决策的实时涨停预测系统

招财猫（Maneki）是一个AI驱动的股票分析平台，帮助用户在个股涨停前及时捕捉机会。

## 项目架构

本项目采用 **Monorepo** 架构管理前后端代码：

```
maneki/
├── apps/
│   ├── api/                 # Go 后端 API（主服务）
│   ├── data-service/        # 数据服务（数据源获取 & 离线分析）
│   ├── web/                 # React 前端（用户端）
│   └── web-admin/           # React 前端（管理后台）
├── docs/
│   ├── architecture.md      # 架构设计文档
│   └── ...
├── infra/
│   └── docker-compose.yml   # Docker Compose 配置
├── package.json             # 根 package.json (pnpm workspaces)
├── pnpm-workspace.yaml      # pnpm 工作区配置
└── turbo.json               # Turbo 构建配置
```

## 技术栈

### 后端 (apps/api) - Go

| 技术 | 用途 |
|------|------|
| Go 1.22+ | 高性能后端语言 |
| Gin | Web 框架 |
| GORM | ORM |
| PostgreSQL + TimescaleDB | 关系型/时序数据库 |
| Redis | 缓存/Session |
| JWT | 认证 |
| Tushare/Akshare | 股票数据源 |

### 前端 (apps/web)

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Zustand | 状态管理 |
| SSE | 决策通知实时推送 |
| ECharts / AntV | 股票 K 线/指标图表 |
| Ant Design | UI 组件库 |

## 快速开始

### 环境要求

- Go 1.22+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### 1. 启动基础设施

```bash
# 启动 PostgreSQL、Redis
docker-compose -f infra/docker-compose.dev.yml up -d
```

### 2. 启动后端

```bash
cd apps/api
cp .env.example .env
# 编辑 .env 配置数据库、Redis等
go mod tidy
go run cmd/main.go
# 服务启动在 http://localhost:8080
```

### 3. 启动前端

```bash
cd apps/web
pnpm install
pnpm dev
# 前端启动在 http://localhost:5173
```

### 4. 启动数据服务（可选）

```bash
cd apps/data-service
pip install -r requirements.txt
python main.py
# 数据服务启动在 http://localhost:8001
```

## API 文档

后端服务启动后：
- API 服务: http://localhost:8080
- 健康检查: http://localhost:8080/health

### 主要接口

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/agents` - Agent列表
- `GET /api/v1/stocks/:code/kline` - K线数据
- `GET /api/v1/stocks/quotes` - 实时行情

## 核心功能

1. **多 Agent 决策系统**
   - 技术分析 Agent
   - 基本面 Agent
   - 情绪 Agent
   - 资金 Agent
   - 决策 Agent

2. **数据源抽象层**
   - VIP/SVIP: Tushare Pro (实时数据)
   - 免费用户: Akshare (3秒延迟)
   - 本地缓存: 14天数据
   - Redis缓存: 5分钟TTL

3. **实时数据处理**
   - Level-2 行情数据
   - 实时指标计算
   - 信号检测与推送 (SSE)

4. **复盘优化**
   - 每日收盘复盘
   - Agent 成功率统计
   - 权重自动调整

5. **Agent 市场**
   - 官方精选 Agent
   - 用户自定义 Agent
   - 订阅与返佣

## 开发指南

### 代码规范

```bash
# 前端代码检查
pnpm lint

# Go 代码检查
cd apps/api
go vet ./...

# Go 测试
go test ./...
```

### 数据库迁移

使用 GORM 自动迁移：

```go
// 在 main.go 中
err := db.AutoMigrate(
    &model.User{},
    &model.Agent{},
    &model.Signal{},
    // ...
)
```

## 架构变更说明

### 2024-04-11: Python → Go 迁移

- 后端从 Python/FastAPI 迁移到 Go/Gin
- 新增数据服务 `apps/data-service`（数据源获取 & 离线分析）
- 更新架构文档 `docs/architecture.md`

## 部署

### 本地开发

```bash
docker-compose -f infra/docker-compose.dev.yml up -d
cd apps/api && go run cmd/main.go
cd apps/web && pnpm dev
```

### 生产构建

```bash
# 构建后端
cd apps/api
docker build -t maneki-api .

# 构建前端
cd apps/web
pnpm build

# 或使用 Docker Compose
docker-compose -f infra/docker-compose.yml up -d
```

## 文档

- [架构设计](docs/architecture.md)
- [后端 README](apps/api/README.md)
- [API 接口文档](http://localhost:8080/health) - 后端启动后访问

## 许可证

MIT
