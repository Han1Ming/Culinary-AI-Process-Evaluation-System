import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { mockNotices } from '@/mock/notices'
import type { Notice, NoticeForm } from '@/types'

/**
 * 通知公告接口
 * ----------------------------------------------------------------------------
 * 管理员发布，顶栏铃铛与工作台公告位都读这一份数据。
 * 学生 / 教师通过 audience 过滤：全站（'all'）或指定角色。
 */

/** 当前角色可见的已发布通知 */
export async function fetchNotices(role?: string): Promise<Notice[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return mockNotices
      .filter((item) => item.status === 'published')
      .filter((item) => item.audience === 'all' || (role ? item.audience.includes(role as never) : true))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  }
  return http.get<Notice[]>('/v1/notices')
}

/** 管理端列表：含草稿 */
export async function fetchAllNotices(): Promise<Notice[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return [...mockNotices].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
    )
  }
  return http.get<Notice[]>('/v1/notices', { scope: 'manage' })
}

export async function createNotice(form: NoticeForm): Promise<Notice> {
  if (USE_MOCK) {
    await mockDelay(500)
    const now = new Date()
    const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const notice: Notice = {
      id: Date.now(),
      title: form.title,
      body: form.body,
      type: form.type,
      status: 'draft',
      pinned: form.pinned,
      audience: form.audience,
      publisher: '张明远',
      createdAt: at,
      readCount: 0,
      totalCount: form.audience === 'all' ? 386 : 61,
    }
    mockNotices.unshift(notice)
    return notice
  }
  return http.post<Notice>('/v1/notices', form)
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
    return
  }
  await http.put<null>(`/v1/notices/${id}`, form)
}

export async function publishNotice(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(380)
    const found = mockNotices.find((item) => item.id === id)
    if (!found) throw new Error('通知不存在')
    const now = new Date()
    found.status = 'published'
    found.publishedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    found.readCount = 0
    return
  }
  await http.post<null>(`/v1/notices/${id}/publish`)
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
    }
    return
  }
  await http.post<null>(`/v1/notices/${id}/revoke`)
}

export async function deleteNotice(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(300)
    const index = mockNotices.findIndex((item) => item.id === id)
    if (index >= 0) mockNotices.splice(index, 1)
    return
  }
  await http.delete<null>(`/v1/notices/${id}`)
}
