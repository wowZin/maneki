# Data Model: 用户管理增强 - 等级、准确率与 Agent 数据

## Entity: User (扩展)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | 用户唯一标识 |
| email | string(255) | unique | 邮箱 |
| username | string(50) | unique | 用户名 |
| nickname | string(100) | - | 昵称 |
| phone | string(20) | - | 手机号 |
| avatar_url | string(500) | - | 头像 URL |
| is_active | bool | default:true | 是否启用 |
| is_superuser | bool | default:false | 是否超管 |
| vip_level | int | default:0 | VIP 等级：0=普通, 1=VIP, 2=SVIP |
| vip_expire_at | timestamp | nullable | VIP 过期时间 |
| board_accuracy | decimal(5,2) | nullable | 打板准确率 (%)，如 78.50 |
| register_source | string(20) | - | 注册来源 |
| created_at | timestamp | - | 注册时间 |
| updated_at | timestamp | - | 更新时间 |

### Validation Rules
- `board_accuracy` 范围 0.00 ~ 100.00，可为 NULL（表示尚未计算）
- `vip_level` 仅允许 0, 1, 2

## Entity: AgentSubscription (已有，关联使用)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uint | PK | 订阅记录 ID |
| user_id | uuid | FK → users.id | 用户 ID |
| agent_id | uint | FK → agents.id | Agent ID |
| status | string(20) | default:active | 订阅状态：active/expired/cancelled |
| start_date | timestamp | - | 订阅开始时间 |
| end_date | timestamp | nullable | 订阅结束时间 |
| price | decimal(10,2) | - | 订阅价格 |

## Entity: AgentWeight (已有，关联使用)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uint | PK | 权重配置 ID |
| user_id | uuid | FK → users.id | 用户 ID |
| agent_id | uint | FK → agents.id | Agent ID |
| weight | decimal(3,2) | default:1.00 | 权重值 |
| is_enabled | bool | default:true | 是否启用 |
| custom_config | jsonb | nullable | 自定义配置 |

## Entity: Agent (已有，关联使用)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uint | PK | Agent ID |
| name | string(100) | not null | Agent 名称 |
| type | string(30) | not null | Agent 类型 |
| category | string(50) | - | 分类 |
| price | decimal(10,2) | default:0 | 价格 |
| price_type | string(20) | default:onetime | 定价类型 |
| use_count | int | default:0 | 使用次数 |
| rating | decimal(2,1) | default:5.0 | 评分 |
| is_active | bool | default:true | 是否上架 |
| owner_id | uuid | FK → users.id, nullable | 创作者 |

## Relationships

```
User 1--* AgentSubscription (一个用户可订阅多个 Agent)
User 1--* AgentWeight (一个用户可对多个 Agent 配置权重)
AgentSubscription *--1 Agent (每个订阅对应一个 Agent)
AgentWeight *--1 Agent (每个权重配置对应一个 Agent)
```

## API Response DTOs

### AdminUserListItem
```
- id: string
- email: string
- username: string
- nickname: string
- phone: string
- avatar_url: string
- is_active: bool
- vip_level: int
- vip_level_label: string   // "普通用户" | "VIP" | "SVIP"
- board_accuracy: float | null
- register_source: string
- created_at: string
- updated_at: string
```

### AdminUserDetail
```
- id: string
- email: string
- username: string
- nickname: string
- phone: string
- avatar_url: string
- is_active: bool
- is_superuser: bool
- is_verified: bool
- vip_level: int
- vip_level_label: string
- vip_expire_at: string | null
- board_accuracy: float | null
- register_source: string
- created_at: string
- updated_at: string
- agents: AdminUserAgentItem[]
```

### AdminUserAgentItem
```
- agent_id: uint
- agent_name: string
- agent_type: string
- subscription_status: string   // active | expired | cancelled | null
- subscription_end_date: string | null
- weight: float | null
- is_weight_enabled: bool | null
- agent_rating: float
- agent_use_count: int
```
