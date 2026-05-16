/**
 * E2E 测试数据准备工具
 * 通过直接调用后端 API 创建/清理测试数据
 */
import { APIRequestContext } from '@playwright/test'

const API_BASE_URL = 'http://localhost:8080/api/v1'

// ===== 管理员相关 =====

export interface AdminUser {
  id: number
  name: string
  role: string
  token?: string
}

export async function createAdmin(
  request: APIRequestContext,
  name: string,
  password: string,
  role: 'super' | 'admin' = 'admin'
): Promise<AdminUser> {
  // 需要先以 super admin 登录，然后创建管理员
  // 这里假设已有一个默认 super admin
  const superAdmin = await loginAdmin(request, 'superadmin', 'SuperPass123!')

  const resp = await request.post(`${API_BASE_URL}/admin/admins`, {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    data: {
      name,
      password,
      role,
      is_active: true,
    },
  })

  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`创建管理员失败: ${resp.status()} ${body}`)
  }

  const result = await resp.json()
  return {
    id: result.data?.id,
    name,
    role,
  }
}

export async function loginAdmin(
  request: APIRequestContext,
  name: string,
  password: string
): Promise<AdminUser & { token: string }> {
  const resp = await request.post(`${API_BASE_URL}/admin/auth/login`, {
    data: { name, password },
  })

  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`管理员登录失败: ${resp.status()} ${body}`)
  }

  const result = await resp.json()
  const admin = result.data?.admin
  const token = result.data?.token

  return {
    id: admin?.id,
    name: admin?.name,
    role: admin?.role,
    token,
  }
}

// ===== 普通用户相关 =====

export interface TestUser {
  id: string
  phone: string
  nickname: string
  token: string
  vip_level: number
}

export async function registerUser(
  request: APIRequestContext,
  phone: string,
  password: string,
  nickname: string
): Promise<TestUser> {
  const resp = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      phone,
      password,
      confirm_password: password,
      nickname,
    },
  })

  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`注册用户失败: ${resp.status()} ${body}`)
  }

  const result = await resp.json()
  return {
    id: result.user?.id,
    phone,
    nickname,
    token: result.access_token,
    vip_level: result.user?.vip_level || 0,
  }
}

export async function loginUser(
  request: APIRequestContext,
  account: string,
  password: string
): Promise<TestUser> {
  const resp = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { account, password },
  })

  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`用户登录失败: ${resp.status()} ${body}`)
  }

  const result = await resp.json()
  return {
    id: result.user?.id,
    phone: result.user?.phone,
    nickname: result.user?.nickname,
    token: result.access_token,
    vip_level: result.user?.vip_level || 0,
  }
}

// ===== Agent 相关 =====

export interface TestAgent {
  id: number
  name: string
  type: string
  category: string
  is_active: boolean
  is_featured: boolean
  is_official: boolean
}

export async function createAgent(
  request: APIRequestContext,
  adminToken: string,
  agent: Partial<TestAgent>
): Promise<TestAgent> {
  const resp = await request.post(`${API_BASE_URL}/admin/agents`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: agent.name || `TestAgent_${Date.now()}`,
      description: agent.description || '测试 Agent',
      type: agent.type || 'technical',
      category: agent.category || 'trend',
      prompt: agent.prompt || '你是一个股票分析助手',
      model: agent.model || 'gpt-4o-mini',
      is_active: agent.is_active ?? true,
      is_featured: agent.is_featured ?? false,
      is_official: agent.is_official ?? true,
      ...agent,
    },
  })

  if (!resp.ok()) {
    const body = await resp.text()
    throw new Error(`创建 Agent 失败: ${resp.status()} ${body}`)
  }

  const result = await resp.json()
  return result.data ?? result
}

export async function deleteAgent(
  request: APIRequestContext,
  adminToken: string,
  agentId: number
): Promise<void> {
  const resp = await request.delete(`${API_BASE_URL}/admin/agents/${agentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })

  if (!resp.ok() && resp.status() !== 404) {
    const body = await resp.text()
    throw new Error(`删除 Agent 失败: ${resp.status()} ${body}`)
  }
}

// ===== 数据清理 =====

export async function cleanupTestData(
  request: APIRequestContext,
  adminToken: string,
  agentIds: number[]
): Promise<void> {
  for (const id of agentIds) {
    try {
      await deleteAgent(request, adminToken, id)
    } catch {
      // 忽略清理错误
    }
  }
}
