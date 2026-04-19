# Data Model: Admin User Management

**Feature**: 管理后台 - 超级管理员用户管理
**Date**: 2026-04-19

## Entity Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Admin      │       │    User      │       │  AuditLog    │
│  (admin_sys) │       │  (user_sys)  │       │  (admin_sys) │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ name (UK)    │       │ name         │       │ admin_id(FK) │
│ password_hash│       │ phone (UK)   │       │ action       │
│ role         │       │ email        │       │ target_type  │
│ is_active    │       │ password_hash│       │ target_id    │
│ created_at   │       │ is_active    │       │ detail       │
│ updated_at   │       │ created_at   │       │ ip_addr      │
│ last_login_at│       │ updated_at   │       │ created_at   │
│ last_login_ip│       │ last_login_at│       └──────────────┘
└──────────────┘       └──────────────┘
```

---

## 1. Admin (管理员账号表)

**Table**: `admins`
**Purpose**: 存储超级管理员和普通管理员账号信息。与用户表完全隔离。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| name | `VARCHAR(64)` | NOT NULL, UNIQUE | 账户名称（登录用） |
| password_hash | `VARCHAR(255)` | NOT NULL | bcrypt 哈希后的密码 |
| role | `VARCHAR(16)` | NOT NULL, CHECK(role IN ('super', 'admin')) | 角色：super=超级管理员, admin=普通管理员 |
| is_active | `BOOLEAN` | NOT NULL, DEFAULT true | 是否启用 |
| force_change_password | `BOOLEAN` | NOT NULL, DEFAULT false | 是否强制下次登录改密 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 更新时间 |
| last_login_at | `TIMESTAMPTZ` | NULL | 最后登录时间 |
| last_login_ip | `INET` | NULL | 最后登录 IP |

**Indexes**:
- `UNIQUE(name)`
- `INDEX(role, is_active)`

**Validation Rules**:
- `name`: 3-64 字符，只允许字母、数字、下划线，不能以数字开头
- `role`: 只允许 `super` 或 `admin`
- 至少保留一条 `role='super' AND is_active=true` 的记录

**State Transitions**:
```
[创建] → is_active=true, force_change_password=false (super via CLI)
[创建] → is_active=true, force_change_password=true  (admin via web, init pwd=111111)
[禁用] → is_active=false  (被禁用后无法登录，已有会话失效)
[启用] → is_active=true
[首次登录] → force_change_password=false (修改密码后)
```

---

## 2. User (普通用户表)

**Table**: `users`
**Purpose**: 存储前端应用的普通用户信息。与管理员表完全隔离。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| name | `VARCHAR(64)` | NOT NULL | 用户昵称 |
| phone | `VARCHAR(20)` | UNIQUE | 手机号（登录用） |
| email | `VARCHAR(128)` | NULL | 邮箱 |
| password_hash | `VARCHAR(255)` | NOT NULL | bcrypt 哈希后的密码 |
| avatar | `VARCHAR(255)` | NULL | 头像 URL |
| is_active | `BOOLEAN` | NOT NULL, DEFAULT true | 是否启用 |
| force_change_password | `BOOLEAN` | NOT NULL, DEFAULT false | 是否强制下次登录改密 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 更新时间 |
| last_login_at | `TIMESTAMPTZ` | NULL | 最后登录时间 |

**Indexes**:
- `UNIQUE(phone)`
- `INDEX(is_active)`

**Notes**:
- 管理员若要使用用户端功能，必须在此表中独立注册
- 管理员表与此表无外键关联

---

## 3. AuditLog (操作日志表)

**Table**: `audit_logs`
**Purpose**: 记录所有管理员在后台系统的关键操作，用于安全审计。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| admin_id | `BIGINT` | NOT NULL, FK → admins(id) | 操作人 |
| admin_name | `VARCHAR(64)` | NOT NULL | 操作人名称（冗余，防关联删除） |
| action | `VARCHAR(32)` | NOT NULL | 操作类型：login, logout, create_admin, disable_admin, enable_admin, disable_user, enable_user, reset_user_password |
| target_type | `VARCHAR(32)` | NOT NULL | 操作对象类型：admin, user |
| target_id | `BIGINT` | NULL | 操作对象 ID |
| target_name | `VARCHAR(64)` | NULL | 操作对象名称 |
| detail | `JSONB` | NULL | 操作详情（变更字段等） |
| ip_addr | `INET` | NULL | 操作者 IP |
| user_agent | `TEXT` | NULL | User-Agent |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 操作时间 |

**Indexes**:
- `INDEX(admin_id, created_at)`
- `INDEX(action, created_at)`
- `INDEX(target_type, target_id)`
- `INDEX(created_at)`

**Constraints**:
- 不可 UPDATE、不可 DELETE（仅 INSERT + SELECT）
- 日志留存不少于 90 天（由定时任务清理或分区表实现）

---

## 4. JWT Token Blacklist (Redis)

**Storage**: Redis
**Purpose**: 实现强制登出和会话失效

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `jwt:blacklist:{jti}` | String | token 剩余有效期 | 被吊销的 token jti |
| `admin:session:{admin_id}` | String | 30min | 当前活跃会话 jti（用于单点登录场景） |

**Notes**:
- Token 包含 `jti` (JWT ID) 和 `exp` (过期时间)
- 禁用账户时，将当前 token 的 jti 写入黑名单，TTL = token 剩余有效期
- 30 分钟无操作自动过期由 Redis TTL 和 token exp 共同控制
