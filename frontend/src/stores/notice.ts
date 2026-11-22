import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchNotices, markNoticeRead } from '@/api/notice'
import { useAuthStore } from '@/stores/auth'
import type { Notice } from '@/types'

/**
 * 公告状态（唯一来源）
 * ----------------------------------------------------------------------------
 * 顶栏铃铛、工作台公告卡、公告中心页三处共用这一份，避免「铃铛有一套假数据、
 * 页面里是另一套」——之前那套写死的通知就是这么来的：管理员发布了公告，
 * 铃铛里还是「着装规范模型已更新」三条恒定内容，谁都看不出公告到底发没发出去。
 *
 * 已读状态为什么放本地：
 * 后端只提供「读了多少人」的聚合数，不记录谁读过（生产环境要记录则加
 * notice_reads 表，见 docs/后端开发任务书.md 6.11）。演示环境把已读集合存在
 * localStorage 里，按账号隔离，刷新、切页、重登都不会重新变红点。
 */

const READ_KEY_PREFIX = 'culinary_ai_notice_read_'

export const useNoticeStore = defineStore('notice', () => {
  const auth = useAuthStore()

  const items = ref<Notice[]>([])
  const loading = ref(false)
  const error = ref('')
  const readIds = ref<Set<number>>(new Set())
  const activeId = ref<number | null>(null)
  const loadedFor = ref('')

  const unread = computed(() => items.value.filter((item) => !readIds.value.has(item.id)))
  const unreadCount = computed(() => unread.value.length)
  const pinned = computed(() => items.value.filter((item) => item.pinned))
  const active = computed(
    () => items.value.find((item) => item.id === activeId.value) ?? null,
  )
  /** 顶栏只放最近 5 条，全部内容到 /notices */
  const latest = computed(() => items.value.slice(0, 5))

  function storageKey(): string {
    return `${READ_KEY_PREFIX}${auth.user?.username ?? 'guest'}`
  }

  function loadReadIds(): void {
    readIds.value = new Set()
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) return
      const parsed = JSON.parse(raw) as number[]
      if (Array.isArray(parsed)) readIds.value = new Set(parsed.filter((id) => typeof id === 'number'))
    } catch {
      // 数据坏了就当没读过，不影响列表
    }
  }

  function saveReadIds(): void {
    try {
      localStorage.setItem(storageKey(), JSON.stringify([...readIds.value]))
    } catch {
      // 隐私模式：只影响下次刷新
    }
  }

  /**
   * 拉取当前角色可见的公告。
   * force=false 时同一账号只拉一次：顶栏在每次路由切换都可能被触发，
   * 反复请求会让铃铛肉眼可见地闪。
   */
  async function refresh(force = false): Promise<void> {
    const key = `${auth.user?.username ?? 'guest'}:${auth.role}`
    // 换账号（或退出后换角色登录）先清干净，避免上一个账号的公告与红点残留
    if (loadedFor.value && loadedFor.value !== key) reset()
    if (!force && loadedFor.value === key) return
    loading.value = true
    error.value = ''
    try {
      items.value = await fetchNotices(auth.role)
      loadedFor.value = key
      loadReadIds()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '公告加载失败'
      // 公告是弱依赖：失败不清空已有列表，也不弹全局错误
    } finally {
      loading.value = false
    }
  }

  function isRead(id: number): boolean {
    return readIds.value.has(id)
  }

  function markRead(id: number): void {
    if (readIds.value.has(id)) return
    readIds.value = new Set(readIds.value).add(id)
    saveReadIds()
    // 服务端计数失败不回滚本地状态：用户确实看过了
    void markNoticeRead(id).catch(() => undefined)
  }

  function markAllRead(): void {
    // 先记下真正未读的，再整体置读：置读之后集合里全是已读，就分不出该给哪些发请求了
    const pending = items.value.filter((item) => !readIds.value.has(item.id))
    if (!pending.length) return
    const next = new Set(readIds.value)
    for (const item of pending) next.add(item.id)
    readIds.value = next
    saveReadIds()
    for (const item of pending) {
      void markNoticeRead(item.id).catch(() => undefined)
    }
  }

  function open(id: number): void {
    activeId.value = id
    markRead(id)
  }

  function close(): void {
    activeId.value = null
  }

  /** 退出登录时清空，避免换账号后看到上一个账号的红点状态 */
  function reset(): void {
    items.value = []
    readIds.value = new Set()
    activeId.value = null
    loadedFor.value = ''
    error.value = ''
  }

  return {
    items,
    latest,
    pinned,
    unread,
    unreadCount,
    loading,
    error,
    active,
    activeId,
    isRead,
    refresh,
    markRead,
    markAllRead,
    open,
    close,
    reset,
  }
})
