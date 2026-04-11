# Data Service - 数据服务

统一数据获取与离线分析服务，基于 Python + FastAPI 构建。

支持 **Tushare Pro**（付费/实时）和 **Akshare**（免费/3秒延迟）双数据源。

## 功能

1. **统一数据获取**
   - 支持 Tushare Pro 和 Akshare 双数据源
   - 自动根据配置和用户等级选择数据源
   - 统一的数据格式返回

2. **数据类型**
   - K线数据（日线）
   - 实时行情数据
   - 股票基础信息
   - 股票列表

3. **离线分析**（预留）
   - 数据清洗与预处理
   - 历史数据分析
   - 指标计算

## 快速开始

### 1. 安装依赖

```bash
cd apps/data-service
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

`.env` 文件示例：
```bash
# Tushare Pro Token（可选，配置后优先使用）
TUSHARE_TOKEN=your_tushare_token_here
TUSHARE_ENABLED=true

# 数据源策略: auto | tushare | akshare
# auto: 优先使用 Tushare（如果配置了token），否则使用 Akshare
DATA_SOURCE_STRATEGY=auto

# 服务端口
PORT=8001
```

### 3. 启动服务

```bash
python main.py
```

服务启动在 http://localhost:8001

## API 接口

### 健康检查
- `GET /health` - 服务健康状态
- `GET /api/sources` - 可用数据源列表

### 数据接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/kline` | POST | 获取K线数据 |
| `/api/stock/info` | POST | 获取股票基本信息 |
| `/api/quote/realtime` | POST | 获取实时行情 |
| `/api/stock/list` | GET | 获取股票列表 |
| `/api/sync/batch` | POST | 批量同步数据 |

### 请求示例

**获取K线数据：**
```bash
curl -X POST http://localhost:8001/api/kline \
  -H "Content-Type: application/json" \
  -d '{
    "code": "000001",
    "days": 30,
    "source": "auto"
  }'
```

参数：
- `code`: 股票代码，如 "000001"
- `days`: 获取天数，默认30天
- `source`: 数据源，`auto`（自动选择）| `tushare` | `akshare`

**获取实时行情：**
```bash
curl -X POST http://localhost:8001/api/quote/realtime \
  -H "Content-Type: application/json" \
  -d '{
    "codes": ["000001", "000002"],
    "source": "auto"
  }'
```

## 数据源选择策略

| 用户类型 | 数据源 | 延迟 | 说明 |
|---------|--------|------|------|
| VIP/SVIP | Tushare Pro | 实时 | 需要配置 TUSHARE_TOKEN |
| 免费用户 | Akshare | 3秒 | 免费，无需配置 |

数据源优先级：
1. 用户显式指定 `source` 参数
2. 根据用户等级自动选择（通过调用方传递）
3. 如果 Tushare 不可用，自动降级到 Akshare

## 与 Go API 集成

Go API 通过 HTTP 调用数据服务：

```go
// 配置环境变量
DATA_SERVICE_URL=http://localhost:8001
```

数据流：
```
┌──────────┐      HTTP       ┌──────────────┐      ┌─────────────┐
│  Go API  │ ───────────────→ │ Data Service │ ────→ │  Tushare  │
│          │                  │   (Python)   │      │   Pro     │
│          │ ←─────────────── │              │      └─────────────┘
└──────────┘                  │              │
                              │              │      ┌─────────────┐
                              │              │ ────→ │  Akshare   │
                              └──────────────┘      └─────────────┘
```

## 离线分析（预留）

后续将添加：
- 数据清洗与预处理
- 技术指标计算（MACD、KDJ、RSI 等）
- 历史数据回测
- 批量数据分析任务
