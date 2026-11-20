<script setup lang="ts">
/**
 * 教师复核 · 直接扣分
 * ----------------------------------------------------------------------------
 * 有些问题 AI 判不出来（手没洗、砧板生熟混用、跳步），但教师站在操作台边一眼能看到。
 * 这个块给教师一个当场记录的口子：选违规项 → 扣分 → 写一句原因，立刻进当次成绩。
 *
 * 职责边界：它不改 AI 分数，只追加「教师裁量」记录；综合评价里两栏分开展示，
 * 这样复核时能分清哪一分是模型给的、哪一分是教师扣的。
 *
 * 「在评是谁」不再由这里选择——页面左上角的学生选择器统一管，
 * 否则同一个页面出现两个下拉，教师会以为自己选错了人。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { useReviewStore } from '@/stores/review'

const props = defineProps<{
  /** 模块标识，与路由末段一致 */
  module: string
  moduleLabel: string
  /** 该模块可扣分的违规项清单 */
  items: Array<{ label: string; points: number }>
}>()

const reviewStore = useReviewStore()

const records = computed(() =>
  reviewStore.listBy(reviewStore.activeStudentId, props.module),
)


const itemLabel = ref('')
const points = ref(5)
const reason = ref('')

const selectedItem = computed(() => props.items.find((i) => i.label === itemLabel.value))

function pickItem(label: string): void {
  itemLabel.value = label
  points.value = props.items.find((i) => i.label === label)?.points ?? 5
}

function submit(): void {
  if (!itemLabel.value) {
    ElMessage.warning('先选一个违规项')
    return
  }
  if (!reason.value.trim()) {
    ElMessage.warning('写一句原因，学生申诉时要有依据')
    return
  }
  reviewStore.add({
    studentId: reviewStore.activeStudentId,
    module: props.module,
    moduleLabel: props.moduleLabel,
    item: itemLabel.value,
    points: points.value,
    reason: reason.value.trim(),
  })
  ElMessage.success(
    `已记录：${reviewStore.activeStudent.name} · ${itemLabel.value} −${points.value} 分`,
  )
  itemLabel.value = ''
  reason.value = ''
}

function undo(id: string): void {
  reviewStore.remove(id)
  ElMessage.success('已撤销该条扣分')
}
</script>

<template>
  <section class="review app-card">
    <header class="review__head">
      <div>
        <h2 class="review__title">
          教师复核
          <span class="review__badge">人工判定</span>
        </h2>
        <p class="review__sub">不合规的操作在这里直接扣分，记录随成绩一起归档</p>
      </div>

      <div class="review__who">
        <span>在评</span>
        <strong>{{ reviewStore.activeStudent.name }}</strong>
        <span class="review__who-hint">（左上角可换人）</span>
      </div>
    </header>

    <!-- 已扣记录 -->
    <ul v-if="records.length" class="deduct-list">
      <li v-for="rec in records" :key="rec.id" class="deduct">
        <span class="deduct__points num">−{{ rec.points }}</span>
        <div class="deduct__body">
          <p class="deduct__item">{{ rec.item }}</p>
          <p class="deduct__reason">{{ rec.reason }}</p>
        </div>
        <span class="deduct__at num">{{ rec.at }}</span>
        <button type="button" class="deduct__undo" @click="undo(rec.id)">撤销</button>
      </li>
    </ul>
    <p v-else class="review__empty">本次课程还没扣分。选中违规项后点「记一次扣分」。</p>

    <!-- 扣分表单 -->
    <div class="review__form">
      <div class="review__items">
        <button
          v-for="item in items"
          :key="item.label"
          type="button"
          class="chip"
          :class="{ 'is-on': itemLabel === item.label }"
          @click="pickItem(item.label)"
        >
          {{ item.label }}
          <span class="chip__points num">−{{ item.points }}</span>
        </button>
      </div>

      <div class="review__row">
        <el-input
          v-model="reason"
          placeholder="扣分原因（写清现场情况，如「砧板生熟混用」）"
          maxlength="60"
          class="review__input"
        />
        <el-input-number v-model="points" :min="1" :max="20" size="default" controls-position="right" />
        <el-button type="primary" :disabled="!selectedItem" @click="submit">记一次扣分</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.review {
  margin-top: $space-4;

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: $space-3;
    border-bottom: 1px solid $color-border-light;
  }

  &__title {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__badge {
    padding: 1px 6px;
    font-size: 10px;
    font-weight: $font-weight-regular;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border: 1px solid $color-border-light;
    border-radius: 3px;
  }

  &__sub {
    margin: 4px 0 0;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__who {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: $font-size-xs;
    color: $color-text-secondary;

    strong {
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__who-hint {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__empty {
    padding: $space-4 0;
    margin: 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__form {
    padding-top: $space-3;
    margin-top: $space-3;
    border-top: 1px solid $color-border-light;
  }

  &__items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: $space-3;
  }

  &__row {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  &__input {
    flex: 1;
  }
}

.chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 5px 10px;
  font-family: inherit;
  font-size: $font-size-xs;
  color: $color-text-regular;
  cursor: pointer;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  transition:
    border-color $duration-fast $ease-standard,
    color $duration-fast $ease-standard;

  &__points {
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &:hover {
    border-color: $color-border-strong;
  }

  &.is-on {
    color: $color-primary;
    border-color: $color-primary;
    background: $color-primary-soft;

    .chip__points {
      color: $color-primary;
    }
  }
}

.deduct-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

.deduct {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid $color-border-light;

  &__points {
    flex: 0 0 40px;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-danger;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__item {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__reason {
    margin: 2px 0 0;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__at {
    flex-shrink: 0;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__undo {
    flex-shrink: 0;
    padding: 2px 6px;
    font-family: inherit;
    font-size: 11px;
    color: $color-text-secondary;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: $color-danger;
    }
  }
}

@media (max-width: 900px) {
  .review__row {
    flex-wrap: wrap;
  }
}
</style>
