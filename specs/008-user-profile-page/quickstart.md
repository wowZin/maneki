# Quickstart: 用户端个人信息页面

## 开发环境准备

```bash
cd /Users/zhangying/projects/maneki/apps/web
pnpm install
pnpm dev
```

## 新增页面入口

在 `apps/web/src/App.tsx` 中添加个人信息页路由：

```tsx
import Profile from './pages/Profile'

// 在 Routes 中添加
<Route path="/profile" element={<Profile />} />
```

## 文件创建清单

```
apps/web/src/
├── pages/
│   └── Profile/
│       ├── index.tsx          # 个人信息主页面
│       ├── EditNickname.tsx   # 修改昵称 Modal
│       ├── ChangePassword.tsx # 修改密码 Modal
│       └── AvatarUpload.tsx   # 头像上传组件
├── services/
│   └── user.ts                # 用户相关 API
└── stores/
    └── userProfile.ts         # 用户信息状态管理
```

## 接口对接顺序

1. **GET /api/v1/users/me** — 页面加载时获取个人信息
2. **PUT /api/v1/users/me** — 修改昵称
3. **POST /api/v1/users/me/avatar** — 上传头像
4. **POST /api/v1/users/me/password** — 修改密码
5. **GET /api/v1/users/me/rebate** — SVIP 返佣数据（条件渲染）

## 测试检查点

- [ ] 未登录用户访问 `/profile` 被重定向到登录页
- [ ] 页面加载 2 秒内展示所有信息
- [ ] 头像上传 jpg/png 成功，其他格式报错
- [ ] 昵称修改即时生效，页面无刷新
- [ ] 密码修改成功后下次登录需使用新密码
- [ ] VIP 用户不展示返佣区域
- [ ] SVIP 用户展示返佣金额，数值正确
