# Research: 双登录方式用户认证体系

## Decision: 登录方式架构

**Chosen**: 单一 AuthHandler 内维护两种登录入口（短信验证码 / 密码），共享用户查询和 Token 生成逻辑。登录页前端以 Tab 切换方式呈现两种表单。

**Rationale**:
- 现有代码已具备 `LoginByPhoneCode` 和 `findOrCreateUserByPhone`，扩展成本低
- 密码登录可直接复用现有的 `bcrypt` 校验和 JWT 生成流水线
- 两种方式的最终产物相同（access_token + refresh_token Cookie），后端无需区分登录方式处理后续请求
- 前端复用同一个页面减少路由和状态管理的复杂度

**Alternatives considered**:
- 分离为两个独立 handler：增加代码重复，无益于维护
- OAuth/SSO 集成：超出本 feature 范围，用户未要求

## Decision: 昵称全局唯一与自动注册默认昵称

**Chosen**: 自动注册（短信登录）时，系统使用手机号脱敏形式作为初始昵称（如 `13****5678`），并标记为 `is_auto_nickname = true`，用户后续可在设置中修改。显式注册时用户自行填写昵称，需校验全局唯一。

**Rationale**:
- 手机号天然唯一，脱敏后作为初始昵称不会出现冲突
- 脱敏形式比完整手机号更保护隐私
- 标记 `is_auto_nickname` 以便前端在首次登录后提示用户修改（可选体验优化）
- 显式注册时强制唯一性检查，避免后续登录歧义

**Alternatives considered**:
- 随机生成昵称（如"用户_8a3f"）：不友好，用户难以识别和记忆
- 要求短信登录用户立即设置昵称：增加登录 friction，违背"一键登录"的便捷性
- 使用完整手机号作为昵称：暴露隐私

## Decision: 用户模型迁移策略

**Chosen**: 本次 feature 仅修改新注册/新登录用户的行为，对存量数据采用"兼容保留"策略：
- `email` 字段从唯一索引降级为普通索引（或移除唯一约束），允许为空
- `nickname` 添加唯一索引，但存量数据中重复的 nickname 需要预先处理（脚本去重或填充唯一值）
- `username` 字段保留但不再用于用户端登录（仅作为遗留兼容）

**Rationale**:
- 强制迁移存量数据风险高，可能导致生产事故
- 逐步废弃 `email` 和 `username` 比立即删除更安全
- 新逻辑以 `phone` 和 `nickname` 为唯一键，旧数据不影响新用户流程

**Alternatives considered**:
- 一次性删除 email/username 字段：破坏现有 admin 功能和其他依赖
- 强制要求存量用户补充 nickname：运营成本高，非本 feature 范围

## Decision: 密码登录的 identifier 支持

**Chosen**: 密码登录时，前端传递单个 `account` 字段（用户可输入手机号或昵称），后端先尝试按手机号查找，未命中再按昵称查找。

**Rationale**:
- 用户无需记住自己注册时用的是手机号还是昵称
- 后端两次查询成本极低（手机号有索引，昵称也有索引）
- 避免前端传递两个字段带来的复杂校验逻辑

## Decision: 短信验证码存储

**Chosen**: 继续使用现有 Redis 存储方案（`sms:code:{phone}`），5 分钟 TTL，验证码 6 位数字。

**Rationale**:
- 现有 `smsService` 已实现完整的生成、存储、校验、过期逻辑
- Redis TTL 天然支持过期，无需额外定时任务
- 无需改动，直接复用

## Decision: 密码复杂度校验位置

**Chosen**: 后端 `validatePasswordStrength` 作为权威校验（已有实现，只需从 min=6 提升为 min=8 并保留字母+数字检查），前端同步做即时反馈以提升 UX。

**Rationale**:
- 安全校验必须在后端，前端校验仅为体验优化
- 现有 `validatePasswordStrength` 在 `auth.go` 中，逻辑可直接复用
