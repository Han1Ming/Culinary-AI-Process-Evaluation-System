import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDashboard, mockDelay, mockMyOverview, mockUsers } from '@/mock'
import type {
  DashboardOverview,
  MyOverview,
  PageResult,
  User,
  UserForm,
  UserQuery,
} from '@/types'

/**
 * 用户管理接口（系统管理模块）
 * 接口路径统一 /v1/users，与 FastAPI 端 users.py 对应
 * 说明：教师后续新增业务模块时，按同样方式在 api/ 下新建文件即可
 */

// Mock 模式下用内存数组模拟后端，保证增删改查闭环可演示
const mockDb: User[] = [...mockUsers]
let nextId = Math.max(...mockDb.map((item) => item.id)) + 1

export async function fetchUsers(query: UserQuery): Promise<PageResult<User>> {
  if (USE_MOCK) {
    await mockDelay(320)
    const keyword = (query.keyword ?? '').trim().toLowerCase()
    const filtered = mockDb.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.username.toLowerCase().includes(keyword) ||
        (item.studentNo ?? '').includes(keyword)
      const matchRole = !query.role || item.role === query.role
      const matchStatus = query.status === '' || query.status === undefined || item.status === query.status
      return matchKeyword && matchRole && matchStatus
    })
    const start = (query.page - 1) * query.pageSize
    return {
      list: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  return http.get<PageResult<User>>('/v1/users', query)
}

export async function createUser(payload: UserForm): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(260)
    const user: User = {
      id: nextId++,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      phone: payload.phone,
      email: payload.email || undefined,
      department: payload.department || undefined,
      studentNo: payload.role === 'student' ? payload.username : undefined,
      status: payload.status,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
    mockDb.unshift(user)
    return user
  }
  return http.post<User>('/v1/users', payload)
}

export async function updateUser(id: number, payload: UserForm): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(260)
    const index = mockDb.findIndex((item) => item.id === id)
    if (index === -1) throw new Error('用户不存在')
    mockDb[index] = { ...mockDb[index], ...payload, email: payload.email || undefined }
    return mockDb[index]
  }
  return http.put<User>(`/v1/users/${id}`, payload)
}

/**
 * 补录 / 更换人脸照片 PUT /v1/users/{id}/face
 * ----------------------------------------------------------------------------
 * 单独一个接口而不是走 updateUser：编辑用户是改资料，补录照片是动底库，
 * 两个动作的审计口径不一样（照片要留采集人、采集时间）。
 * 入参 dataURL（前端已压到 480px 宽），后端负责转存并回写地址。
 */
export async function updateUserFace(id: number, facePhoto: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(320)
    const index = mockDb.findIndex((item) => item.id === id)
    if (index === -1) throw new Error('用户不存在')
    mockDb[index] = { ...mockDb[index], facePhoto, faceRegistered: true }
    return
  }
  await http.put<null>(`/v1/users/${id}/face`, { facePhoto })
}

export async function deleteUser(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(200)
    const index = mockDb.findIndex((item) => item.id === id)
    if (index !== -1) mockDb.splice(index, 1)
    return
  }
  await http.delete<null>(`/v1/users/${id}`)
}

/** 工作台概览 GET /v1/dashboard/overview（教师 / 管理员） */
export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  if (USE_MOCK) {
    await mockDelay(260)
    return mockDashboard
  }
  return http.get<DashboardOverview>('/v1/dashboard/overview')
}

/**
 * 学生工作台 GET /v1/dashboard/me
 * ----------------------------------------------------------------------------
 * 单独一个接口而不是给 overview 加角色参数：两者的字段集合差别太大，
 * 合成一个会让后端在每个分支里塞一堆空字段，学生也不该拿到班级维度的数据。
 */
export async function fetchMyOverview(): Promise<MyOverview> {
  if (USE_MOCK) {
    await mockDelay(260)
    return mockMyOverview
  }
  return http.get<MyOverview>('/v1/dashboard/me')
}
