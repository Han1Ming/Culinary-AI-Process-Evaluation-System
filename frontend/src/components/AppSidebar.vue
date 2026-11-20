<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppLogo from './AppLogo.vue'
import { menuGroups, type MenuGroup } from '@/router/menu'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ collapse: boolean }>()
const emit = defineEmits<{ navigate: [path: string] }>()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

/** 按当前角色过滤：子项全部无权限时隐藏父级，整组为空时隐藏分组 */
const visibleGroups = computed<MenuGroup[]>(() =>
  menuGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.roles || item.roles.includes(authStore.role))
        .map((item) => {
          if (!item.children) return item
          const children = item.children.filter(
            (child) => !child.roles || child.roles.includes(authStore.role),
          )
          return { ...item, children }
        })
        .filter((item) => !item.children || item.children.length > 0),
    }))
    .filter((group) => group.items.length > 0),
)

const activePath = computed(() => route.path)

function handleSelect(path: string): void {
  if (path !== route.path) void router.push(path)
  emit('navigate', path)
}
</script>

<template>
  <div class="app-sidebar" :class="{ 'is-collapsed': props.collapse }">
    <div class="app-sidebar__brand">
      <AppLogo :collapsed="props.collapse" />
    </div>

    <el-scrollbar class="app-sidebar__scroll">
      <nav class="app-sidebar__nav" aria-label="主导航">
        <section v-for="group in visibleGroups" :key="group.title" class="nav-group">
          <!-- 折叠时用一条细线替代文字标题，保留分节节奏 -->
          <p v-if="!props.collapse" class="nav-group__title">{{ group.title }}</p>
          <span v-else class="nav-group__rule" aria-hidden="true" />

          <el-menu
            :default-active="activePath"
            :collapse="props.collapse"
            :collapse-transition="false"
            unique-opened
            class="app-sidebar__menu"
            @select="handleSelect"
          >
            <template v-for="item in group.items" :key="item.path">
              <el-sub-menu v-if="item.children?.length" :index="item.path">
                <template #title>
                  <el-icon><component :is="item.icon" /></el-icon>
                  <span>{{ item.title }}</span>
                </template>
                <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
                  <template #title>{{ child.title }}</template>
                </el-menu-item>
              </el-sub-menu>

              <el-menu-item v-else :index="item.path">
                <el-icon><component :is="item.icon" /></el-icon>
                <template #title>{{ item.title }}</template>
              </el-menu-item>
            </template>
          </el-menu>
        </section>
      </nav>
    </el-scrollbar>

    <div class="app-sidebar__footer">
      <button
        class="collapse-btn"
        type="button"
        :aria-label="props.collapse ? '展开侧栏' : '收起侧栏'"
        @click="appStore.toggleCollapse()"
      >
        <el-icon>
          <Expand v-if="props.collapse" />
          <Fold v-else />
        </el-icon>
        <span v-if="!props.collapse">收起</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $color-bg-surface;
  border-right: 1px solid $color-border-light;

  &__brand {
    display: flex;
    align-items: center;
    height: $header-height;
    padding: 0 14px;
    border-bottom: 1px solid $color-border-light;
  }

  &.is-collapsed &__brand {
    justify-content: center;
    padding: 0;
  }

  &__scroll {
    flex: 1;
    min-height: 0;
  }

  &__nav {
    padding: $space-3 $space-2 $space-4;
  }

  &__footer {
    padding: $space-2;
    border-top: 1px solid $color-border-light;
  }
}

.nav-group {
  & + & {
    margin-top: $space-2;
  }

  // 分节标题：11px 大写字距，弱到几乎只是「分隔」，不与菜单抢注意力
  &__title {
    padding: 0 10px;
    margin: $space-3 0 $space-1;
    font-size: 11px;
    font-weight: $font-weight-medium;
    letter-spacing: 0.06em;
    color: $color-text-placeholder;
  }

  &__rule {
    display: block;
    width: 20px;
    height: 1px;
    margin: $space-2 auto;
    background: $color-border;
  }
}

.app-sidebar__menu {
  // 菜单项外观统一在 element-override.scss 中定义，这里只处理图标尺寸与缩进
  :deep(.el-menu-item .el-icon),
  :deep(.el-sub-menu__title .el-icon) {
    width: 16px;
    margin-right: 10px;
    font-size: 16px;
    color: $color-text-placeholder;
    transition: color $duration-fast $ease-standard;
  }

  :deep(.el-menu-item:hover .el-icon),
  :deep(.el-sub-menu__title:hover .el-icon) {
    color: $color-text-regular;
  }

  :deep(.el-menu-item.is-active .el-icon) {
    color: $color-primary;
  }

  :deep(.el-sub-menu .el-menu-item) {
    padding-left: 38px !important;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  :deep(.el-sub-menu .el-menu-item.is-active) {
    color: $color-text-primary;
  }

  // 折叠态：图标居中，去掉右侧留白
  :deep(.el-menu--collapse .el-menu-item),
  :deep(.el-menu--collapse .el-sub-menu__title) {
    justify-content: center;
    padding: 0 !important;
  }

  :deep(.el-menu--collapse .el-icon) {
    margin-right: 0;
  }
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard,
    color $duration-fast $ease-standard;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-subtle;
  }

  .el-icon {
    font-size: 14px;
  }
}
</style>
