# Data Model: 用户认证体系

## Entity: User (用户)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-gen | 系统内部唯一标识 |
| `phone` | string(20) | **UNIQUE**, not null | 手机号，唯一标识，登录凭证 |
| `nickname` | string(100) | **UNIQUE**, not null | 昵称/名称，全局唯一，展示+登录凭证 |
| `hashed_password` | string(255) | nullable | bcrypt 哈希密码（短信自动注册用户初始为空） |
| `avatar_url` | string(500) | nullable | 头像 URL |
| `is_active` | bool | default: true | 账户是否启用 |
| `is_superuser` | bool | default: false | 是否超级用户 |
| `register_source` | string(20) | default: 'phone' | 注册来源: 'phone'(短信自动), 'password'(显式注册) |
| `vip_level` | int | default: 0 | VIP 等级 |
| `created_at` | timestamp | auto | 创建时间 |
| `updated_at` | timestamp | auto | 更新时间 |
| `deleted_at` | timestamp | nullable, index | 软删除 |

### 变更说明（相对于当前模型）

- **移除**: `email` 的唯一约束（保留字段兼容存量数据，但不再用于注册和登录）
- **移除**: `username` 的唯一约束（保留字段兼容存量数据，用户端不再使用）
- **移除**: `full_name`（被 `nickname` 统一替代）
- **变更**: `nickname` 添加 **UNIQUE** 约束，不再允许重复
- **新增**: `register_source` 枚举扩展为包含 `'password'`
- **保留**: 所有微信相关字段、VIP 字段不变

### 索引

```sql
-- 唯一索引
CREATE UNIQUE INDEX idx_users_phone ON users(phone);
CREATE UNIQUE INDEX idx_users_nickname ON users(nickname);

-- 兼容索引（保留但不再用于新逻辑）
CREATE INDEX idx_users_email ON users(email);  -- 原为 unique
CREATE INDEX idx_users_username ON users(username);  -- 原为 unique
```

## Entity: VerificationCode (验证码)

存储于 Redis，非持久化数据库表。

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `sms:code:{phone}` | 6位数字字符串 | 300s (5分钟) |
| `sms:limit:phone:{phone}` | 请求计数 | 60s |
| `sms:limit:ip:{ip}` | 请求计数 | 60s |

## State Transitions

```
未注册手机号
  | 短信验证码登录
  v
自动创建 User (phone, auto-nickname, no password)
  |
  |--> 设置密码 --> 可用密码登录
  |
  |--> 继续短信登录

显式注册
  | 填写 name + phone + password
  v
创建 User (phone, nickname, hashed_password)
  |
  |--> 密码登录
  |--> 短信验证码登录
```

## Validation Rules

- `phone`: 中国大陆手机号格式（1[3-9] 开头，11位数字）
- `nickname`: 2-20 个字符，仅允许中文、字母、数字、下划线，全局唯一
- `password`: 最少 8 位，必须同时包含字母和数字
