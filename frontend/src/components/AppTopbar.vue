<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useNoticeStore } from '@/stores/notice'
import { formatDateTime } from '@/utils/format'
import { NOTICE_TYPE_LABELS, ROLE_LABELS } from '@/types'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const noticeStore = useNoticeStore()

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
    // 与侧栏底部的「个人中心」是同一个页面，不另开弹窗：
    // 两处入口两种形态，用户会以为是两个不同的东西
    void router.push('/profile')
    return
  }
  if (command === 'read') {
    noticeStore.markAllRead()
    ElMessage.success('公告已全部标记为已读')
  }
}

function openNotice(id: number): void {
  noticeStore.open(id)
}

function goNotices(): void {
  void router.push('/notices')
}

/** 铃铛列表：只取标题与时间，正文交给全局阅读器 */
function excerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}

onMounted(() => {
  void noticeStore.refresh()
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
      <!--
        原来这里有一个「搜索学生、课程或评价记录」的输入框，回车只弹一句
        「待对接 /v1/search」——一个永远不出结果的搜索框比没有更糟，
        这轮按「去除冗余」的要求直接移除，等后端有全局搜索再做成真功能。
      -->
      <el-popover placement="bottom-end" :width="340" trigger="click" popper-class="topbar-popover">
        <template #reference>
          <button class="icon-btn" type="button" aria-label="公告">
            <el-icon><Bell /></el-icon>
            <span v-if="noticeStore.unreadCount > 0" class="icon-btn__dot" aria-hidden="true" />
          </button>
        </template>

        <div class="notice">
          <div class="notice__head">
            <span class="notice__title">
              公告
              <span v-if="noticeStore.unreadCount" class="notice__badge num">
                {{ noticeStore.unreadCount }}
              </span>
            </span>
            <el-button
              link
              type="primary"
              size="small"
              :disabled="!noticeStore.unreadCount"
              @click="noticeStore.markAllRead()"
            >
              全部已读
            </el-button>
          </div>

          <ul class="notice__list">
            <li v-for="item in noticeStore.latest" :key="item.id">
              <button
                type="button"
                class="notice__item"
                :class="{ 'is-unread': !noticeStore.isRead(item.id) }"
                @click="openNotice(item.id)"
              >
                <span class="notice__dot" :class="`notice__dot--${item.type}`" aria-hidden="true" />
                <span class="notice__content">
                  <span class="notice__item-title">
                    <span v-if="item.pinned" class="notice__pin">置顶</span>
                    {{ item.title }}
                  </span>
                  <span class="notice__desc">{{ excerpt(item.body) }}</span>
                  <span class="notice__time num">
                    {{ NOTICE_TYPE_LABELS[item.type] }}
                    <span class="notice__sep">·</span>
                    {{ formatDateTime(item.publishedAt, 'MM-DD HH:mm') }}
                  </span>
                </span>
              </button>
            </li>
            <li v-if="!noticeStore.latest.length" class="notice__empty">
              {{ noticeStore.loading ? '正在读取公告…' : '暂无公告' }}
            </li>
          </ul>

          <div class="notice__foot">
            <el-button link type="primary" size="small" @click="goNotices">查看全部公告</el-button>
          </div>
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
  // 玻璃顶栏：滚动时内容从下面穿过，模糊才有意义；不透明顶栏会像贴了一条白纸
  background: $glass-bg-strong;
  border-bottom: 1px solid rgba(17, 19, 24, 0.06);
  backdrop-filter: saturate(160%) blur($glass-blur);
  -webkit-backdrop-filter: saturate(160%) blur($glass-blur);
  position: relative;
  z-index: 10;

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
    display: inline-flex;
    gap: 5px;
    align-items: center;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
  }

  &__badge {
    padding: 0 5px;
    font-size: 10px;
    font-weight: $font-weight-medium;
    line-height: 15px;
    color: #fff;
    background: $color-danger;
    border-radius: $radius-pill;
  }

  &__list {
    max-height: 320px;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    list-style: none;
  }

  // 每一条都是按钮：整条可点，点开正文
  &__item {
    display: flex;
    gap: $space-2;
    width: 100%;
    padding: 10px 0;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: none;
    border-bottom: 1px solid $color-border-light;

    &:last-child {
      border-bottom: none;
    }

    &:hover .notice__item-title {
      color: $color-primary;
    }

    &.is-unread .notice__item-title {
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  // 类型点：系统公告/功能更新/维护通知三色只用在 5px 圆点上
  &__dot {
    flex: 0 0 5px;
    width: 5px;
    height: 5px;
    margin-top: 7px;
    background: $color-text-placeholder;
    border-radius: 50%;

    &--feature {
      background: $color-primary;
    }

    &--maintenance {
      background: $color-warning-dot;
    }

    &--system {
      background: $color-success-dot;
    }
  }

  &__content {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__pin {
    padding: 0 4px;
    margin-right: 3px;
    font-size: 9.5px;
    color: $color-primary;
    background: $color-primary-soft;
    border-radius: 2px;
  }

  &__item-title {
    font-size: $font-size-sm;
    line-height: 1.45;
    color: $color-text-regular;
    transition: color $duration-fast $ease-standard;
  }

  &__desc {
    overflow: hidden;
    font-size: $font-size-xs;
    line-height: 1.5;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__sep {
    margin: 0 4px;
  }

  &__empty {
    padding: $space-6 0;
    font-size: $font-size-sm;
    color: $color-text-placeholder;
    text-align: center;
  }

  &__foot {
    display: flex;
    justify-content: center;
    padding-top: $space-2;
    margin-top: $space-1;
    border-top: 1px solid $color-border-light;
  }
}

@media (max-width: $breakpoint-lg) {
  .topbar {
    padding: 0 $space-4;

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
