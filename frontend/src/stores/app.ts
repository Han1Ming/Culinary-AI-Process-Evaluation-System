import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchNotifications, type NotificationItem } from '@/api/common'

const COLLAPSE_KEY = 'culinary_ai_sidebar_collapsed'

/** 全局 UI 状态：侧边栏折叠、通知、移动端抽屉 */
export const useAppStore = defineStore('app', () => {
  const isCollapse = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
  const notifications = ref<NotificationItem[]>([])
  const mobileNavOpen = ref(false)

  const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length)
  // 与 variables.scss 的 $sidebar-width / $sidebar-width-collapsed 保持一致
  const sidebarWidth = computed(() => (isCollapse.value ? 64 : 220))

  function toggleCollapse(): void {
    isCollapse.value = !isCollapse.value
    localStorage.setItem(COLLAPSE_KEY, isCollapse.value ? '1' : '0')
  }

  function setMobileNav(open: boolean): void {
    mobileNavOpen.value = open
  }

  async function loadNotifications(): Promise<void> {
    try {
      notifications.value = await fetchNotifications()
    } catch {
      // 通知属于弱依赖，失败静默
    }
  }

  function markAllRead(): void {
    notifications.value = notifications.value.map((item) => ({ ...item, read: true }))
  }

  return {
    isCollapse,
    notifications,
    mobileNavOpen,
    unreadCount,
    sidebarWidth,
    toggleCollapse,
    setMobileNav,
    loadNotifications,
    markAllRead,
  }
})
