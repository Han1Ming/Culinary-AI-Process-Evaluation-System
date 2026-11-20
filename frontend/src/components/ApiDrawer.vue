<script setup lang="ts">
/**
 * 接口抽屉
 * ----------------------------------------------------------------------------
 * 页面本身布局已经排满（人脸签到、智能 AI 老师），再塞一列 340px 会挤坏主区。
 * 所以这两个模块把 ApiPanel 收进抽屉，从页面右上角「接口」按钮打开。
 * 内容与模块页右侧面板完全一致，后端同学在任意模块都能就近查契约。
 */
import { computed } from 'vue'

import ApiPanel from '@/components/ApiPanel.vue'
import type { EndpointSpec } from '@/components/ApiPanel.vue'
import { USE_MOCK } from '@/utils/env'

const props = defineProps<{
  endpoints: EndpointSpec[]
  ready?: boolean
  /** 抽屉标题，默认「后端接入」 */
  title?: string
}>()

const visible = defineModel<boolean>({ default: false })

const ready = computed(() => props.ready ?? false)
</script>

<template>
  <el-drawer v-model="visible" size="452px" class="api-drawer" append-to-body>
    <template #header>
      <div class="api-drawer__head">
        <span class="api-drawer__title">{{ title ?? '后端接入' }}</span>
        <span class="api-drawer__meta">
          {{ endpoints.length }} 个接口 · {{ ready ? '已连通' : '待实现' }}
        </span>
        <span class="api-drawer__badge" :class="USE_MOCK ? 'is-mock' : 'is-live'">
          {{ USE_MOCK ? 'Mock' : 'Live' }}
        </span>
      </div>
    </template>

    <ApiPanel :endpoints="endpoints" :ready="ready" class="api-drawer__panel" />
  </el-drawer>
</template>

<style scoped lang="scss">
.api-drawer {
  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: baseline;
    padding-right: 12px;
  }

  &__title {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__badge {
    padding: 1px 7px;
    font-family: $font-family-mono;
    font-size: 11px;
    border: 1px solid $color-border;
    border-radius: $radius-pill;

    &.is-mock {
      color: $color-warning;
      background: $color-warning-soft;
      border-color: rgba(180, 83, 9, 0.16);
    }

    &.is-live {
      color: $color-success;
      background: $color-success-soft;
      border-color: rgba(21, 128, 61, 0.16);
    }
  }

  &__panel {
    height: 100%;
    border: none;
    border-radius: 0;

    // 标题、接口数、Mock 徽标已上移到抽屉头部，面板内不再重复一遍
    :deep(.api-panel__head) {
      display: none;
    }

    :deep(.api-panel__tabs) {
      padding-top: 14px;
    }

    :deep(.api-panel__body) {
      flex: 1;
    }
  }
}

:deep(.el-drawer__body) {
  padding: 0;
  overflow: hidden;
}
</style>
