import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { buildProfileOverview } from '@/mock/profile'
import type { ProfileOverview } from '@/types/profile'

/**
 * 个人中心 GET /profile/overview?username=
 * ----------------------------------------------------------------------------
 * 为什么要传 username 而不是让后端从 token 取：
 * 真实环境应该完全不传（后端按 Authorization 解出本人），这里保留参数是为了
 * Mock 能在同一浏览器里切换演示账号。接后端时把参数去掉即可，前端其它地方不用改。
 */
export async function fetchProfileOverview(username: string): Promise<ProfileOverview> {
  if (USE_MOCK) {
    await mockDelay(240)
    return buildProfileOverview(username)
  }
  return http.get<ProfileOverview>('/profile/overview')
}

/** 更新本人联系方式 PUT /profile/contact —— 只允许改手机号与邮箱 */
export async function updateContact(payload: { phone: string; email: string }): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(320)
    return
  }
  await http.put<null>('/profile/contact', payload)
}
