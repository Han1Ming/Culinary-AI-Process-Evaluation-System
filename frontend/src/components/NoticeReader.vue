<script setup lang="ts">
/**
 * 公告阅读器
 * ----------------------------------------------------------------------------
 * 全局只挂一份（在 DefaultLayout 里），由 `noticeStore.open(id)` 驱动。
 * 顶栏铃铛、工作台公告卡、公告中心页都只调 store，不各自维护一个弹窗——
 * 三处各写一个弹窗，读到的正文迟早不一致。
 */
import { computed } from 'vue'

import { useNoticeStore } from '@/stores/notice'
import { formatDateTime } from '@/utils/format'
import { NOTICE_TYPE_LABELS } from '@/types'

const notice = useNoticeStore()

const visible = computed({
  get: () => Boolean(notice.active),
  set: (value: boolean) => {
    if (!value) notice.close()
  },
})

const paragraphs = computed(() =>
  (notice.active?.body ?? '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean),
)
</script>

<template>
  <el-dialog
    v-model="visible"
    width="640px"
    append-to-body
    class="notice-reader"
    :show-close="true"
  >
    <template #header>
      <div class="reader__head">
        <div class="reader__meta">
          <span class="reader__type">{{ notice.active ? NOTICE_TYPE_LABELS[notice.active.type] : '' }}</span>
          <span v-if="notice.active?.pinned" class="reader__pin">置顶</span>
        </div>
        <h2 class="reader__title">{{ notice.active?.title }}</h2>
        <p class="reader__sub num">
          {{ notice.active?.publisher }}
          <span class="reader__sep">·</span>
          {{ formatDateTime(notice.active?.publishedAt ?? notice.active?.createdAt, 'YYYY-MM-DD HH:mm') }}
        </p>
      </div>
    </template>

    <div class="reader__body">
      <p v-for="(block, index) in paragraphs" :key="index">{{ block }}</p>
    </div>

    <template #footer>
      <span class="reader__foot">发布后立即生效，撤回后此处不再显示</span>
      <el-button type="primary" @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.reader {
  &__head {
    padding-right: $space-6;
  }

  &__meta {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  &__type {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__pin {
    padding: 1px 6px;
    font-size: 10px;
    color: $color-primary;
    background: $color-primary-soft;
    border-radius: 3px;
  }

  &__title {
    margin: 0;
    font-size: 17px;
    font-weight: $font-weight-semibold;
    line-height: 1.45;
    color: $color-text-primary;
  }

  &__sub {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: $color-text-placeholder;
  }

  &__sep {
    margin: 0 4px;
  }

  &__body {
    font-size: $font-size-sm;
    line-height: 1.95;
    color: $color-text-regular;

    p {
      margin: 0 0 12px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  &__foot {
    margin-right: auto;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

:deep(.el-dialog__footer) {
  display: flex;
  gap: $space-3;
  align-items: center;
}
</style>
