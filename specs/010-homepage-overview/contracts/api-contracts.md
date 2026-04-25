# API Contracts: 首页概览数据看板

**Date**: 2026/04/25
**Base Path**: `/api/v1`
**Auth**: 部分接口需要 JWT Bearer Token（见各接口说明）

---

## 1. 打板预测正确率趋势

### GET /overview/accuracy-trend

获取平台打板预测正确率的历史趋势数据。

**Auth**: 公开（无需登录）

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 否 | 时间维度: `7d`(默认) / `30d` / `90d` / `1y` |

**Response 200**:

```json
{
  "period": "7d",
  "data": [
    {
      "date": "2026-04-19",
      "accuracy": 0.8235,
      "total_predictions": 34,
      "hit_count": 28
    },
    {
      "date": "2026-04-20",
      "accuracy": 0.7895,
      "total_predictions": 38,
      "hit_count": 30
    }
  ],
  "overall_accuracy": 0.8012,
  "updated_at": "2026-04-25T14:30:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: period 参数不合法
- `500 Internal Server Error`: 数据库查询失败

---

## 2. 用户选中涨停股票趋势

### GET /overview/user-tracking-trend

获取当前登录用户选中涨停股票的趋势统计。

**Auth**: 需要登录 (JWT)

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 否 | 时间维度: `7d`(默认) / `30d` / `90d` |

**Response 200**:

```json
{
  "period": "7d",
  "data": [
    {
      "date": "2026-04-19",
      "tracked_count": 5,
      "hit_count": 3,
      "hit_rate": 0.60
    },
    {
      "date": "2026-04-20",
      "tracked_count": 8,
      "hit_count": 5,
      "hit_rate": 0.625
    }
  ],
  "summary": {
    "total_tracked": 42,
    "total_hit": 28,
    "overall_hit_rate": 0.6667
  },
  "updated_at": "2026-04-25T14:30:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: 未登录或 Token 无效
- `500 Internal Server Error`: 数据库查询失败

---

## 3. 用户选中涨停股票明细

### GET /overview/user-tracking-detail

获取指定日期用户选中股票的详细列表。

**Auth**: 需要登录 (JWT)

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 是 | 日期 (YYYY-MM-DD) |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页条数，默认 20，最大 100 |

**Response 200**:

```json
{
  "date": "2026-04-20",
  "items": [
    {
      "stock_code": "000001",
      "stock_name": "平安银行",
      "tracked_at": "2026-04-20T09:35:00Z",
      "hit_status": true,
      "change_pct": 10.02,
      "close_price": 15.68
    },
    {
      "stock_code": "000002",
      "stock_name": "万科A",
      "tracked_at": "2026-04-20T09:40:00Z",
      "hit_status": false,
      "change_pct": 5.30,
      "close_price": 18.25
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 8,
    "total_pages": 1
  }
}
```

**Error Responses**:
- `400 Bad Request`: date 参数缺失或格式错误
- `401 Unauthorized`: 未登录或 Token 无效
- `500 Internal Server Error`: 数据库查询失败

---

## 4. Agent 命中率

### GET /overview/agent-performance

获取各 Agent 的命中率排名与统计数据。

**Auth**: 公开（无需登录）

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 否 | 统计周期: `7d`(默认) / `30d` / `all` |
| sort_by | string | 否 | 排序字段: `hit_rate`(默认) / `total_predictions` |
| limit | int | 否 | 返回条数，默认 20，最大 50 |

**Response 200**:

```json
{
  "period": "7d",
  "agents": [
    {
      "agent_id": 1,
      "agent_name": "技术分析助手",
      "agent_type": "technical",
      "total_predictions": 45,
      "hit_count": 38,
      "hit_rate": 0.844,
      "trend": "up",
      "rank": 1
    },
    {
      "agent_id": 2,
      "agent_name": "基本面分析助手",
      "agent_type": "fundamental",
      "total_predictions": 32,
      "hit_count": 24,
      "hit_rate": 0.750,
      "trend": "stable",
      "rank": 2
    }
  ],
  "updated_at": "2026-04-25T14:30:00Z"
}
```

**字段说明**:
- `trend`: 近期趋势，`up`(上升) / `down`(下降) / `stable`(稳定)，对比上一周期

**Error Responses**:
- `400 Bad Request`: 参数不合法
- `500 Internal Server Error`: 数据库查询失败

---

## 5. 热门股票

### GET /overview/hot-stocks

获取当前热门股票榜单。

**Auth**: 公开（无需登录）

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | int | 否 | 返回条数，默认 20，最大 50 |

**Response 200**:

```json
{
  "items": [
    {
      "rank": 1,
      "stock_code": "300001",
      "stock_name": "特锐德",
      "heat_score": 95.32,
      "price": 28.56,
      "change_pct": 19.98,
      "volume": 152345678
    },
    {
      "rank": 2,
      "stock_code": "000001",
      "stock_name": "平安银行",
      "heat_score": 88.15,
      "price": 15.68,
      "change_pct": 10.02,
      "volume": 89234125
    }
  ],
  "calculated_at": "2026-04-25T10:00:00Z"
}
```

**Error Responses**:
- `500 Internal Server Error`: 数据库查询失败

---

## 6. 实时信号

### GET /overview/realtime-signals

获取最新的实时交易信号列表。

**Auth**: 公开（无需登录）

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | int | 否 | 返回条数，默认 10，最大 50 |
| after_id | uint | 否 | 只返回 ID 大于此值的信号（用于增量刷新） |

**Response 200**:

```json
{
  "items": [
    {
      "id": 10425,
      "signal_type": "watch",
      "stock_code": "300001",
      "stock_name": "特锐德",
      "confidence": 0.92,
      "trigger_price": 28.50,
      "reason": "量价齐升，突破前高",
      "created_at": "2026-04-25T14:28:35Z",
      "is_new": true
    },
    {
      "id": 10424,
      "signal_type": "alert",
      "stock_code": "000001",
      "stock_name": "平安银行",
      "confidence": 0.78,
      "trigger_price": null,
      "reason": "主力资金大幅流入",
      "created_at": "2026-04-25T14:25:12Z",
      "is_new": false
    }
  ],
  "has_more": true,
  "latest_id": 10425
}
```

**字段说明**:
- `is_new`: 对于当前请求是否为新增信号（前端根据 after_id 判断后设置）
- `has_more`: 是否还有更多历史信号

**Error Responses**:
- `500 Internal Server Error`: 数据库查询失败

---

## 通用约定

### 时间格式

所有时间字段统一使用 ISO 8601 格式字符串: `YYYY-MM-DDTHH:mm:ssZ` (UTC)

### 分页响应

含分页的接口统一返回:

```json
{
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 错误响应格式

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "参数 period 不合法，可选值: 7d, 30d, 90d, 1y"
  }
}
```

### 路由注册位置

所有 `/overview/*` 路由注册在 `cmd/main.go` 的公开路由组中（无需认证），其中 `/overview/user-tracking-*` 放在 `auth` 认证路由组下（需要登录）。
