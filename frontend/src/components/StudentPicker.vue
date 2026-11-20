<script setup lang="ts">
/**
 * 在评学生选择器
 * ----------------------------------------------------------------------------
 * 教师的真实动作是「走到某个工位 → 看这个人的录像 → 当场判断」。
 * 所以模块页的第一控件不是摄像头开关，而是**这是谁**：
 *   左上角选学生 → 下方画面与判定结果整块跟着换人。
 *
 * 只对教师与管理员渲染（config/permissions.ts 的 module.review）。
 * 学生进来看到的是自己的画面，没有「选别人」这回事，位置留给操作按钮。
 *
 * 选中的人是全模块共享的（stores/review.ts），
 * 着装页选完切到切配页还是同一个人——一节课跟着人走，不跟着页面走。
 */
import { computed } from 'vue'

import { reviewStudents, useReviewStore } from '@/stores/review'

const reviewStore = useReviewStore()

const active = computed(() => reviewStore.activeStudent)
const checkedInCount = computed(() => reviewStudents.filter((s) => s.checkedIn).length)
</script>

<template>
  <div class="picker">
    <div class="picker__field">
      <label id="eval-target-label" class="picker__label">在评学生</label>

      <el-select
        v-model="reviewStore.activeStudentId"
        class="picker__select"
        filterable
        aria-labelledby="eval-target-label"
        placement="bottom-start"
      >
        <el-option
          v-for="stu in reviewStudents"
          :key="stu.id"
          :value="stu.id"
          :label="`${stu.name} ${stu.studentNo}`"
        >
          <div class="opt">
            <img v-if="stu.facePhoto" class="opt__face" :src="stu.facePhoto" alt="" />
            <span v-else class="opt__face opt__face--text">{{ stu.name.slice(0, 1) }}</span>
            <span class="opt__name">{{ stu.name }}</span>
            <span class="opt__no num">{{ stu.studentNo }}</span>
            <span v-if="!stu.checkedIn" class="opt__flag">未签到</span>
          </div>
        </el-option>
      </el-select>

      <!-- 上一位 / 下一位：按工位顺序走，比反复拉下拉快 -->
      <div class="picker__step">
        <button type="button" aria-label="上一位学生" @click="reviewStore.step(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button type="button" aria-label="下一位学生" @click="reviewStore.step(1)">
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
    </div>

    <div class="picker__meta">
      <span class="picker__seat">
        {{ active.className }} · 工位 {{ active.seat }}
      </span>
      <span class="picker__div" aria-hidden="true" />
      <span class="picker__count num">已签到 {{ checkedInCount }} / {{ reviewStudents.length }}</span>
    </div>

    <p class="picker__hint">切人后，画面与判定结果一起切换</p>
  </div>
</template>

<style scoped lang="scss">
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2 $space-4;
  align-items: center;
  padding: 10px $space-4;
  margin-bottom: $space-4;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  &__field {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  &__label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
    white-space: nowrap;
  }

  &__select {
    width: 216px;
  }

  &__step {
    display: flex;
    gap: 2px;

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: $color-text-secondary;
      cursor: pointer;
      background: transparent;
      border: 1px solid $color-border-light;
      border-radius: $radius-sm;
      transition:
        color $duration-fast $ease-standard,
        border-color $duration-fast $ease-standard;

      &:hover {
        color: $color-text-primary;
        border-color: $color-border-strong;
      }
    }
  }

  &__meta {
    display: flex;
    gap: $space-2;
    align-items: center;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__div {
    width: 1px;
    height: 10px;
    background: $color-border;
  }

  // 提示靠右：它是解释，不是控件
  &__hint {
    margin: 0 0 0 auto;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.opt {
  display: flex;
  gap: $space-2;
  align-items: center;
  height: 100%;

  &__face {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    object-fit: cover;
    border-radius: 3px;

    &--text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: $color-text-secondary;
      background: $color-bg-subtle;
    }
  }

  &__name {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__no {
    margin-left: auto;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__flag {
    padding: 0 5px;
    font-size: 10px;
    color: $color-danger;
    background: $color-danger-soft;
    border-radius: 3px;
  }
}

@media (max-width: 1280px) {
  .picker__hint {
    display: none;
  }
}

@media (max-width: $breakpoint-md) {
  .picker {
    gap: $space-2;
  }

  .picker__select {
    width: 168px;
  }

  .picker__meta {
    width: 100%;
  }
}
</style>
