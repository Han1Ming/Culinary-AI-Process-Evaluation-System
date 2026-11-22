<script setup lang="ts">
/**
 * 公告中心
 * ----------------------------------------------------------------------------
 * 为什么在页面里而不是只靠顶栏铃铛：
 * 铃铛只放最近 5 条，且弹层一关就没了；期末调口径、维护通知这类「要回头再翻」
 * 的内容需要一个稳定地址。管理员在「通知发布」里发出去的东西，落到这里才算闭环。
 *
 * 不占侧栏菜单位：入口是顶栏铃铛的「查看全部」与工作台公告卡的「全部公告」，
 * 三个角色都能进。
 */
import { computed, onMounted, ref } from 'vue'

import AppSkeleton from '@/components/AppSkeleton.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import { useNoticeStore } from '@/stores/notice'
import { formatDateTime } from '@/utils/format'
import { NOTICE_TYPE_LABELS } from '@/types'

const notice = useNoticeStore()

const filter = ref<'all' | 'unread'>('all')

const rows = computed(() =>
  filter.value === 'unread' ? notice.unread : notice.items,
)

function excerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}

onMounted(() => {
  void notice.refresh()
})
</script>

<template>
  <div class="notices-page">
    <PageHeader title="公告" subtitle="系统公告、功能更新与维护通知，按发布时间倒序，置顶优先">
      <template #actions>
        <el-radio-group v-model="filter" size="default">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="unread">
            未读{{ notice.unreadCount ? ` · ${notice.unreadCount}` : '' }}
          </el-radio-button>
        </el-radio-group>
        <el-button :disabled="!notice.unreadCount" @click="notice.markAllRead()">
          全部标为已读
        </el-button>
      </template>
    </PageHeader>

    <AppSkeleton v-if="notice.loading && !notice.items.length" variant="list" :count="4" />
    <StateView
      v-else-if="notice.error && !notice.items.length"
      state="error"
      :description="notice.error"
      retryable
      @retry="notice.refresh(true)"
    />

    <ul v-else-if="rows.length" class="notice-list">
      <li
        v-for="item in rows"
        :key="item.id"
        class="notice-item"
        :class="{ 'is-unread': !notice.isRead(item.id) }"
      >
        <button type="button" class="notice-item__btn" @click="notice.open(item.id)">
          <span class="notice-item__dot" aria-hidden="true" />
          <span class="notice-item__main">
            <span class="notice-item__head">
              <span v-if="item.pinned" class="notice-item__pin">置顶</span>
              <span class="notice-item__type">{{ NOTICE_TYPE_LABELS[item.type] }}</span>
              <span class="notice-item__title">{{ item.title }}</span>
            </span>
            <span class="notice-item__body">{{ excerpt(item.body) }}</span>
            <span class="notice-item__meta num">
              {{ item.publisher }}
              <span class="notice-item__sep">·</span>
              {{ formatDateTime(item.publishedAt, 'YYYY-MM-DD HH:mm') }}
              <span class="notice-item__sep">·</span>
              {{ item.readCount }}/{{ item.totalCount }} 已读
            </span>
          </span>
          <el-icon class="notice-item__arrow"><ArrowRight /></el-icon>
        </button>
      </li>
    </ul>

    <p v-else class="empty-block">
      {{ filter === 'unread' ? '没有未读公告。' : '还没有公告。管理员发布后会出现在这里。' }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.notice-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

.notice-item {
  border-top: 1px solid $color-border-light;

  &:first-child {
    border-top: none;
  }

  &__btn {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    width: 100%;
    padding: 16px $space-5;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: none;

    &:hover .notice-item__title {
      color: $color-primary;
    }

    &:hover .notice-item__arrow {
      color: $color-text-secondary;
      transform: translateX(2px);
    }
  }

  &__dot {
    flex: 0 0 6px;
    width: 6px;
    height: 6px;
    margin-top: 8px;
    background: $color-border-strong;
    border-radius: 50%;
  }

  // 未读：点变实心 + 标题加重，整行不铺底色（一屏五六条全铺色会非常吵）
  &.is-unread &__dot {
    background: $color-primary;
  }

  &.is-unread &__title {
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    align-items: center;
  }

  &__pin {
    padding: 1px 6px;
    font-size: 10px;
    color: $color-primary;
    background: $color-primary-soft;
    border-radius: 3px;
  }

  &__type {
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__title {
    font-size: $font-size-base;
    color: $color-text-regular;
    transition: color $duration-fast $ease-standard;
  }

  &__body {
    overflow: hidden;
    font-size: $font-size-xs;
    line-height: 1.75;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__sep {
    margin: 0 5px;
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

.empty-block {
  padding: 64px 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}
</style>
