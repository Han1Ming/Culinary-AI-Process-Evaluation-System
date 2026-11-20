import { ElMessage } from 'element-plus'
import type { Router } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { APP_TITLE } from '@/utils/env'

/**
 * 路由守卫
 * 1. 未登录 → /login?redirect=...
 * 2. 已登录访问 /login → 回工作台
 * 3. 首次进入补拉用户信息（刷新后 store 为空）
 * 4. 角色校验（meta.roles）
 * 5. 统一维护 document.title
 */
export function setupRouterGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.public) {
      if (to.path === '/login' && auth.isLoggedIn) return { path: '/dashboard' }
      return true
    }

    if (!auth.isLoggedIn) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (!auth.user) {
      await auth.fetchProfile()
      if (!auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } }
    }

    const allowed = to.meta.roles
    if (allowed && !allowed.includes(auth.role)) {
      ElMessage.warning('当前账号无权访问该页面')
      return { path: '/dashboard' }
    }

    return true
  })

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · ${APP_TITLE}` : APP_TITLE
  })
}
