import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { getToken } from '@/utils/token'
import { mockDelay, mockUsers } from '@/mock'
import type { LoginPayload, LoginResult, RegisterPayload, RegisterResult, User } from '@/types'

/** 登录 POST /v1/auth/login */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  if (USE_MOCK) {
    await mockDelay(600)
    const user = mockUsers.find((item) => item.username === payload.username)
    if (!user || payload.password !== '123456') {
      throw new Error('账号或密码错误（Mock 模式演示账号：admin / 123456）')
    }
    return { token: `mock-token-${user.id}`, user }
  }
  return http.post<LoginResult>('/v1/auth/login', payload)
}

/**
 * 注册 / 申请开通 POST /v1/auth/register
 * 学生账号在真实环境需管理员审核（needApproval），Mock 下直接返回成功。
 * 人脸照片以 dataURL 形式提交，后端应转存对象存储并只保留 URL。
 */
export async function registerAccount(payload: RegisterPayload): Promise<RegisterResult> {
  if (USE_MOCK) {
    await mockDelay(900)
    if (mockUsers.some((item) => item.username === payload.username)) {
      throw new Error('该账号已存在，请更换用户名')
    }
    return { id: Date.now(), username: payload.username, needApproval: true }
  }
  return http.post<RegisterResult>('/v1/auth/register', payload)
}

/** 获取当前登录用户信息 GET /v1/auth/profile */
export async function getProfile(): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(120)
    const id = Number(getToken().replace('mock-token-', ''))
    return mockUsers.find((item) => item.id === id) ?? mockUsers[0]
  }
  return http.get<User>('/v1/auth/profile')
}

/** 退出登录 POST /v1/auth/logout */
export async function logout(): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(120)
    return
  }
  await http.post<null>('/v1/auth/logout')
}
