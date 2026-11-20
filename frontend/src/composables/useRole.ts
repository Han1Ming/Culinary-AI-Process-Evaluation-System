import { computed } from 'vue'

import { can, ROLE_SCOPE } from '@/config/permissions'
import type { Capability } from '@/config/permissions'
import { useAuthStore } from '@/stores/auth'

/**
 * 角色能力判断
 * ----------------------------------------------------------------------------
 * 页面里不要写 `auth.role === 'teacher'`，统一走这里：
 * 一是能力点改名字时只改一处，二是权限清单能被检索出来做审计。
 */
export function useRole() {
  const auth = useAuthStore()

  const role = computed(() => auth.role)
  const scope = computed(() => ROLE_SCOPE[auth.role])

  return {
    role,
    scope,
    isStudent: computed(() => auth.role === 'student'),
    isTeacher: computed(() => auth.role === 'teacher'),
    isAdmin: computed(() => auth.role === 'admin'),
    /** 单个能力点 */
    can: (capability: Capability) => can(auth.role, capability),
  }
}
