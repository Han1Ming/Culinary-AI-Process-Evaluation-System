<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * 页面标题区
 * ----------------------------------------------------------------------------
 * 所有二级页面统一使用，保证标题区高度、对齐与留白一致。
 *
 * 【文案纪律】subtitle 只写「事实」，不写「解释」：
 *   ✓ 共 386 名学生 · 今日签到 352 人
 *   ✗ 维护系统账号、角色与可用状态，数据由后端接口提供
 *   后者是把技术实现讲给用户听，是模板感的典型来源。
 */
withDefaults(
  defineProps<{
    title: string
    /** 一行事实性补充信息，可留空 */
    subtitle?: string
    /** 返回按钮跳转地址 */
    backTo?: RouteLocationRaw
  }>(),
  { subtitle: '', backTo: undefined },
)
</script>

<template>
  <header class="page-header">
    <div class="page-header__main">
      <div class="page-header__title-row">
        <router-link v-if="backTo" :to="backTo" class="page-header__back" aria-label="返回">
          <el-icon><ArrowLeft /></el-icon>
        </router-link>
        <h1 class="page-header__title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $space-3 $space-4;
  margin-bottom: $space-5;

  &__main {
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin-left: -4px;
    color: $color-text-secondary;
    border-radius: $radius-sm;
    transition: background-color $duration-fast $ease-standard,
      color $duration-fast $ease-standard;

    &:hover {
      color: $color-text-primary;
      background: $color-bg-subtle;
    }
  }

  // 20px / 600：足够立住层级，又不会像着陆页标题那样喧宾夺主
  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    letter-spacing: -0.015em;
    color: $color-text-primary;
  }

  &__subtitle {
    margin-top: 3px;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
    align-items: center;
  }
}
</style>
