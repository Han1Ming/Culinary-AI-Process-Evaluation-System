<script setup lang="ts">
/**
 * 评价模块页面外壳
 * ----------------------------------------------------------------------------
 * 七个模块页面共用同一骨架：左侧是操作区，右侧是后端接入面板。
 * 统一骨架的好处是——把「业务长什么样」和「接口怎么对」分开，
 * 后端同学看右边，教师看左边，两边都不被打断。
 *
 * 教师与管理员在页头下方多一条「在评学生」栏：教师看的不是自己电脑的
 * 摄像头，而是某个工位上那个人的录像与判定结果，所以「这是谁」要排在
 * 所有控件前面。学生没有这一栏，位置直接留给操作按钮。
 * 综合评价页自己有一整张班级名单，传 :reviewable="false" 关掉它。
 */
import ApiPanel from '@/components/ApiPanel.vue'
import type { EndpointSpec } from '@/components/ApiPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import StudentPicker from '@/components/StudentPicker.vue'
import { useRole } from '@/composables/useRole'

const { can } = useRole()

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    endpoints: EndpointSpec[]
    ready?: boolean
    /** 页头状态文字，如「待对接」「已上线」 */
    stateText?: string
    /** 是否显示在评学生选择器（教师 / 管理员才有意义） */
    reviewable?: boolean
  }>(),
  { subtitle: '', ready: false, stateText: '', reviewable: true },
)
</script>

<template>
  <div class="module-page">
    <PageHeader :title="title" :subtitle="subtitle">
      <template v-if="stateText" #badge>
        <span class="state" :class="ready ? 'is-ready' : 'is-pending'">
          <i aria-hidden="true" />
          {{ stateText }}
        </span>
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <StudentPicker v-if="reviewable && can('module.review')" />

    <div class="module-grid">
      <div class="module-main">
        <slot />
      </div>

      <ApiPanel class="module-aside" :endpoints="endpoints" :ready="ready" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.module-page {
  display: flex;
  flex-direction: column;
}

.module-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: $space-4;
  align-items: start;
}

.module-main {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  min-width: 0;
}

.module-aside {
  position: sticky;
  top: $space-4;
  // 减去 96px 是给右下角浮空助手留的位置：面板底部原本正好被那颗球压住
  max-height: calc(100vh - #{$header-height} - 96px);
}

.state {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-pill;

  i {
    display: block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  &.is-ready i {
    background: $color-success-dot;
  }

  &.is-pending i {
    background: $color-border-strong;
  }
}

@media (max-width: 1280px) {
  .module-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .module-aside {
    position: static;
    max-height: none;
  }
}
</style>
