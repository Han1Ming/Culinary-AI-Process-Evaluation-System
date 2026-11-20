<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/types'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const keyword = ref('')

/**
 * 面包屑
 * 首页只显示「工作台」一项：在首页再写一遍「工作台 / 工作台」是最常见的冗余。
 */
const breadcrumbs = computed(() => {
  const list: Array<{ title: string; path: string }> = []
  if (route.path !== '/dashboard') {
    list.push({ title: '工作台', path: '/dashboard' })
    if (route.meta.parentTitle) list.push({ title: route.meta.parentTitle, path: '' })
  }
  if (route.meta.title) list.push({ title: route.meta.title, path: route.path })
  return list
})

const roleLabel = computed(() => ROLE_LABELS[authStore.role])

function handleSearch(): void {
  const value = keyword.value.trim()
  if (!value) {
    ElMessage.info('请输入搜索关键词')
    return
  }
  ElMessage.info(`全局搜索「${value}」待对接后端 /v1/search`)
}

/** Ctrl/Cmd + K 聚焦搜索框 */
function handleShortcut(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    document.querySelector<HTMLInputElement>('.topbar__search input')?.focus()
  }
}

async function handleLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('退出后需要重新登录才能继续使用系统。', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await authStore.logout()
  ElMessage.success('已安全退出')
  await router.replace('/login')
}

function handleCommand(command: string): void {
  if (command === 'logout') {
    void handleLogout()
    return
  }
  if (command === 'profile') {
    ElMessage.info('个人中心待对接：GET /v1/auth/profile')
    return
  }
  appStore.markAllRead()
  ElMessage.success('通知已全部标记为已读')
}

onMounted(() => {
  document.addEventListener('keydown', handleShortcut)
  void appStore.loadNotifications()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleShortcut)
})
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <button
        class="icon-btn topbar__menu-trigger"
        type="button"
        aria-label="打开菜单"
        @click="appStore.setMobileNav(true)"
      >
        <el-icon><Menu /></el-icon>
      </button>

      <el-breadcrumb separator="/" class="topbar__breadcrumb">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="`${item.title}-${index}`"
          :to="item.path && index < breadcrumbs.length - 1 ? { path: item.path } : undefined"
        >
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="topbar__right">
      <el-input
        v-model="keyword"
        class="topbar__search"
        placeholder="搜索学生、课程或评价记录"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #suffix>
          <kbd class="topbar__kbd">Ctrl K</kbd>
        </template>
      </el-input>

      <el-popover placement="bottom-end" :width="320" trigger="click" popper-class="topbar-popover">
        <template #reference>
          <button class="icon-btn" type="button" aria-label="通知">
            <el-icon><Bell /></el-icon>
            <span v-if="appStore.unreadCount > 0" class="icon-btn__dot" aria-hidden="true" />
          </button>
        </template>

        <div class="notice">
          <div class="notice__head">
            <span class="notice__title">通知</span>
            <el-button link type="primary" size="small" @click="handleCommand('read')">
              全部已读
            </el-button>
          </div>
          <ul class="notice__list">
            <li
              v-for="item in appStore.notifications"
              :key="item.id"
              class="notice__item"
              :class="{ 'is-unread': !item.read }"
            >
              <span class="notice__dot" :class="`notice__dot--${item.type}`" />
              <div class="notice__content">
                <p class="notice__item-title">{{ item.title }}</p>
                <p class="notice__desc">{{ item.description }}</p>
                <span class="notice__time">{{ item.time }}</span>
              </div>
            </li>
            <li v-if="!appStore.notifications.length" class="notice__empty">暂无通知</li>
          </ul>
        </div>
      </el-popover>

      <span class="topbar__divider" />

      <el-dropdown trigger="click" @command="handleCommand">
        <button class="topbar__user" type="button">
          <span class="topbar__avatar">{{ authStore.initial }}</span>
          <span class="topbar__user-meta">
            <strong>{{ authStore.displayName }}</strong>
            <small>{{ roleLabel }}</small>
          </span>
          <el-icon class="topbar__caret"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>个人中心
            </el-dropdown-item>
            <el-dropdown-item command="read" divided>
              <el-icon><Select /></el-icon>标记通知已读
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped lang="scss">
.topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: $header-height;
  padding: 0 $space-6 0 $space-5;
  background: $color-bg-surface;
  border-bottom: 1px solid $color-border-light;

  &__left,
  &__right {
    display: flex;
    gap: $space-3;
    align-items: center;
  }

  // 提高选择器权重，避免被下方 .icon-btn 的 display 覆盖
  .topbar__menu-trigger {
    display: none;
  }

  &__breadcrumb {
    font-size: $font-size-sm;

    :deep(.el-breadcrumb__inner) {
      font-weight: $font-weight-regular;
      color: $color-text-secondary;

      &.is-link:hover {
        color: $color-text-primary;
      }
    }

    :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }

    :deep(.el-breadcrumb__separator) {
      color: $color-text-placeholder;
    }
  }

  &__search {
    width: 250px;

    :deep(.el-input__wrapper) {
      background: $color-bg-subtle;
      border-radius: $radius-md;
      box-shadow: none;
      transition: background-color $duration-fast $ease-standard,
        box-shadow $duration-fast $ease-standard;
    }

    :deep(.el-input__wrapper:hover) {
      background: #efeff1;
    }

    :deep(.el-input__wrapper.is-focus) {
      background: $color-bg-surface;
      box-shadow: 0 0 0 1px $color-primary inset, $shadow-focus !important;
    }

    :deep(.el-input__inner) {
      font-size: $font-size-sm;
    }
  }

  &__kbd {
    padding: 1px 5px;
    font-family: $font-family-base;
    font-size: 10px;
    line-height: 14px;
    color: $color-text-placeholder;
    background: $color-bg-surface;
    border: 1px solid $color-border;
    border-radius: $radius-xs;
  }

  &__divider {
    width: 1px;
    height: 20px;
    background: $color-border-light;
  }

  &__user {
    display: flex;
    gap: $space-2;
    align-items: center;
    padding: 3px 8px 3px 3px;
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: $radius-pill;
    transition: background-color $duration-fast $ease-standard;

    &:hover {
      background: $color-bg-subtle;
    }
  }

  // 头像是深墨底白字：中性、克制，不用蓝色渐变
  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: #fff;
    background: $color-text-primary;
    border-radius: $radius-pill;
  }

  &__user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    text-align: left;

    strong {
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }

    small {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__caret {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: $color-text-regular;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-md;
  transition: background-color $duration-fast $ease-standard,
    color $duration-fast $ease-standard;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-subtle;
  }

  // 未读红点：6px，压在图标右上角
  &__dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 6px;
    height: 6px;
    background: $color-danger-dot;
    border: 1.5px solid $color-bg-surface;
    border-radius: 50%;
  }
}

.notice {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: $space-2;
    border-bottom: 1px solid $color-border-light;
  }

  &__title {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
  }

  &__list {
    max-height: 320px;
    margin: 0;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    gap: $space-2;
    padding: $space-3 0;
    border-bottom: 1px solid $color-border-light;

    &:last-child {
      border-bottom: none;
    }

    &.is-unread .notice__item-title {
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  &__dot {
    flex: 0 0 5px;
    width: 5px;
    height: 5px;
    margin-top: 7px;
    background: $color-text-placeholder;
    border-radius: 50%;

    &--success {
      background: $color-success-dot;
    }

    &--warning {
      background: $color-warning-dot;
    }

    &--info {
      background: $color-primary;
    }
  }

  &__item-title {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__desc {
    margin-top: 2px;
    font-size: $font-size-xs;
    line-height: 1.5;
    color: $color-text-secondary;
  }

  &__time {
    display: inline-block;
    margin-top: 4px;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__empty {
    padding: $space-6 0;
    font-size: $font-size-sm;
    color: $color-text-placeholder;
    text-align: center;
  }
}

@media (max-width: $breakpoint-lg) {
  .topbar {
    padding: 0 $space-4;

    &__search {
      width: 180px;
    }

    // 与上方 .topbar .topbar__menu-trigger 同权重，才能覆盖隐藏规则
    .topbar__menu-trigger {
      display: inline-flex;
    }

    &__user-meta {
      display: none;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .topbar__search {
    display: none;
  }
}
</style>
