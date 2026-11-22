<script setup lang="ts">
/**
 * 签到记录详情
 * ----------------------------------------------------------------------------
 * 甲方要求「支持查看签到记录详情和识别截图」。截图是这条记录的唯一证据，
 * 所以放大查看放在第一位；失败记录同样有图，教师才能判断是逆光还是代签。
 */
import { computed, ref, watch } from 'vue'

import { fetchFaceRecordDetail } from '@/api/face'
import { CHECKIN_STATUS_META } from '@/types'
import { formatDateTime, formatSimilarity } from '@/utils/format'
import type { FaceRecord } from '@/types'

const props = defineProps<{ modelValue: boolean; recordId: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'filter-student': [name: string]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const error = ref('')
const record = ref<FaceRecord | null>(null)

watch(
  () => [props.modelValue, props.recordId] as const,
  async ([open, id]) => {
    if (!open || !id) return
    loading.value = true
    error.value = ''
    record.value = null
    try {
      record.value = await fetchFaceRecordDetail(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '详情加载失败'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const meta = computed(() => {
  const item = record.value
  if (!item) return []
  return [
    { label: '学号', value: item.studentNo },
    { label: '班级', value: item.className },
    { label: '工位', value: item.seat ?? '—' },
    { label: '课程 / 任务', value: item.courseTitle ?? '—' },
    { label: '识别时间', value: formatDateTime(item.timestamp, 'YYYY-MM-DD HH:mm:ss') },
    { label: '相似度', value: item.source === 'manual' ? '人工核验' : formatSimilarity(item.similarity) },
    { label: '采集设备', value: item.deviceName ?? '—' },
    { label: '记录来源', value: item.source === 'manual' ? '教师补签' : 'AI 识别' },
  ]
})
</script>

<template>
  <el-drawer v-model="visible" title="签到记录详情" size="440px">
    <div v-loading="loading" class="detail">
      <p v-if="error" class="detail__error">{{ error }}</p>

      <template v-if="record">
        <header class="detail__head">
          <div>
            <h3>{{ record.name }}</h3>
            <p class="num">{{ record.studentNo }}</p>
          </div>
          <span class="tag" :class="`is-${CHECKIN_STATUS_META[record.status].tone}`">
            {{ CHECKIN_STATUS_META[record.status].label }}
          </span>
        </header>

        <figure v-if="record.snapshot" class="shot">
          <el-image
            :src="record.snapshot"
            :preview-src-list="[record.snapshot]"
            fit="cover"
            preview-teleported
            class="shot__img"
          />
          <figcaption>识别截图 · 点击可放大</figcaption>
        </figure>
        <p v-else class="shot shot--none">这条记录没有留存截图（补签记录不产生画面）</p>

        <dl class="meta">
          <div v-for="item in meta" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>

        <section v-if="record.reason" class="reason">
          <h4>{{ record.source === 'manual' ? '补签原因' : '说明' }}</h4>
          <p>{{ record.reason }}</p>
          <footer v-if="record.operator" class="reason__by">
            操作人 {{ record.operator }} · {{ formatDateTime(record.timestamp, 'MM-DD HH:mm') }}
          </footer>
        </section>

        <el-button class="detail__filter" @click="emit('filter-student', record.name)">
          只看该学生的记录
        </el-button>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.detail {
  min-height: 200px;

  &__error {
    padding: $space-4;
    font-size: $font-size-sm;
    color: $color-danger;
    background: $color-danger-soft;
    border-radius: $radius-md;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: $space-4;
    border-bottom: 1px solid $color-border-light;

    h3 {
      margin: 0;
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }

  &__filter {
    width: 100%;
    margin-top: $space-5;
  }
}

.tag {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: $radius-pill;

  &.is-success {
    color: $color-success;
    background: $color-success-soft;
  }

  &.is-danger {
    color: $color-danger;
    background: $color-danger-soft;
  }

  &.is-warning {
    color: $color-warning;
    background: $color-warning-soft;
  }

  &.is-primary {
    color: $color-primary;
    background: $color-primary-soft;
  }
}

.shot {
  margin: $space-4 0 0;

  &__img {
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-md;
  }

  figcaption {
    margin-top: 6px;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &--none {
    padding: $space-6 $space-4;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-align: center;
    background: $color-bg-subtle;
    border-radius: $radius-md;
  }
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3 $space-4;
  padding: $space-4 0;
  margin: 0;
  border-bottom: 1px solid $color-border-light;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 3px 0 0;
    font-size: $font-size-sm;
    color: $color-text-regular;
    word-break: break-all;
  }
}

.reason {
  padding-top: $space-4;

  h4 {
    margin: 0 0 6px;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  p {
    margin: 0;
    font-size: $font-size-sm;
    line-height: 1.7;
    color: $color-text-regular;
  }

  &__by {
    margin-top: 6px;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}
</style>
