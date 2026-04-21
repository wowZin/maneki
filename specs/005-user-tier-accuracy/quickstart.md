# Quickstart: 用户管理增强开发指南

## 1. 环境准备

确保本地开发环境已启动：

```bash
# 根目录启动所有服务
cd /Users/zhangying/projects/maneki
pnpm dev

# 或分别启动
# 前端
cd apps/web-admin && pnpm dev

# 后端
cd apps/api && go run cmd/main.go
```

数据库迁移（如需要新增 `board_accuracy` 字段）：

```bash
# 如果使用 GORM AutoMigrate，启动时自动同步
# 如需手动迁移，在项目已有迁移目录执行相应脚本
```

## 2. 开发顺序建议

### Phase A: 后端列表接口增强

1. **model**: 在 `apps/api/internal/model/user.go` 的 `User` 结构体新增 `BoardAccuracy` 字段
2. **repository**: 扩展 `SearchWithFilters` 支持：
   - `vipLevels []int` 多选筛选（`vip_level IN (...)`）
   - `sortBy` + `sortOrder` 动态排序
3. **service**: 扩展 `ListUsers` 签名，透传新参数
4. **handler**: 扩展 `ListUsersRequest`（`vip_levels`, `sort_by`, `sort_order`），组装响应时增加 `vip_level_label` 和 `board_accuracy`

### Phase B: 后端详情接口增强

1. **service/handler**: 在 `GetUser` 逻辑中聚合用户关联的 Agent 数据：
   - 查询 `agent_subscriptions` 获取订阅状态
   - 查询 `agent_weights` 获取权重配置
   - 关联 `agents` 表获取 Agent 基本信息
   - 组装为 `agents` 数组返回

### Phase C: 前端列表页增强

1. **api/user.ts**: 扩展 `User` 接口与 `list` 参数类型
2. **UserListPage.tsx**: 
   - 表格新增"等级"、"打板准确率"列
   - 顶部筛选区新增等级多选 Select
   - 支持按准确率排序（点击表头或独立排序按钮）

### Phase D: 前端详情页增强

1. **api/user.ts**: 扩展 `detail` 返回类型，增加 `agents` 字段
2. **UserDetailPage.tsx**: 
   - 基本信息区域增加等级、打板准确率展示
   - 新增 Agent 数据区域（Table 或 Card 列表），展示订阅状态、权重、评分等

## 3. 关键验证点

- [ ] 选择 VIP 等级筛选后，列表仅展示 VIP 用户
- [ ] 选择多等级（VIP + SVIP）筛选后，列表展示对应用户
- [ ] 点击按准确率排序，列表按准确率从高到低排列
- [ ] 准确率为空时，列表显示 "--" 并排在最后
- [ ] 用户详情页 Agent 区域正确展示所有订阅 Agent
- [ ] 用户无 Agent 数据时，展示空状态提示

## 4. 测试

后端单元测试：

```bash
cd apps/api
go test ./internal/repository/... -run User
go test ./internal/service/... -run User
go test ./internal/handler/... -run User
```

前端类型检查：

```bash
cd apps/web-admin
pnpm type-check
```

## 5. 提交

功能开发完成后，在当前分支 `005-user-tier-accuracy` 提交：

```bash
git add .
git commit -m "feat: 用户管理增强 - 等级筛选、准确率排名与 Agent 数据"
```
