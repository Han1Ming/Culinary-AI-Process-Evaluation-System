<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

import { renderMarkdown } from '@/utils/markdown'
import { formatTime } from '@/utils/format'
import { useRole } from '@/composables/useRole'
import { assistantName } from '@/config/permissions'
import type { ChatMessage } from '@/types'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{ regenerate: [] }>()

const { role } = useRole()
/** 气泡上的名字与页头一致：学生看到「老师」，教师看到「助手」 */
const botName = computed(() => assistantName(role.value))

const isUser = computed(() => props.message.role === 'user')
const html = computed(() => renderMarkdown(props.message.content))
const isStreaming = computed(() => props.message.status === 'streaming')
const isError = computed(() => props.message.status === 'error')

function sizeText(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}
</script>

<template>
  <div class="chat-message" :class="isUser ? 'is-user' : 'is-assistant'">
    <span class="chat-message__avatar" :class="{ 'is-assistant': !isUser }">
      <template v-if="isUser">
        <el-icon><User /></el-icon>
      </template>
      <template v-else>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 9h14M5 9v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9M9 6v1M12 6v1M15 6v1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
      </template>
    </span>

    <div class="chat-message__main">
      <div class="chat-message__meta">
        <span class="chat-message__name">{{ isUser ? '我' : botName }}</span>
        <time>{{ formatTime(props.message.createdAt) }}</time>
      </div>

      <div class="chat-message__bubble" :class="{ 'is-error': isError }">
        <!-- 附件：图片给缩略图，PDF 给文件卡。发出去之后也要能看见自己发了什么 -->
        <div v-if="message.attachments?.length" class="atts">
          <template v-for="att in message.attachments" :key="att.id">
            <a
              v-if="att.kind === 'image'"
              class="att att--image"
              :href="att.previewUrl"
              target="_blank"
              rel="noreferrer"
            >
              <img v-if="att.previewUrl" :src="att.previewUrl" :alt="att.name" />
            </a>
            <div v-else class="att att--file">
              <span class="att__badge">{{ att.kind === 'pdf' ? 'PDF' : 'FILE' }}</span>
              <div class="att__body">
                <p class="att__name">{{ att.name }}</p>
                <span class="att__size num">{{ sizeText(att.size) }}</span>
              </div>
            </div>
          </template>
        </div>

        <div v-if="html" class="markdown-body" :class="{ 'is-streaming': isStreaming }" v-html="html" />
        <p v-else-if="isStreaming" class="chat-message__thinking">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </p>

        <p v-if="isError" class="chat-message__error">
          <el-icon><WarningFilled /></el-icon>
          {{ props.message.error || '回答生成失败' }}
        </p>
      </div>

      <div v-if="!isUser && !isStreaming" class="chat-message__actions">
        <el-button link size="small" :disabled="!props.message.content" @click="handleCopy">
          <el-icon><CopyDocument /></el-icon>复制
        </el-button>
        <el-button link size="small" @click="emit('regenerate')">
          <el-icon><RefreshRight /></el-icon>重新生成
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-message {
  display: flex;
  gap: $space-3;
  padding: $space-4 0;

  &.is-user {
    flex-direction: row-reverse;

    .chat-message__meta {
      justify-content: flex-end;
    }

    // 用户消息用深墨气泡：整页只有发送按钮是蓝色，避免两处高饱和色互相争抢
    .chat-message__bubble {
      color: #fff;
      background: $color-text-primary;
      border-color: transparent;
      border-top-right-radius: $radius-xs;
    }

    .chat-message__name {
      color: $color-text-primary;
    }

    .chat-message__main {
      align-items: flex-end;
    }
  }

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    margin-top: 22px;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-pill;

    svg {
      width: 20px;
      height: 20px;
    }

    &.is-assistant {
      color: #fff;
      background: $color-text-primary;
    }
  }

  &__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: min(720px, 86%);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $space-2;
    margin-bottom: 6px;

    time {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__name {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &__bubble {
    padding: $space-3 $space-4;
    font-size: $font-size-base;
    line-height: 1.75;
    color: $color-text-primary;
    background: $color-bg-surface;
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
    border-top-left-radius: $radius-xs;
    word-break: break-word;

    &.is-error {
      background: $color-danger-soft;
      border-color: rgba(185, 28, 28, 0.16);
    }
  }

  // 操作按钮默认淡出，悬浮消息时出现：不占用阅读注意力
  &__actions {    display: flex;
    gap: $space-1;
    margin-top: 4px;
    opacity: 0;
    transition: opacity $duration-fast $ease-standard;
  }

  &:hover &__actions {
    opacity: 1;
  }

  &__actions :deep(.el-button.is-link) {
    font-size: $font-size-xs;
    color: $color-text-placeholder;

    &:hover {
      color: $color-text-primary;
    }
  }

  &__thinking {
    display: flex;
    gap: 4px;
    padding: 4px 0;

    .dot {
      width: 6px;
      height: 6px;
      background: $color-text-placeholder;
      border-radius: 50%;
      animation: blink 1.2s infinite ease-in-out;

      &:nth-child(2) {
        animation-delay: 0.15s;
      }

      &:nth-child(3) {
        animation-delay: 0.3s;
      }
    }
  }

  &__error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: $space-2;
    font-size: $font-size-xs;
    color: $color-danger;
  }
}

// ---------- 附件 ----------
.atts {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  margin-bottom: 10px;
}

.att {
  &--image img {
    display: block;
    width: 132px;
    height: 99px;
    object-fit: cover;
    border-radius: $radius-sm;
    // 用户气泡是深色，缩略图加一圈浅边不至于糊在一起
    border: 1px solid rgba(255, 255, 255, 0.16);
    transition: opacity $duration-fast $ease-standard;
  }

  &--image:hover img {
    opacity: 0.88;
  }

  &--file {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: $radius-sm;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #fff;
    background: rgba(255, 255, 255, 0.16);
    border-radius: 4px;
  }

  &__body {
    min-width: 0;
  }

  &__name {
    max-width: 180px;
    margin: 0;
    overflow: hidden;
    font-size: $font-size-xs;
    color: rgba(255, 255, 255, 0.92);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__size {
    font-size: 10.5px;
    color: rgba(255, 255, 255, 0.5);
  }
}

// 流式输出末尾的光标闪烁
.markdown-body.is-streaming :deep(> :last-child)::after {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  content: '';
  background: $color-primary;
  animation: caret 1s steps(2, start) infinite;
}

.is-user .markdown-body.is-streaming :deep(> :last-child)::after {
  background: #fff;
}

// Markdown 排版（气泡内）
.markdown-body {
  :deep(p) {
    margin: 0 0 $space-2;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: $space-3 0 $space-2;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    line-height: 1.4;
  }

  :deep(h1:first-child),
  :deep(h2:first-child),
  :deep(h3:first-child) {
    margin-top: 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.3em;
    margin: $space-2 0;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(code) {
    padding: 1px 5px;
    font-family: $font-family-mono;
    font-size: 0.9em;
    background: $color-bg-subtle;
    border-radius: $radius-xs;
  }

  :deep(pre) {
    padding: $space-3;
    margin: $space-2 0;
    overflow-x: auto;
    background: #18181b;
    border-radius: $radius-md;

    code {
      padding: 0;
      color: #e2e8f0;
      background: transparent;
    }
  }

  :deep(table) {
    width: 100%;
    margin: $space-2 0;
    font-size: $font-size-sm;
    border-collapse: collapse;

    th,
    td {
      padding: 8px 10px;
      text-align: left;
      border: 1px solid $color-border;
    }

    th {
      font-weight: $font-weight-semibold;
      background: $color-bg-subtle;
    }
  }

  :deep(blockquote) {
    padding: 4px $space-3;
    margin: $space-2 0;
    color: $color-text-regular;
    border-left: 2px solid $color-border-strong;
  }

  :deep(a) {
    text-decoration: underline;
  }
}

.is-user .markdown-body :deep(a) {
  color: #fff;
}

@keyframes caret {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
</style>
