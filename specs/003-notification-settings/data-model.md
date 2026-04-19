# Data Model: 通知设置管理

## Entity: SystemNotification

通知设置管理的核心实体，代表一条由管理员发布的系统通知。

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uint | PK, auto-increment | 主键 |
| title | string(200) | NOT NULL | 通知标题 |
| content | text | NOT NULL | 通知内容（富文本/HTML） |
| priority | int | NOT NULL, default: 1 | 优先级：1=普通, 2=紧急 |
| start_time | timestamp | NOT NULL | 生效开始时间 |
| end_time | timestamp | nullable | 生效结束时间（NULL=永久生效） |
| min_visible_level | int | NOT NULL, default: 1 | 最低可见用户等级 |
| is_disabled | bool | NOT NULL, default: false | 是否已失效（终态标记） |
| created_at | timestamp | auto | 创建时间 |
| updated_at | timestamp | auto | 更新时间 |

### Validation Rules

- `title`: 必填，长度 1-200 字符
- `content`: 必填
- `priority`: 仅允许 1（普通）或 2（紧急）
- `start_time`: 必填
- `end_time`: 若不为空，必须严格晚于 `start_time`
- `min_visible_level`: 必填，正整数

### State Derivation (Runtime)

状态不持久化到数据库，查询时根据当前时间动态计算：

```
IF is_disabled = true          → 已失效
ELSE IF NOW() < start_time     → 待生效
ELSE IF end_time IS NULL       → 生效中
ELSE IF NOW() <= end_time      → 生效中
ELSE                           → 已过期
```

### Indexes

```sql
-- 管理端列表：按创建时间倒序
CREATE INDEX idx_system_notifications_created_at ON system_notifications(created_at DESC);

-- 用户端查询：按优先级过滤 + 时间范围
CREATE INDEX idx_system_notifications_priority ON system_notifications(priority DESC);

-- 时间范围查询（用于状态筛选）
CREATE INDEX idx_system_notifications_time_range ON system_notifications(start_time, end_time);

-- 失效标记（用户端查询必用）
CREATE INDEX idx_system_notifications_disabled ON system_notifications(is_disabled);
```

## Relationship to UserLevel

无直接外键关联。`min_visible_level` 存储用户等级数值，与现有用户表中的 `vip_level` 字段通过数值比较匹配。

假设用户表已有：
```sql
users.vip_level INT  -- 1=普通, 2=VIP, 3=SVIP, ...
```

用户可见性条件：
```sql
WHERE is_disabled = false
  AND start_time <= NOW()
  AND (end_time IS NULL OR end_time >= NOW())
  AND min_visible_level <= :user_vip_level
```
