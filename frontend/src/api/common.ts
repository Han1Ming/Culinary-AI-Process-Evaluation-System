import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'

/** 通用接口：字典、通知、健康检查等跨模块能力 */

export interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  type: 'info' | 'success' | 'warning'
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: '着装规范模型已更新', description: '识别准确率提升至 97.1%', time: '10 分钟前', read: false, type: 'success' },
  { id: 'n2', title: '3 条评价异常待复核', description: '《中式热菜制作》第 4 组', time: '1 小时前', read: false, type: 'warning' },
  { id: 'n3', title: '本周教学周报已生成', description: '可前往工作台下载', time: '昨天', read: true, type: 'info' },
]

/** 站内通知 GET /v1/notifications */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  if (USE_MOCK) {
    await mockDelay(150)
    return MOCK_NOTIFICATIONS
  }
  return http.get<NotificationItem[]>('/v1/notifications')
}

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
