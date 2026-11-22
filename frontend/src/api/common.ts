import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'

/**
 * 通用接口：健康检查等跨模块能力
 *
 * 这里曾经有一个 `fetchNotifications()`，返回三条写死的「着装规范模型已更新」，
 * 与 `通知发布` 页毫无关系——管理员发布公告后顶栏毫无变化，问题就出在这。
 * 公告已统一到 `api/notice.ts` + `stores/notice.ts`，不要再从本文件另开一套。
 */

/** 后端健康检查 GET /health，用于登录页提示后端是否在线 */
export async function checkBackendHealth(): Promise<boolean> {
  if (USE_MOCK) return false
  try {
    await http.get<{ status: string }>('/health', undefined, { timeout: 3000 })
    return true
  } catch {
    return false
  }
}
