<script setup lang="ts">
/**
 * 事件详情
 * ----------------------------------------------------------------------------
 * 一条事件要回答四个问题：什么时候、哪个机位、凭什么这么判、谁来处理。
 * 截图放在最上面，因为教师复核时第一眼要看的是画面，不是文字。
 */
import { computed, ref, watch } from 'vue'

import { EVENT_TYPE_LABEL, SEVERITY_META } from '@/types/cooking'
import { formatDateTime } from '@/utils/format'
import type { CookingEvent, StepStatus } from '@/types/cooking'

const props = defineProps<{
  modelValue: boolean
  event: CookingEvent | null
  canReview: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  ack: [note: string]
  review: [payload: { status: StepStatus; note: string }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const note = ref('')
const reviewNote = ref('')
const submitting = ref(false)

watch(visible, (open) => {
  if (!open) return
  note.value = ''
  reviewNote.value = ''
})

function submitAck(): void {
  emit('ack', note.value.trim())
}

function submitReview(status: StepStatus): void {
  if (reviewNote.value.trim().length < 4) {
    reviewNote.value = ''
    return
  }
  emit('review', { status, note: reviewNote.value.trim() })
}
</script>

<template>
  <el-drawer v-model="visible" title="事件详情" size="460px">
    <div v-if="event" class="ev">
      <figure v-if="event.snapshot" class="ev__shot">
        <el-image
          :src="event.snapshot"
          :preview-src-list="[event.snapshot]"
          fit="cover"
          preview-teleported
          class="ev__img"
        />
        <figcaption>关键截图 · 点击放大</figcaption>
      </figure>

      <header class="ev__head">
        <div>
          <p class="ev__step">{{ event.stepName }} · {{ EVENT_TYPE_LABEL[event.type] }}</p>
          <h3>{{ event.title }}</h3>
        </div>
        <span class="ev__sev" :class="`is-${SEVERITY_META[event.severity].tone}`">
          {{ SEVERITY_META[event.severity].label }}
        </span>
      </header>

      <p class="ev__desc">{{ event.description }}</p>

      <dl class="ev__meta">
        <div>
          <dt>发生时间</dt>
          <dd class="num">{{ formatDateTime(event.at, 'YYYY-MM-DD HH:mm:ss') }}</dd>
        </div>
        <div>
          <dt>机位</dt>
          <dd class="num">{{ event.camera }}</dd>
        </div>
        <div>
          <dt>置信度</dt>
          <dd class="num">{{ event.confidence ? `${(event.confidence * 100).toFixed(0)}%` : '—' }}</dd>
        </div>
        <div>
          <dt>处理状态</dt>
          <dd>{{ event.acknowledged ? '已确认' : '待处理' }}</dd>
        </div>
      </dl>

      <section v-if="event.acknowledged" class="ev__handled">
        <h4>处理记录</h4>
        <p>{{ event.handleNote || '已确认' }}</p>
        <footer>{{ event.handledBy }} · {{ formatDateTime(event.handledAt, 'MM-DD HH:mm') }}</footer>
      </section>

      <template v-else-if="canReview">
        <section class="ev__block">
          <h4>确认处理</h4>
          <el-input
            v-model="note"
            type="textarea"
            :rows="2"
            maxlength="120"
            placeholder="说明处理结果，例如：已提醒学生回岗并调小火"
          />
          <el-button type="primary" size="small" class="ev__btn" @click="submitAck">
            确认该事件已处理
          </el-button>
        </section>

        <section class="ev__block">
          <h4>修正步骤结果</h4>
          <p class="ev__hint">
            修正会写入「人员 / 时间 / 原结果 / 新结果 / 原因」，同时保留 AI 原始判定。
          </p>
          <el-input
            v-model="reviewNote"
            type="textarea"
            :rows="2"
            maxlength="200"
            placeholder="填写修正原因（至少 4 个字）"
          />
          <div class="ev__actions">
            <el-button size="small" :disabled="reviewNote.trim().length < 4" @click="submitReview('done')">
              判定为已完成
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :disabled="reviewNote.trim().length < 4"
              @click="submitReview('abnormal')"
            >
              判定为异常
            </el-button>
          </div>
        </section>
      </template>

      <p v-else class="ev__hint">仅教师可确认或修正该事件。</p>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.ev {
  &__shot {
    margin: 0 0 $space-4;

    figcaption {
      margin-top: 6px;
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__img {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-md;
  }

  &__head {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    justify-content: space-between;

    h3 {
      margin: 2px 0 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      line-height: 1.5;
      color: $color-text-primary;
    }
  }

  &__step {
    margin: 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__sev {
    flex-shrink: 0;
    font-size: 11px;

    &.is-idle {
      color: $color-text-secondary;
    }

    &.is-warning {
      color: $color-warning;
    }

    &.is-danger {
      color: $color-danger;
    }
  }

  &__desc {
    margin: $space-3 0 0;
    font-size: $font-size-sm;
    line-height: 1.8;
    color: $color-text-regular;
  }

  &__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
    padding: $space-4 0;
    margin: $space-4 0 0;
    border-top: 1px solid $color-border-light;
    border-bottom: 1px solid $color-border-light;

    dt {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    dd {
      margin: 3px 0 0;
      font-size: $font-size-sm;
      color: $color-text-regular;
    }
  }

  &__block {
    padding-top: $space-4;

    h4 {
      margin: 0 0 6px;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  &__hint {
    margin: 0 0 8px;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-placeholder;
  }

  &__btn {
    width: 100%;
    margin-top: $space-2;
  }

  &__actions {
    display: flex;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__handled {
    padding-top: $space-4;

    h4 {
      margin: 0 0 4px;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }

    p {
      margin: 0;
      font-size: $font-size-sm;
      color: $color-text-regular;
    }

    footer {
      margin-top: 4px;
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }
}
</style>
