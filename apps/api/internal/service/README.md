# 数据源抽象层

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    DataProvider (统一入口)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. 缓存层 (Redis)                                       │   │
│  │  2. 本地数据库 (14天数据)                                 │   │
│  │  3. 外部数据源 (自动选择)                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│   TushareSource     │              │  AkshareProxySource │
│   (Go SDK 直接调用)  │              │  (Python HTTP代理)  │
│   • 实时数据        │              │  • 免费数据         │
│   • VIP/SVIP优先   │              │  • 免费用户默认     │
└─────────────────────┘              └─────────────────────┘
```

## 数据源选择策略

| 用户类型 | 优先数据源 | 降级数据源 | 延迟 |
|---------|-----------|-----------|------|
| VIP/SVIP | Tushare | Akshare | 实时/3秒 |
| 免费用户 | Akshare | Tushare | 3秒 |

## 数据流

```
用户请求
    │
    ▼
┌─────────────┐
│  查Redis缓存 │ ◄──── 命中直接返回
└──────┬──────┘
       │ 未命中
       ▼
┌─────────────┐
│  查本地数据库 │ ◄──── 14天内数据
└──────┬──────┘
       │ 不完整/过期
       ▼
┌─────────────┐
│  选数据源   │ ◄──── VIP→Tushare, 免费→Akshare
└──────┬──────┘
       ▼
┌─────────────┐
│  调用外部API │
└──────┬──────┘
       ▼
┌─────────────┐
│  存DB+缓存   │
└──────┬──────┘
       ▼
    返回数据
```

## 使用方法

### 1. 初始化

```go
// main.go
cfg := config.Load()
db := initDB(cfg.Database)
redis := initRedis(cfg.Redis)

// 创建数据提供者
dataProvider := service.NewDataProvider(cfg, db, redis)
```

### 2. 获取数据

```go
// 获取K线（自动处理缓存和数据源选择）
klines, err := dataProvider.GetKLine(ctx, user, "000001", 30)

// 获取实时行情
quotes, err := dataProvider.GetRealtimeQuote(ctx, user, []string{"000001", "000002"})

// 手动同步（定时任务）
err := dataProvider.SyncStockData(ctx, "000001")
```

## 配置

```bash
# .env
TUSHARE_TOKEN=your_tushare_token_here
AKSHARE_PROXY_URL=http://localhost:8001
```

## 启动 Akshare 代理服务

```bash
cd apps/akshare-proxy
pip install -r requirements.txt
python main.py
# 服务启动在 http://localhost:8001
```

## 扩展新数据源

实现 `DataSource` 接口：

```go
type DataSource interface {
    GetName() string
    GetKLine(ctx context.Context, code string, days int) ([]model.KLine, error)
    GetStockBasic(ctx context.Context, code string) (*model.Stock, error)
    GetRealtimeQuote(ctx context.Context, codes []string) ([]model.Quote, error)
    IsAvailable() bool
}
```

然后在 `NewDataProvider` 中注册：

```go
dp.sources["newsource"] = NewNewSource(cfg.NewSourceToken)
```
