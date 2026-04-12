# Data Service

统一数据服务，支持 Akshare 免费数据源（新闻）和 Tushare Pro/Akshare 双数据源（K线）。

## 功能

### 1. 实时数据 API
- `POST /api/kline` - K线数据查询（支持 Tushare/akshare/auto）
- `GET /api/kline/{code}` - K线数据查询（GET 方式）
- `GET /api/news/major` - 重大新闻（优先离线存储）
- `GET /api/sentiment` - 市场情绪数据

### 2. 管理 API
- `POST /api/admin/sync/kline` - 手动触发 K线同步
- `POST /api/admin/sync/stock-basic` - 同步股票基础信息
- `GET /api/admin/status` - 服务状态检查
- `GET /api/admin/stats` - 数据统计

### 3. 定时同步任务
- **交易日 8:00** - 同步新闻数据
- **交易日 12:00** - 同步新闻数据
- **交易日 15:30** - 收盘后批量同步 K线数据到本地 DB

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 TUSHARE_TOKEN

# 3. 启动服务
make dev
# 或
python main.py
```

### Docker 开发

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 TUSHARE_TOKEN

# 2. 启动所有服务
make docker-run

# 3. 查看日志
docker-compose logs -f data-service
```

### API 文档

启动后访问：`http://localhost:8001/docs`

## 架构

```
┌─────────────┐     HTTP      ┌──────────────┐
│   Go API    │ ────────────▶ │ data-service │◀── 定时任务
└─────────────┘               └──────┬───────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
   ┌───────────────┐       ┌─────────────────┐      ┌─────────────────┐
   │  Tushare Pro  │       │     Akshare     │      │  PostgreSQL     │
   └───────────────┘       └─────────────────┘      │  + TimescaleDB  │
                                                    └─────────────────┘
           ┌─────────────────────────────────────────────┐
           ▼                                             ▼
   ┌───────────────┐                           ┌─────────────────┐
   │  OSS (云端)    │                           │ 本地离线存储     │
   │  news/*.json  │                           │ /data/offline   │
   └───────────────┘                           └─────────────────┘
```

## 项目结构

```
apps/data-service/
├── app/
│   ├── core/           # 配置和基础设施
│   │   ├── settings.py
│   │   ├── redis_client.py
│   │   └── __init__.py
│   ├── db/             # 数据库
│   │   ├── database.py
│   │   ├── models.py
│   │   └── init_db.py
│   ├── services/       # 业务逻辑
│   │   ├── data_source.py      # 数据源管理
│   │   ├── kline_service.py    # K线数据服务
│   │   ├── news_service.py     # 新闻/舆情服务
│   │   ├── sync_service.py     # 批量同步服务
│   │   └── oss_service.py      # OSS 上传服务
│   ├── api/            # API 路由
│   │   ├── kline.py
│   │   ├── news.py
│   │   └── admin.py
│   ├── tasks/          # 定时任务
│   │   └── scheduler.py
│   └── __init__.py
├── tests/              # 测试
├── main.py             # FastAPI 入口
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TUSHARE_TOKEN` | Tushare Pro Token | 必填 |
| `DATABASE_URL` | PostgreSQL 连接 URL | - |
| `REDIS_URL` | Redis 连接 URL | `redis://localhost:6379/0` |
| `LOCAL_STORAGE_PATH` | 本地离线存储路径 | `/data/offline` |
| `OSS_ENDPOINT` | OSS 端点 | - |
| `OSS_ACCESS_KEY` | OSS Access Key | - |
| `OSS_SECRET_KEY` | OSS Secret Key | - |
| `OSS_BUCKET` | OSS Bucket 名称 | `maneki-data` |
| `ENABLE_SCHEDULER` | 是否启用定时任务 | `true` |

## 数据库表结构

### kline（K线数据）

```sql
CREATE TABLE kline (
    code VARCHAR(10) NOT NULL,
    date VARCHAR(8) NOT NULL,
    open FLOAT NOT NULL,
    high FLOAT NOT NULL,
    low FLOAT NOT NULL,
    close FLOAT NOT NULL,
    volume INTEGER NOT NULL,
    amount FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (code, date)
);

-- TimescaleDB hypertable
SELECT create_hypertable('kline', 'date');
```

### stock_basic（股票基础信息）

```sql
CREATE TABLE stock_basic (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50),
    exchange VARCHAR(10),
    industry VARCHAR(50),
    list_date VARCHAR(8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

## 离线存储策略

新闻/舆情等低频数据存储策略：

1. **本地存储**：`{LOCAL_STORAGE_PATH}/{type}/{date}.json`
2. **OSS 备份**：定时任务同步后自动上传
3. **优先读取**：API 优先从本地读取，失败时回退到实时获取

示例：
```
/data/offline/
├── news/
│   ├── 20240101.json
│   └── 20240102.json
└── sentiment/
    ├── 20240101.json
    └── 20240102.json
```

## 开发指南

### 添加新的数据源

1. 在 `app/services/` 下创建新的服务模块
2. 在 `app/services/data_source.py` 中注册
3. 更新 `app/api/` 下的路由

### 添加定时任务

在 `app/tasks/scheduler.py` 中添加：

```python
scheduler.add_job(
    your_task_function,
    trigger=CronTrigger(hour=9, minute=30),
    id="your_task_id",
    name="Your Task Name",
    replace_existing=True
)
```

## 测试

```bash
# 运行所有测试
make test

# 运行特定测试
pytest tests/test_kline.py -v
```
