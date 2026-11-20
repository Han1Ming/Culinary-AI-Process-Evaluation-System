import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { getProfile, login as loginApi, logout as logoutApi } from '@/api/auth'
import { clearToken, getToken, setToken } from '@/utils/token'
import type { LoginPayload, User, UserRole } from '@/types'

/**
 * 鉴权状态
 * - token 持久化到 localStorage，刷新后自动恢复
 * - user 为空时由路由守卫触发 fetchProfile 补全
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const user = ref<User | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => user.value?.name ?? '访客')
  const role = computed<UserRole>(() => user.value?.role ?? 'student')
  const initial = computed(() => displayName.value.slice(0, 1))

  function reset(): void {
    token.value = ''
    user.value = null
    clearToken()
  }

  async function login(payload: LoginPayload): Promise<void> {
    loading.value = true
    try {
      const result = await loginApi(payload)
      token.value = result.token
      user.value = result.user
      setToken(result.token)
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile(): Promise<void> {
    if (!token.value || user.value) return
    try {
      user.value = await getProfile()
    } catch {
      reset()
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutApi()
    } catch {
      // 后端不可用时也要允许本地退出
    } finally {
      reset()
    }
  }

  return { token, user, loading, isLoggedIn, displayName, role, initial, login, logout, fetchProfile, reset }
})
