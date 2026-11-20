<script setup lang="ts">
import { formatFromNow } from '@/utils/format'
import type { ChatSession } from '@/types'

defineProps<{
  modelValue: boolean
  sessions: ChatSession[]
  activeId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [id: string]
  create: []
  remove: [id: string]
}>()

function close(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="会话列表"
    direction="rtl"
    size="320px"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <template #header>
      <div class="drawer-head">
        <span class="drawer-head__title">会话列表</span>
        <el-button size="small" type="primary" plain @click="emit('create')">
          <el-icon><Plus /></el-icon>新建
        </el-button>
      </div>
    </template>

    <ul class="session-list">
      <li
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ 'is-active': session.id === activeId }"
        @click="emit('select', session.id); close()"
      >
        <span class="session-item__icon">
          <el-icon><ChatLineSquare /></el-icon>
        </span>
        <div class="session-item__body">
          <p class="session-item__title">{{ session.title }}</p>
          <span class="session-item__meta">{{ formatFromNow(session.updatedAt) }} · {{ session.messageCount }} 条</span>
        </div>
        <button class="session-item__del" type="button" aria-label="删除会话" @click.stop="emit('remove', session.id)">
          <el-icon><Delete /></el-icon>
        </button>
      </li>

      <li v-if="!sessions.length" class="session-list__empty">暂无历史会话</li>
    </ul>

    <p class="session-list__tip">
      <el-icon><InfoFilled /></el-icon>
      历史会话由后端 <code>/v1/chat/sessions</code> 提供，当前为接口预留状态。
    </p>
  </el-drawer>
</template>

<style scoped lang="scss">
.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
  }
}

.session-list {
  padding: 0;
  margin: 0;
  list-style: none;

  &__empty {
    padding: $space-6 0;
    font-size: $font-size-sm;
    color: $color-text-placeholder;
    text-align: center;
  }

  &__tip {
    display: flex;
    gap: 6px;
    padding: $space-3;
    margin-top: $space-4;
    font-size: 11px;
    line-height: 1.6;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-md;

    code {
      font-family: $font-family-mono;
    }
  }
}

.session-item {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-3;
  margin-bottom: $space-1;
  cursor: pointer;
  border-radius: $radius-md;
  transition: background-color $duration-fast $ease-out;

  &:hover {
    background: $color-bg-hover;
  }

  &.is-active {
    background: $color-primary-soft;

    .session-item__title {
      color: $color-primary;
      font-weight: $font-weight-semibold;
    }

    .session-item__icon {
      color: $color-primary;
      background: #fff;
    }
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    font-size: 15px;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-sm;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: $color-text-placeholder;
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: $radius-sm;
    opacity: 0;
    transition: opacity $duration-fast $ease-out, color $duration-fast $ease-out;

    &:hover {
      color: $color-danger;
    }
  }

  &:hover &__del {
    opacity: 1;
  }
}
</style>
