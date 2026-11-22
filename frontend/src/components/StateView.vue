<script setup lang="ts">
/**
 * StateView —— 页面级四态（加载中 / 空数据 / 请求失败 / 无权限）
 * ----------------------------------------------------------------------------
 * 甲方要求「所有业务页面支持加载中、空数据、请求失败和无权限状态」。
 * 四个状态分开写会出现四种语气、四种留白；这里统一成一种：
 *   一行图标 + 一句事实 + 一句可操作的话 + 一个按钮，不使用插画。
 *
 * 用法：
 *   <StateView v-if="state !== 'ready'" :state="state" @retry="load" />
 *   <StateView v-else>...真实内容...</StateView>
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    state: 'loading' | 'empty' | 'error' | 'forbidden'
    /** 覆盖默认标题；默认按 state 取 */
    title?: string
    /** 覆盖默认说明 */
    description?: string
    /** 紧凑模式：放在卡片内部时用，减少上下留白 */
    compact?: boolean
    /** 是否显示重试按钮，默认 loading / forbidden 不显示 */
    retryable?: boolean
  }>(),
  { title: '', description: '', compact: false, retryable: undefined },
)

const emit = defineEmits<{ retry: [] }>()

const DEFAULTS = {
  loading: { icon: 'Loading', title: '正在加载', description: '数据马上就好' },
  empty: { icon: 'Files', title: '暂无数据', description: '当前筛选条件下没有记录' },
  error: { icon: 'WarningFilled', title: '加载失败', description: '请检查网络或稍后重试' },
  forbidden: { icon: 'Lock', title: '无访问权限', description: '当前账号无权查看这部分内容' },
} as const

const view = computed(() => DEFAULTS[props.state])
const canRetry = computed(() => props.retryable ?? (props.state === 'error' || props.state === 'empty'))
</script>

<template>
  <div class="state-view" :class="{ 'is-compact': compact }" :data-state="state" role="status">
    <span class="state-view__icon" aria-hidden="true">
      <el-icon :class="{ 'is-spin': state === 'loading' }">
        <component :is="view.icon" />
      </el-icon>
    </span>

    <p class="state-view__title">{{ title || view.title }}</p>
    <p class="state-view__desc">{{ description || view.description }}</p>

    <slot />

    <el-button v-if="canRetry" size="small" :loading="state === 'loading'" @click="emit('retry')">
      {{ state === 'empty' ? '刷新' : '重新加载' }}
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $space-9 $space-6;
  text-align: center;

  &.is-compact {
    padding: $space-6 $space-4;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-bottom: $space-3;
    font-size: 16px;
    color: $color-text-placeholder;
    background: $color-bg-subtle;
    border-radius: $radius-lg;

    [data-state='error'] & {
      color: $color-danger;
      background: $color-danger-soft;
    }

    [data-state='forbidden'] & {
      color: $color-warning;
      background: $color-warning-soft;
    }
  }

  .is-spin {
    animation: state-spin 900ms linear infinite;
  }

  &__title {
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__desc {
    max-width: 44ch;
    margin: 4px 0 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-placeholder;
  }

  .el-button {
    margin-top: $space-4;
  }
}

@keyframes state-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
