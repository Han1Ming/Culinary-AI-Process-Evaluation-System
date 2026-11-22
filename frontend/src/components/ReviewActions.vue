<script setup lang="ts">
/**
 * 复核状态条：确认 / 驳回 / 转复核
 * ----------------------------------------------------------------------------
 * 三个动作的语义（三个模块共用同一套，不各写一遍）：
 *   confirm —— 认这个结果，可以进入归档；
 *   reject  —— 结果不成立，退回重做（必须写原因，提交方要看得到）；
 *   hold    —— 当场判不了，挂起给课后或教研组（必须写原因）。
 *
 * 为什么做成组件而不是每页写一份：
 * 综合评价是「一个学生的总成绩」，成品分析是「一次 AI 分析结果」，
 * 但教师做的判断动作完全一样。分散实现迟早出现「这里驳回要写原因、
 * 那里不用」的不一致，学生会发现自己被两套规则对待。
 *
 * 已归档（disabled）时只显示状态，不给按钮：归档后分数冻结是硬约束。
 */
import { REVIEW_STATE_LABEL } from '@/types/summary'
import type { ReviewState } from '@/types/summary'

const props = withDefaults(
  defineProps<{
    state?: ReviewState
    reviewedBy?: string
    reviewedAt?: string
    /** 最近一次复核说明（驳回 / 转复核的原因） */
    note?: string
    /** 已归档：只读 */
    disabled?: boolean
    /** 当前账号有没有复核权限 */
    canReview?: boolean
    loading?: boolean
  }>(),
  {
    state: 'pending',
    reviewedBy: '',
    reviewedAt: '',
    note: '',
    disabled: false,
    canReview: false,
    loading: false,
  },
)

const emit = defineEmits<{
  confirm: []
  reject: []
  hold: []
}>()

const TONE: Record<ReviewState, string> = {
  pending: 'is-pending',
  confirmed: 'is-ok',
  rejected: 'is-bad',
  reviewing: 'is-warn',
}
</script>

<template>
  <div class="review-bar" :class="TONE[props.state]">
    <div class="review-bar__state">
      <span class="review-bar__label">复核状态</span>
      <strong>{{ REVIEW_STATE_LABEL[props.state] }}</strong>
      <span v-if="props.reviewedAt" class="review-bar__meta num">
        {{ props.reviewedBy }} · {{ props.reviewedAt }}
      </span>
    </div>
    <div v-if="props.canReview && !props.disabled" class="review-bar__actions">
      <el-button size="small" type="primary" plain :loading="props.loading" @click="emit('confirm')">
        确认
      </el-button>
      <el-button size="small" plain :loading="props.loading" @click="emit('reject')">驳回</el-button>
      <el-button size="small" text :loading="props.loading" @click="emit('hold')">转复核</el-button>
    </div>
    <span v-else-if="props.disabled" class="review-bar__meta">已归档，不可变更</span>
  </div>
  <p v-if="props.note" class="review-bar__note">{{ props.note }}</p>
</template>

<style scoped lang="scss">
.review-bar {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  margin-bottom: $space-3;
  background: $color-bg-subtle;
  border-radius: $radius-sm;

  &__state {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: $font-size-xs;
    color: $color-text-secondary;

    strong {
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
    }
  }

  &__label {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__meta {
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__actions {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  // 状态色只落在这个小条里，不扩散到整张卡片
  &.is-ok strong {
    color: $color-success;
  }

  &.is-bad strong {
    color: $color-danger;
  }

  &.is-warn strong {
    color: $color-warning;
  }

  &.is-pending strong {
    color: $color-text-secondary;
  }

  &__note {
    margin: -4px 0 $space-3;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-secondary;
  }
}
</style>
