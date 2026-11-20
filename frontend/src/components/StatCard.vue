<script setup lang="ts">
import { computed } from 'vue'
import { useCountUp } from '@/composables/useCountUp'
import type { StatCardData } from '@/types'

/**
 * 统计卡片
 * ----------------------------------------------------------------------------
 * 视觉决策（对照「AI 模板感」的反面）：
 *  · 不做顶部彩条、不做彩色图标底板 —— 颜色留给数据本身，不给装饰
 *  · 图标退为右上角 14px 中性灰线性图标，只起「这是哪一类指标」的提示作用
 *  · 数值是本卡唯一的主角：26px / 600 / 等宽数字，进入时从 0 滚到位
 *  · 环比只用深灰文字 + 一个 5px 的三角，语义色仅在此处出现
 */
const props = defineProps<{ data: StatCardData; index?: number }>()

const value = computed(() => props.data.value)
const { display } = useCountUp(value, { duration: 820, delay: 120 + (props.index ?? 0) * 40 })

const trend = computed(() => {
  const delta = props.data.delta
  if (delta === undefined || delta === 0) {
    return { className: 'is-flat', text: '持平', icon: null as null | string }
  }
  return {
    className: delta > 0 ? 'is-up' : 'is-down',
    text: `${Math.abs(delta).toFixed(1)}%`,
    icon: delta > 0 ? 'CaretTop' : 'CaretBottom',
  }
})
</script>

<template>
  <article class="stat">
    <header class="stat__head">
      <span class="stat__label">{{ data.label }}</span>
      <el-icon class="stat__icon"><component :is="data.icon" /></el-icon>
    </header>

    <p class="stat__value">
      <span class="num">{{ display }}</span>
      <small v-if="data.unit">{{ data.unit }}</small>
    </p>

    <footer class="stat__foot">
      <span class="stat__trend" :class="trend.className">
        <el-icon v-if="trend.icon" class="stat__caret"><component :is="trend.icon" /></el-icon>
        <span class="num">{{ trend.text }}</span>
      </span>
      <span class="stat__hint">较上周</span>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: $card-padding;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  transition: border-color $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard, transform $duration-fast $ease-standard;

  // 悬浮只做「轻微离地」：1px 位移 + 一档阴影，不做放大或发光
  &:hover {
    border-color: $color-border;
    box-shadow: $shadow-raised;
    transform: translateY(-1px);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__icon {
    font-size: 14px;
    color: $color-text-placeholder;
    transition: color $duration-fast $ease-standard;
  }

  &:hover &__icon {
    color: $color-text-secondary;
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 10px;

    span {
      font-size: $font-size-xl;
      font-weight: $font-weight-semibold;
      line-height: 1.15;
      color: $color-text-primary;
    }

    small {
      font-size: $font-size-sm;
      font-weight: $font-weight-regular;
      color: $color-text-placeholder;
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  &__trend {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.is-up {
      color: $color-success;
    }

    &.is-down {
      color: $color-danger;
    }

    &.is-flat {
      color: $color-text-placeholder;
    }
  }

  &__caret {
    font-size: 11px;
  }

  &__hint {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}
</style>
