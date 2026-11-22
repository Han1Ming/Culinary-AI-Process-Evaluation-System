import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { mockNotices, persistMockNotices } from '@/mock/notices'
import type { Notice, NoticeForm, UserRole } from '@/types'

/**
 * 通知公告接口
 * ----------------------------------------------------------------------------
 * 一条公告从「管理员写」到「学生看到」只走这一份数据，中间不复制：
 *   管理端 → fetchAllNotices（含草稿）
 *   接收端 → fetchNotices(role)（只已发布、按 audience 过滤）
 *   顶栏铃铛 / 工作台公告卡 / 公告中心页三处都读 fetchNotices，已读状态在 store 里。
 *
 * audience 是「谁能看到」的唯一依据：'all' 或角色数组。服务端必须按 token 的
 * 角色再过滤一遍，前端传 role 只是为了让 Mock 能演示多角色。
 */

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * 应读人数（Mock 口径，只有演示意义）。
 * 生产环境必须由后端按「实际在册且角色匹配的账号数」算，前端不许自己估。
 */
const AUDIENCE_TOTAL = { all: 386, role: 61 } as const

function audienceTotal(audience: Notice['audience']): number {
  return audience === 'all' ? AUDIENCE_TOTAL.all : AUDIENCE_TOTAL.role
}

function visible(item: Notice, role?: string): boolean {
  if (item.status !== 'published') return false
  if (item.audience === 'all') return true
  return role ? item.audience.includes(role as UserRole) : true
}

/** 当前角色可见的已发布通知（置顶优先，其次按发布时间倒序） */
export async function fetchNotices(role?: string): Promise<Notice[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return mockNotices
      .filter((item) => visible(item, role))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      )
      .map((item) => ({ ...item }))
  }
  return http.get<Notice[]>('/notices')
}

/** 管理端列表：含草稿 */
export async function fetchAllNotices(): Promise<Notice[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return [...mockNotices]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({ ...item }))
  }
  return http.get<Notice[]>('/notices', { scope: 'manage' })
}

export async function createNotice(form: NoticeForm): Promise<Notice> {
  if (USE_MOCK) {
    await mockDelay(500)
    const notice: Notice = {
      id: Date.now(),
      title: form.title,
      body: form.body,
      type: form.type,
      status: 'draft',
      pinned: form.pinned,
      audience: form.audience,
      publisher: '张明远',
      createdAt: nowText(),
      readCount: 0,
      totalCount: audienceTotal(form.audience),
    }
    mockNotices.unshift(notice)
    persistMockNotices()
    return { ...notice }
  }
  return http.post<Notice>('/notices', form)
}

export async function updateNotice(id: number, form: NoticeForm): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(420)
    const found = mockNotices.find((item) => item.id === id)
    if (!found) throw new Error('通知不存在')
    Object.assign(found, {
      title: form.title,
      body: form.body,
      type: form.type,
      pinned: form.pinned,
      audience: form.audience,
    })
    persistMockNotices()
    return
  }
  await http.put<null>(`/notices/${id}`, form)
}

export async function publishNotice(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(380)
    const found = mockNotices.find((item) => item.id === id)
    if (!found) throw new Error('通知不存在')
    found.status = 'published'
    found.publishedAt = nowText()
    found.readCount = 0
    // 草稿阶段没算应读人数，发布时补上；否则列表会显示「0/0 已读」
    if (!found.totalCount) found.totalCount = audienceTotal(found.audience)
    persistMockNotices()
    return
  }
  await http.post<null>(`/notices/${id}/publish`)
}

/** 撤回：回到草稿状态，学生端立即不可见 */
export async function revokeNotice(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(320)
    const found = mockNotices.find((item) => item.id === id)
    if (found) {
      found.status = 'draft'
      found.publishedAt = undefined
      found.readCount = 0
      persistMockNotices()
    }
    return
  }
  await http.post<null>(`/notices/${id}/revoke`)
}

export async function deleteNotice(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(300)
    const index = mockNotices.findIndex((item) => item.id === id)
    if (index >= 0) mockNotices.splice(index, 1)
    persistMockNotices()
    return
  }
  await http.delete<null>(`/notices/${id}`)
}

/**
 * 标记单条已读 POST /notices/{id}/read
 * 服务端按「用户 + 公告」唯一约束累加 readCount，重复调用不重复计数。
 * 前端同时写本地已读集合：断网或接口失败时红点也能正常消退。
 */
export async function markNoticeRead(id: number): Promise<number | void> {
  if (USE_MOCK) {
    await mockDelay(120)
    const found = mockNotices.find((item) => item.id === id)
    if (found && found.status === 'published') {
      found.readCount = Math.min(found.totalCount || found.readCount + 1, found.readCount + 1)
      persistMockNotices()
      return found.readCount
    }
    return
  }
  return http.post<number>(`/notices/${id}/read`)
}
