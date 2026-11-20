<script setup lang="ts">
/**
 * AppSkeleton —— 内容占位骨架
 * ----------------------------------------------------------------------------
 * 为什么必须有它：真实请求有 200–800ms 的等待，如果这段时间显示空白或居中转圈，
 * 数据到达瞬间的布局跳变会让页面「塌一下」，这是最容易被感知的不流畅来源。
 * 骨架屏保持与真实内容一致的尺寸和结构，数据替换时零跳动。
 *
 * @example
 * <AppSkeleton v-if="loading" variant="stats" :count="4" />
 * <AppSkeleton v-else variant="table" :rows="pageSize" />
 */
withDefaults(
  defineProps<{
    /** 骨架形态：统计卡 / 表格 / 图文列表 */
    variant?: 'stats' | 'table' | 'list'
    /** 条目数量（stats 为卡片数，其余为行数） */
    count?: number
    /** 仅 table 生效：列数 */
    columns?: number
  }>(),
  {
    variant: 'list',
    count: 4,
    columns: 5,
  },
)
</script>

<template>
  <!-- 统计卡骨架：结构与 StatCard 一致（标签行 / 数值行 / 环比行） -->
  <div v-if="variant === 'stats'" class="sk-stats">
    <div v-for="i in count" :key="i" class="sk-stat">
      <span class="sk" style="width: 64px; height: 12px" />
      <span class="sk" style="width: 96px; height: 26px; margin-top: 14px" />
      <span class="sk" style="width: 118px; height: 11px; margin-top: 12px" />
    </div>
  </div>

  <!-- 表格骨架：表头 + N 行 N 列 -->
  <div v-else-if="variant === 'table'" class="sk-table">
    <div class="sk-table__head">
      <span v-for="c in columns" :key="c" class="sk" style="height: 10px" />
    </div>
    <div v-for="r in count" :key="r" class="sk-table__row">
      <span
        v-for="c in columns"
        :key="c"
        class="sk"
        :style="{ height: '11px', width: c === 1 ? '100%' : `${58 + ((c * 13) % 30)}%` }"
      />
    </div>
  </div>

  <!-- 图文列表骨架 -->
  <div v-else class="sk-list">
    <div v-for="i in count" :key="i" class="sk-list__row">
      <span class="sk sk--circle" style="width: 30px; height: 30px; flex: 0 0 30px" />
      <div class="sk-list__body">
        <span class="sk" style="width: 42%; height: 12px" />
        <span class="sk" style="width: 68%; height: 10px; margin-top: 8px" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sk-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $space-4;
}

.sk-stat {
  display: flex;
  flex-direction: column;
  // 与 StatCard 实际渲染高度对齐（130px），数据到达时不产生纵向位移
  height: 130px;
  padding: $card-padding;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

.sk-table {
  &__head {
    display: grid;
    grid-template-columns: 1.6fr repeat(4, 1fr);
    gap: $space-6;
    align-items: center;
    height: $table-head-height;
    border-bottom: 1px solid $color-border;
  }

  &__row {
    display: grid;
    grid-template-columns: 1.6fr repeat(4, 1fr);
    gap: $space-6;
    align-items: center;
    height: $table-row-height;
    border-bottom: 1px solid $color-border-light;
  }
}

.sk-list {
  &__row {
    display: flex;
    gap: $space-3;
    align-items: center;
    padding: $space-3 0;

    & + & {
      border-top: 1px solid $color-border-light;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }
}
</style>
