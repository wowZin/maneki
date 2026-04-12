# Maneki Web (Next.js)

用户端前端应用，提供股票看板、Agent 管理和实时决策展示。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14+ | React 框架 (App Router) |
| TypeScript | 5.0+ | 类型安全 |
| Tailwind CSS | 3.4+ | 样式 |
| shadcn/ui | latest | UI 组件库 |
| Zustand | 4.4+ | 状态管理 |
| Recharts | 2.10+ | 图表 |
| Lucide React | latest | 图标 |

## 目录结构

```
app/                       # Next.js App Router
├── page.tsx              # 首页
├── layout.tsx            # 根布局
├── dashboard/            # 看板页面
│   └── page.tsx
├── agents/               # Agent 配置页面
│   └── page.tsx
├── login/                # 登录页
└── register/             # 注册页

components/               # React 组件
├── Dashboard/           # 看板相关组件
│   ├── UserAgentDashboard.tsx    # 用户看板（多维度）
│   ├── AgentDashboard.tsx        # Agent 详情看板
│   └── AgentConfigPage.tsx       # Agent 配置页面
├── ui/                   # shadcn/ui 组件
│   ├── card.tsx
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
├── Layout/              # 布局组件
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   └── index.tsx
└── ProtectedRoute/      # 路由保护
    └── index.tsx

hooks/                    # 自定义 Hooks
├── useWechatAuth.ts     # 微信认证
└── useSSE.ts            # Server-Sent Events

lib/                      # 工具库
└── utils.ts             # 工具函数

stores/                   # Zustand 状态
├── auth.ts              # 认证状态
└── index.ts             # 状态导出

services/                 # API 服务
├── api.ts               # API 客户端
├── sse.ts               # SSE 连接
└── index.ts             # 服务导出
```

## 核心功能

### 1. 用户看板 (`UserAgentDashboard.tsx`)

4 个标签页：

| 标签 | 功能 |
|------|------|
| 总览 | 核心指标卡片、成功率趋势、Agent 排名 |
| Agent详情 | 自定义 Agent 列表、标准 Agent 列表 |
| 多维分析 | 市场环境/时间段/信号强度/板块 4维度分析 |
| 对比分析 | 自定义 Agent vs 标准模板 雷达图对比 |

**多维度分析展示**:
- 市场环境表现（牛市/熊市/震荡市）
- 时间段表现（早盘/午盘/尾盘）
- 信号强度表现（高/中/低置信度）
- Top 板块表现
- 市场环境趋势图

### 2. Agent 配置 (`AgentConfigPage.tsx`)

VIP 用户功能：

| 功能 | 说明 |
|------|------|
| 模板选择 | 4种预设模板（情绪/技术/资金/基本面） |
| 自定义配置 | 名称/描述/系统提示词 |
| 参数调节 | 创意度(temperature)/置信度阈值/最大token |
| 状态管理 | 启用/停用开关 |
| CRUD 操作 | 创建/编辑/删除 Agent |

### 3. 实时数据 (SSE)

```typescript
// hooks/useSSE.ts
const useSSE = (url: string) => {
  // 自动重连
  // 心跳检测
  // 断线恢复
}
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local

# 开发模式
pnpm dev

# 构建
pnpm build

# 生产启动
pnpm start
```

## 环境变量

```bash
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000

# 微信登录（可选）
NEXT_PUBLIC_WECHAT_APP_ID=your-app-id
```

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 产品展示 |
| `/dashboard` | 看板 | 用户数据看板（需登录） |
| `/agents` | Agent配置 | VIP 用户 Agent 管理（需登录） |
| `/login` | 登录 | 账号登录/微信登录 |
| `/register` | 注册 | 用户注册 |

## 组件使用示例

```tsx
// 使用看板组件
import UserAgentDashboard from "@/components/Dashboard/UserAgentDashboard";

export default function DashboardPage() {
  return <UserAgentDashboard />;
}
```

```tsx
// 使用 Agent 配置
import AgentConfigPage from "@/components/Dashboard/AgentConfigPage";

export default function AgentsPage() {
  return <AgentConfigPage />;
}
```
