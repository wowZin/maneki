# Maneki API (Go)

股票分析智能应用后端服务 - Go 版本

## 技术栈

- **框架**: Gin
- **数据库**: PostgreSQL + TimescaleDB
- **ORM**: GORM
- **缓存**: Redis
- **认证**: JWT

## 项目结构

```
api/
├── cmd/
│   └── main.go              # 应用入口
├── internal/
│   ├── config/              # 配置管理
│   │   └── config.go
│   ├── handler/             # HTTP 处理器（Controllers）
│   │   ├── auth.go          # 认证相关
│   │   ├── agent.go         # Agent市场
│   │   ├── stock.go         # 股票数据
│   │   └── health.go        # 健康检查
│   ├── middleware/          # 中间件
│   │   ├── auth.go          # JWT认证
│   │   ├── cors.go          # CORS
│   │   ├── logger.go        # 日志
│   │   └── security.go      # 安全相关
│   ├── model/               # 数据模型（Models）
│   │   ├── user.go          # 用户模型
│   │   ├── agent.go         # Agent模型
│   │   ├── stock.go         # 股票/K线模型
│   │   ├── signal.go        # 信号/决策模型
│   │   └── common.go        # 通用类型
│   ├── repository/          # 数据访问层（Repository）
│   │   ├── user.go          # 用户仓库
│   │   └── agent.go         # Agent仓库
│   └── service/             # 业务逻辑层（Services）
│       ├── data_provider.go # 数据源抽象层
│       ├── tushare_source.go # Tushare数据源
│       └── akshare_source.go # Akshare代理数据源
├── go.mod
├── go.sum
├── .env.example
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd apps/api
go mod tidy
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库、Redis等
```

### 3. 运行服务

```bash
go run cmd/main.go
```

服务将启动在 `http://localhost:8080`

## API 文档

### 认证接口

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新Token
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/auth/me` - 获取当前用户信息

### Agent接口

- `GET /api/v1/agents` - 获取Agent列表
- `GET /api/v1/agents/featured` - 获取精选Agent
- `GET /api/v1/agents/:id` - 获取Agent详情
- `POST /api/v1/agents` - 创建Agent
- `PUT /api/v1/agents/:id` - 更新Agent
- `DELETE /api/v1/agents/:id` - 删除Agent

### 股票数据接口

- `GET /api/v1/stocks/:code/kline` - 获取K线数据
- `GET /api/v1/stocks/quotes` - 获取实时行情

### 管理员接口

- `GET /api/v1/admin/users` - 用户列表
- `POST /api/v1/admin/agents/:id/featured` - 设置精选Agent
- `POST /api/v1/admin/stocks/:code/sync` - 同步股票数据

## 数据源配置

支持双数据源架构：

| 用户类型 | 优先数据源 | 说明 |
|---------|-----------|------|
| 免费用户 | Akshare | 3秒延迟，免费 |
| VIP/SVIP | Tushare | 实时数据，需要Token |

配置环境变量：
- `TUSHARE_TOKEN` - Tushare Pro Token
- `AKSHARE_PROXY_URL` - Akshare代理服务地址

## 部署

### Docker 构建

```bash
docker build -t maneki-api .
docker run -p 8080:8080 --env-file .env maneki-api
```

### 生产环境建议

1. 使用 `ENV=production` 启用生产模式
2. 配置强密钥 `SECRET_KEY`
3. 配置 PostgreSQL 和 Redis 连接
4. 启用 SSL/TLS
5. 配置日志收集和监控
