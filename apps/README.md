# Maneki 应用启动方式指南

## 应用列表

| 应用 | 类型 | 本地启动 | 容器启动 | 热更新 |
|------|------|---------|---------|--------|
| `api` | Go API服务 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| `service-data` | Python数据服务 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| `web` | React前端 | ✅ 支持 | ❌ 纯前端 | ✅ Vite HMR |
| `web-admin` | React管理后台 | ✅ 支持 | ❌ 纯前端 | ✅ Vite HMR |

> **注意**: `service-agent` 已移动到 `packages/service-agent`，作为共享库使用

---

## 1. API 服务 (apps/api)

Go 实现的 REST API 服务

### 本地启动

```bash
cd apps/api

# 1. 安装依赖（首次）
go mod tidy

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库等

# 3. 启动服务
go run cmd/main.go

# 或使用 Air 热重载（推荐开发）
air -c .air.toml
```

### Docker 启动（开发）

```bash
# 在项目根目录
docker-compose -f infra/docker-compose.dev.yml up -d api

# 查看日志
docker logs -f maneki_api_dev
```

### Docker 启动（生产）

```bash
cd infra
./deploy.sh start
```

### 配置说明

| 文件 | 说明 |
|------|------|
| `.env.example` | 环境变量模板 |
| `Dockerfile` | 生产构建 |
| `Dockerfile.dev` | 开发环境（热重载） |
| `.air.toml` | Air 热重载配置 |

---

## 2. Data Service (apps/service-data)

Python 数据服务，负责数据抓取和离线分析

### 本地启动

```bash
cd apps/service-data

# 1. 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库等

# 4. 启动服务（生产模式）
python main.py

# 或开发模式（热重载）
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Docker 启动（开发）

```bash
# 在项目根目录
docker-compose -f infra/docker-compose.dev.yml up -d data-service

# 查看日志
docker logs -f maneki_data_service_dev
```

### Docker 独立启动

```bash
cd apps/service-data

# 开发模式（热重载）
docker-compose up -d

# 生产模式
docker build -t maneki-data-service .
docker run -d \
  -p 8001:8001 \
  -e DATABASE_URL=postgresql://stock:stock123@host:5432/stock_analysis \
  -e REDIS_URL=redis://host:6379/0 \
  maneki-data-service
```

### 配置说明

| 文件 | 说明 |
|------|------|
| `.env.example` | 环境变量模板 |
| `Dockerfile` | 生产构建 |
| `Dockerfile.dev` | 开发环境（热重载） |
| `docker-compose.yml` | 独立启动配置 |

---

## 3. Web 前端 (apps/web)

React 用户端前端

### 本地启动

```bash
cd apps/web

# 1. 安装依赖（首次）
pnpm install

# 2. 配置 API 地址
# 编辑 src/services/api.ts 或使用 .env.local

# 3. 启动开发服务器
pnpm dev

# 访问 http://localhost:5173
```

### 构建生产

```bash
pnpm build

# 预览生产构建
pnpm preview
```

### 说明

- **纯前端应用** - 不需要 Docker
- **热更新** - Vite 提供 HMR（热模块替换）
- **生产部署** - 构建后的 `dist/` 目录由 Nginx 托管

---

## 4. Web Admin (apps/web-admin)

React 管理后台前端

### 本地启动

```bash
cd apps/web-admin

# 1. 安装依赖（首次）
pnpm install

# 2. 配置 API 地址
# 编辑相关配置文件

# 3. 启动开发服务器
pnpm dev

# 访问 http://localhost:5174
```

### 构建生产

```bash
pnpm build

# 预览生产构建
pnpm preview
```

### 说明

- **纯前端应用** - 不需要 Docker
- **热更新** - Vite 提供 HMR
- **生产部署** - 构建后的 `dist/` 目录由 Nginx 托管

---

## 快速启动所有服务

### 开发环境

```bash
# 在项目根目录

# 1. 启动基础设施（数据库、Redis等）
docker-compose -f infra/docker-compose.dev.yml up -d timescaledb redis rabbitmq

# 2. 启动后端服务（热重载）
docker-compose -f infra/docker-compose.dev.yml up -d api data-service

# 3. 启动前端（本地）
cd apps/web && pnpm dev      # 终端1
cd apps/web-admin && pnpm dev  # 终端2
```

### 生产环境

```bash
cd infra

# 1. 初始化
./deploy.sh init

# 2. 编辑 .env 配置
vi .env

# 3. 启动所有服务
./deploy.sh start

# 4. 查看状态
./deploy.sh status
```

---

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| API | 8080 | Go API 服务 |
| Data Service | 8001 | Python 数据服务 |
| Web | 5173 | 前端开发服务器 |
| Web Admin | 5174 | 管理后台开发服务器 |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存 |
| RabbitMQ | 5672 / 15672 | 消息队列 / 管理界面 |
| Nginx | 80 / 443 | 反向代理（生产） |

---

## 目录结构

```
apps/
├── api/                 # Go API 服务
│   ├── cmd/main.go     # 入口文件
│   ├── Dockerfile      # 生产构建
│   ├── Dockerfile.dev  # 开发构建（热重载）
│   └── .air.toml       # Air 配置
│
├── service-data/        # Python 数据服务
│   ├── main.py         # 入口文件
│   ├── Dockerfile      # 生产构建
│   ├── Dockerfile.dev  # 开发构建（热重载）
│   └── docker-compose.yml  # 独立启动
│
├── web/                 # React 前端
│   ├── src/
│   └── package.json
│
└── web-admin/           # React 管理后台
    ├── src/
    └── package.json

packages/
└── service-agent/       # Go Agent 库（被 apps 引用）
    ├── *.go            # 库代码
    └── example/        # 使用示例
```
