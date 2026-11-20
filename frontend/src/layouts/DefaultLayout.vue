<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import AssistantBall from '@/components/AssistantBall.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

/**
 * 后台主框架
 * ----------------------------------------------------------------------------
 * 结构：el-aside（可折叠 220 / 64）+ 右侧 el-container(vertical)：顶栏 + 内容区
 *
 * 流畅度相关的三个处理：
 *  1. 顶栏不用 backdrop-filter —— 固定层上做背景模糊会让每次滚动都重绘，掉帧的常见来源
 *  2. 切换路由后把内容区滚回顶部，否则新页面会停在上一页的滚动位置
 *  3. 侧栏宽度变化只影响自身，主区域用 min-width:0 + flex 自适应，不触发整页回流
 */
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()

const mainRef = ref<HTMLElement>()

const mobileNav = computed({
  get: () => appStore.mobileNavOpen,
  set: (value: boolean) => appStore.setMobileNav(value),
})

// 路由切换后归零滚动位置（在 DOM 更新后执行，避免读到旧高度）
watch(
  () => route.path,
  async () => {
    await nextTick()
    mainRef.value?.scrollTo({ top: 0 })
  },
)

onMounted(() => {
  // 刷新后补拉用户资料，保证顶栏头像与角色正确
  void authStore.fetchProfile()
})
</script>

<template>
  <el-container class="layout">
    <el-aside class="layout__aside" :width="`${appStore.sidebarWidth}px`">
      <AppSidebar :collapse="appStore.isCollapse" />
    </el-aside>

    <el-container class="layout__body" direction="vertical">
      <el-header class="layout__header" :height="`${56}px`">
        <AppTopbar />
      </el-header>

      <el-main ref="mainRef" class="layout__main">
        <div class="layout__content">
          <router-view v-slot="{ Component, route: current }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" :key="current.path" />
            </transition>
          </router-view>
        </div>
      </el-main>
    </el-container>

    <!-- 移动端抽屉菜单 -->
    <el-drawer
      v-model="mobileNav"
      direction="ltr"
      size="240px"
      :with-header="false"
      class="layout__drawer"
    >
      <AppSidebar :collapse="false" @navigate="mobileNav = false" />
    </el-drawer>

    <!-- 全站浮空助手：固定在右下角，不参与 flex 布局 -->
    <AssistantBall />
  </el-container>
</template>

<style scoped lang="scss">
.layout {
  height: 100vh;
  overflow: hidden;
  background: $color-bg-page;

  &__aside {
    height: 100vh;
    overflow: hidden;
    background: $color-bg-surface;
    // 只过渡宽度，且用短时长，避免拖影
    transition: width $duration-base $ease-standard;
    will-change: width;
  }

  &__body {
    height: 100vh;
    min-width: 0;
  }

  &__header {
    flex-shrink: 0;
    height: $header-height;
    padding: 0;
  }

  &__main {
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
    background: $color-bg-page;
    // 独立滚动容器：滚动到边界时不带动父级
    overscroll-behavior: contain;
  }

  &__content {
    max-width: $content-max-width;
    padding: 20px 24px 32px;
    margin: 0 auto;
  }
}

@media (max-width: $breakpoint-lg) {
  .layout__aside {
    display: none;
  }

  .layout__content {
    padding: $space-4 $space-4 $space-6;
  }
}

:deep(.layout__drawer .el-drawer__body) {
  padding: 0;
}
</style>
