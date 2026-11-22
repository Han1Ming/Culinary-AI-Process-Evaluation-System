<script setup lang="ts">
/**
 * 公告卡（工作台）
 * ----------------------------------------------------------------------------
 * 置顶的那条永远在最上面：管理端「置顶到工作台首位」的承诺就落在这一个排序上。
 * 只显示标题与摘要，正文点开走全局阅读器（NoticeReader），不在卡片里折叠展开——
 * 卡片里展开会把工作台拉成长条，反而挤掉真正要看的实训数据。
 */
import { computed, onMounted } from 'vue'

import { useNoticeStore } from '@/stores/notice'
import { formatDateTime } from '@/utils/format'
import { NOTICE_TYPE_LABELS } from '@/types'

const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 3 })

const notice = useNoticeStore()

const rows = computed(() => notice.items.slice(0, props.limit))

function excerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}

// 顶栏通常已经拉过一次；这里只兜「顶栏没拉到」的情况（直接进 /notices 或首屏弱网）
onMounted(() => {
  if (!notice.items.length) void notice.refresh()
})
</script>

<template>
  <section class="app-card notice-board">
    <div class="card-head">
      <div>
        <h2 class="card-head__title">公告</h2>
        <p class="card-head__desc">
          <template v-if="notice.unreadCount">
            <span class="num">{{ notice.unreadCount }}</span> 条未读
          </template>
          <template v-else>已全部读过</template>
        </p>
      </div>
      <el-button link type="primary" @click="$router.push('/notices')">全部公告</el-button>
    </div>

    <ul v-if="rows.length" class="board-list">
      <li v-for="item in rows" :key="item.id">
        <button type="button" class="board-item" @click="notice.open(item.id)">
          <span
            class="board-item__dot"
            :class="notice.isRead(item.id) ? '' : 'is-unread'"
            aria-hidden="true"
          />
          <span class="board-item__body">
            <span class="board-item__title">{{ item.title }}</span>
            <span class="board-item__desc">{{ excerpt(item.body) }}</span>
            <span class="board-item__meta num">
              {{ NOTICE_TYPE_LABELS[item.type] }}
              <span class="board-item__sep">·</span>
              {{ formatDateTime(item.publishedAt, 'MM-DD HH:mm') }}
            </span>
          </span>
          <el-icon class="board-item__arrow"><ArrowRight /></el-icon>
        </button>
      </li>
    </ul>

    <p v-else-if="notice.loading" class="empty-line">正在读取公告…</p>
    <p v-else class="empty-line">暂无公告</p>
  </section>
</template>

<style scoped lang="scss">
.board-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.board-item {
  display: flex;
  gap: $space-2;
  align-items: flex-start;
  width: 100%;
  padding: 10px 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-top: 1px solid $color-border-light;

  &:hover .board-item__title {
    color: $color-primary;
  }

  &:hover .board-item__arrow {
    color: $color-text-secondary;
    transform: translateX(2px);
  }

  &:first-child {
    border-top: none;
  }

  &__dot {
    flex: 0 0 5px;
    width: 5px;
    height: 5px;
    margin-top: 7px;
    background: $color-border-strong;
    border-radius: 50%;

    // 未读用实心强调点，不用整行变色：一行一个颜色会显得工作台很吵
    &.is-unread {
      background: $color-primary;
    }
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    transition: color $duration-fast $ease-standard;
  }

  &__desc {
    overflow: hidden;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__sep {
    margin: 0 4px;
  }

  &__arrow {
    flex: 0 0 auto;
    margin-top: 4px;
    font-size: 12px;
    color: $color-text-placeholder;
    transition:
      color $duration-fast $ease-standard,
      transform $duration-fast $ease-standard;
  }
}
</style>
