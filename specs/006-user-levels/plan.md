# 用户等级体系重构规划

## 现状

当前 `users` 表有一个 `vip_level INT DEFAULT 0` 字段，含义是隐式约定：
- `0` → 普通用户
- `1` → VIP
- `2` → SVIP

判断逻辑和中文标签全部硬编码在 Go handler 和前端页面里。通知设置的 `min_visible_level` 也是直接存这个 int 值。

问题：
1. 等级名称、颜色、权限全部散落在代码各处，改一个等级名要改 N 个文件
2. 无法动态新增/修改等级（比如未来想加 "钻石会员"）
3. 通知设置里的 `min_visible_level` 和业务等级强耦合，前端只能硬编码下拉选项

## 目标

把用户等级从 "隐式 int 约定" 升级为 "显式字典配置"，做到：
1. 后端数据库维护等级字典表
2. 前端通过 API 动态获取等级列表，下拉、Tag、筛选全部联动
3. 未来新增等级只需在后台配置，零代码改动

## 数据模型

### 新增表：`user_levels`（等级字典表）

```sql
CREATE TABLE user_levels (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,   -- 程序内标识：free, vip, svip
    name        VARCHAR(50)  NOT NULL,           -- 展示名称：普通用户, VIP, SVIP
    level_value INT          NOT NULL UNIQUE,    -- 数值大小，用于比较权限高低：0, 1, 2
    color       VARCHAR(20)  NOT NULL DEFAULT 'default',  -- antd Tag 颜色：blue, purple, gold...
    sort_order  INT          NOT NULL DEFAULT 0, -- 排序
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 初始数据
INSERT INTO user_levels (code, name, level_value, color, sort_order) VALUES
('free', '普通用户', 0, 'default', 0),
('vip',  'VIP',      1, 'blue',    1),
('svip', 'SVIP',     2, 'purple',  2);
```

### 用户表调整：`users`

不改动 `vip_level` 字段本身，但语义升级：
- `vip_level` 不再作为 "业务含义"，而是作为 `user_levels.level_value` 的外键引用
- 新增 `vip_level_id INT REFERENCES user_levels(id)`（可选，如果希望用自增 ID 关联）

**推荐做法**：保留 `vip_level` 存 `level_value`，新增一个虚拟字段或视图关联 `user_levels` 表读取名称/颜色。这样改动最小，且查询性能最好。

### 通知设置表调整：`system_notifications`

`min_visible_level` 不变，但语义从 "用户等级数值" 变成 "最低可见等级数值"，对应 `user_levels.level_value`。

## API 设计

### 1. 获取等级字典列表

```
GET /v1/user-levels
Response:
{
  "code": 0,
  "data": [
    { "id": 1, "code": "free", "name": "普通用户", "level_value": 0, "color": "default" },
    { "id": 2, "code": "vip",  "name": "VIP",      "level_value": 1, "color": "blue" },
    { "id": 3, "code": "svip", "name": "SVIP",     "level_value": 2, "color": "purple" }
  ]
}
```

### 2. 用户列表/详情响应调整

用户响应中的 `vip_level_label` 不再由 Go handler 硬编码，而是从字典表读取。可以：
- 方案 A：查询时 JOIN `user_levels` 表，返回 `vip_level_name` 和 `vip_level_color`
- 方案 B：后端缓存字典表到内存，handler 里查内存映射（推荐，性能最好）

推荐在用户响应中增加：
```go
type UserResponse struct {
    // ... 现有字段
    VIPLevel      int    `json:"vip_level"`
    VIPLevelName  string `json:"vip_level_name"`   // 从字典表读取
    VIPLevelColor string `json:"vip_level_color"`  // 从字典表读取
}
```

### 3. 通知设置相关调整

通知列表/详情返回时，增加一个 `visible_levels` 字段（数组），前端可以直接渲染多个 Tag：

```json
{
  "min_visible_level": 1,
  "visible_levels": [
    { "name": "VIP", "color": "blue" },
    { "name": "SVIP", "color": "purple" }
  ]
}
```

也可以前端自己根据 `/v1/user-levels` 做映射，减少后端改动。

## 前端改动

### 1. 新增服务层

```typescript
// services/userLevel.ts
export interface UserLevel {
  id: number
  code: string
  name: string
  level_value: number
  color: string
}

export const userLevelApi = {
  getList: () => api.get('/v1/user-levels').then(r => r.data.data as UserLevel[]),
}
```

### 2. 全局 Hook 缓存等级字典

```typescript
// stores/userLevels.ts
// 页面加载时请求一次，全局缓存，所有组件共享
```

### 3. 各页面联动改造

| 页面 | 当前做法 | 改造后 |
|------|---------|--------|
| UserListPage | 硬编码 `getVipTag` | 从 store 读取等级字典渲染 Tag |
| UserDetailPage | 硬编码 `getVipTag` | 同上 |
| Overview | 硬编码颜色数组 | 同上 |
| NotificationSettings | 硬编码 Select 选项 | 从 API 动态渲染 Select + Tag |

核心工具函数：
```typescript
const getLevelTag = (levelValue: number, levels: UserLevel[]) => {
  const level = levels.find(l => l.level_value === levelValue)
  if (!level) return <Tag>等级 {levelValue}</Tag>
  return <Tag color={level.color}>{level.name}</Tag>
}

const getVisibleLevels = (minLevel: number, levels: UserLevel[]) => {
  return levels.filter(l => l.level_value >= minLevel && l.is_active)
}
```

## 迁移方案

### Step 1：数据库（零停机）

1. 创建 `user_levels` 表并插入初始数据
2. 确认现有 `users.vip_level` 数据全部在 `[0,1,2]` 范围内
3. 如有脏数据（比如之前误写的 3,4,5），先清理为 2（SVIP）或 0（普通）

### Step 2：后端 API（向后兼容）

1. 新增 `GET /v1/user-levels` 接口
2. 修改 `userToResponse`，从内存字典映射 `vip_level_label` 和 `vip_level_color`
3. 保持 `vip_level` 字段不变，前端旧代码不会报错
4. 通知设置 API 保持 `min_visible_level` 字段不变

### Step 3：前端改造

1. 新增 `userLevelApi` 和全局 store
2. 逐个页面替换硬编码等级映射
3. 通知设置的 Select 选项改为动态渲染

### Step 4：清理（可选）

确认所有前端页面都使用字典表后，可以：
- 在后端删除 `vipLevelToLabel` 等硬编码函数
- 把 `vip_level` 字段改名为 `level_value`（可选，改动较大）

## 实施优先级

建议分两个阶段：

**Phase 1（本周）**：建表 + 后端 API + 通知设置页面动态化
- 影响面最小，通知设置是刚改过的页面，趁热打铁

**Phase 2（下周）**：用户列表、概览等页面全面替换
- 涉及页面多但改动模式相同，可以批量改

## 预期收益

1. 新增/修改用户等级名称、颜色 → 只需改数据库一行配置
2. 前端所有等级相关的下拉、Tag、筛选全部联动
3. 未来支持更多等级（钻石、黑金等）无需发版
