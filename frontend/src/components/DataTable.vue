<script setup lang="ts" generic="T">
import { computed } from 'vue'
import AppSkeleton from './AppSkeleton.vue'
import type { DataTableColumn } from '@/types'

/**
 * 通用数据表格：统一表头、行高、空状态与分页
 * ----------------------------------------------------------------------------
 * 加载策略（决定「不闪」的关键）：
 *  · 首屏无数据 → 渲染与真实行高等高的骨架，数据到达时零位移
 *  · 已有数据再刷新 → 用轻遮罩，避免表格结构消失造成视野跳变
 *
 * 列内容可通过具名插槽自定义：<template #status="{ row }">…</template>
 */
const props = withDefaults(
  defineProps<{
    data: T[]
    columns: DataTableColumn<T>[]
    loading?: boolean
    total?: number
    page?: number
    pageSize?: number
    rowKey?: string
    selectable?: boolean
    pageSizes?: number[]
    emptyText?: string
  }>(),
  {
    loading: false,
    page: 1,
    pageSize: 10,
    rowKey: 'id',
    selectable: false,
    pageSizes: () => [10, 20, 50],
    emptyText: '没有符合条件的数据',
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'selection-change': [rows: T[]]
}>()

/** 首次加载且无任何行时走骨架，其余情况走遮罩 */
const showSkeleton = computed(() => props.loading && props.data.length === 0)
const showOverlay = computed(() => props.loading && props.data.length > 0)

function cellValue(row: T, prop: string): unknown {
  return (row as Record<string, unknown>)[prop]
}

function formatCell(column: DataTableColumn<T>, row: T): string {
  const value = cellValue(row, column.prop)
  if (column.formatter) return column.formatter(row, value)
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}
</script>

<template>
  <div class="data-table">
    <AppSkeleton
      v-if="showSkeleton"
      variant="table"
      :rows="pageSize"
      :columns="Math.min(columns.length, 6)"
    />

    <el-table
      v-else
      v-loading="showOverlay"
      :data="data"
      :row-key="rowKey"
      @selection-change="(rows: T[]) => emit('selection-change', rows)"
    >
      <el-table-column v-if="selectable" type="selection" width="44" align="center" />
      <el-table-column
        v-for="column in columns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth"
        :align="column.align ?? 'left'"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <slot :name="column.prop" :row="row" :value="cellValue(row, column.prop)">
            {{ formatCell(column, row) }}
          </slot>
        </template>
      </el-table-column>

      <!-- 空状态：不用 el-empty 的插画，保持与产品一致的克制表达 -->
      <template #empty>
        <div class="data-table__empty">
          <svg class="data-table__empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M3.5 10h17M9 5v14" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <p class="data-table__empty-text">{{ emptyText }}</p>
        </div>
      </template>
    </el-table>

    <div v-if="total !== undefined" class="data-table__footer">
      <span class="data-table__summary">共 <span class="num">{{ total }}</span> 条</span>
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        layout="sizes, prev, pager, next, jumper"
        @update:current-page="(value: number) => emit('update:page', value)"
        @update:page-size="(value: number) => emit('update:pageSize', value)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.data-table {
  &__footer {
    display: flex;
    gap: $space-4;
    align-items: center;
    justify-content: space-between;
    padding-top: $space-4;
    margin-top: $space-1;
    border-top: 1px solid $color-border-light;
  }

  &__summary {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    align-items: center;
    padding: $space-8 0;
  }

  &__empty-icon {
    width: 34px;
    height: 34px;
    color: $color-border-strong;
  }

  &__empty-text {
    font-size: $font-size-sm;
    color: $color-text-placeholder;
  }

  :deep(.el-pagination) {
    padding-top: 0;
  }

  :deep(.el-table__body-wrapper) {
    // 滚动时表格底部不被分页压住
    padding-bottom: 2px;
  }
}
</style>
