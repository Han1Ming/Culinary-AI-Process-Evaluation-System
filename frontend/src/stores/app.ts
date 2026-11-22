import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const COLLAPSE_KEY = 'culinary_ai_sidebar_collapsed'

/**
 * 全局 UI 状态：侧边栏折叠、移动端抽屉
 *
 * 公告（未读红点、已读集合、阅读器）在 `stores/notice.ts`，不放在这里：
 * 那是业务数据，和「侧栏折不折」不是一类东西。之前这里存过一份写死的
 * 通知列表，结果是管理员发了公告、铃铛里还是那三条恒定内容。
 */
export const useAppStore = defineStore('app', () => {
  const isCollapse = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
  const mobileNavOpen = ref(false)

  // 与 variables.scss 的 $sidebar-width / $sidebar-width-collapsed 保持一致
  const sidebarWidth = computed(() => (isCollapse.value ? 64 : 220))

  function toggleCollapse(): void {
    isCollapse.value = !isCollapse.value
    localStorage.setItem(COLLAPSE_KEY, isCollapse.value ? '1' : '0')
  }

  function setMobileNav(open: boolean): void {
    mobileNavOpen.value = open
  }

  return {
    isCollapse,
    mobileNavOpen,
    sidebarWidth,
    toggleCollapse,
    setMobileNav,
  }
})
