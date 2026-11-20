<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'

import ApiDrawer from '@/components/ApiDrawer.vue'
import type { EndpointSpec } from '@/components/ApiPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import ChatMessage from './components/ChatMessage.vue'
import SessionDrawer from './components/SessionDrawer.vue'
import { useRole } from '@/composables/useRole'
import { useChatStore } from '@/stores/chat'
import { USE_MOCK } from '@/utils/env'
import type { AttachmentKind, ChatAttachment } from '@/types'

/** 窄栏 860px 塞不下右列，接口说明走抽屉 */
const apiVisible = ref(false)
const endpoints: EndpointSpec[] = [
  {
    name: '流式问答',
    method: 'POST',
    path: '/api/v1/chat',
    request: `POST /api/v1/chat
Accept: text/event-stream
Authorization: Bearer <token>

{
  "message": "这个芡汁为什么挂不住？",
  "session_id": "s_1",
  "file_ids": ["f_9a2c"],
  "stream": true
}`,
    response: `Content-Type: text/event-stream

data: {"content": "收汁"}

data: {"content": "阶段"}

data: [DONE]`,
    note: '每帧给 {"content": "..."} 或裸文本都可以，前端两种都兼容；必须以 data: [DONE] 收尾。不要用 EventSource，前端用 fetch + ReadableStream 解析（src/utils/sse.ts）。',
  },
  {
    name: '附件上传',
    method: 'POST',
    path: '/api/v1/files',
    request: `FormData {
  file: <jpeg | pdf>,
  scene: "chat"
}`,
    response: `{
  "code": 0,
  "data": {
    "id": "f_9a2c",
    "url": "https://oss.example.com/f_9a2c.jpg",
    "kind": "image",
    "size": 184320
  },
  "message": "ok"
}`,
    note: '图片建议后端压到 1280px 长边再入库；PDF 需要文本抽取，扫描件走 OCR。返回的 id 放进 /api/v1/chat 的 file_ids。',
  },
  {
    name: '会话列表',
    method: 'GET',
    path: '/api/v1/chat/sessions',
    request: `GET /api/v1/chat/sessions`,
    response: `{
  "code": 0,
  "data": [
    {
      "id": "s_1",
      "title": "芡汁挂不住怎么调",
      "messageCount": 12,
      "updatedAt": "2026-11-20T09:20:00"
    }
  ]
}`,
    note: '抽屉里的历史会话来源，删除走 DELETE /api/v1/chat/sessions/{id}。',
  },
]

/**
 * 智能 AI 老师
 * ----------------------------------------------------------------------------
 * 布局：居中窄栏（max 820px），顶部会话信息条 + 消息流 + 一体化输入区。
 * 空状态刻意不用「大图标 + 居中问候 + 胶囊按钮」，改为左对齐的示例问题列表，
 * 阅读路径从上到下，一眼知道能问什么。
 *
 * 【为什么改成「老师」并支持附件】
 * 学生真正卡住的时候，嘴上说不清问题——手上有一张成品图、一份老师发的菜谱。
 * 让他把图或 PDF 直接扔进来，比让他描述「我的汁有点稀」有效得多。
 * 三个入口（拍照、传菜谱、问工艺）对应三种最常见的卡点。
 */
const { isStudent } = useRole()
const chatStore = useChatStore()
const { messages, sessions, streaming, activeSessionId, activeSession } = storeToRefs(chatStore)

const draft = ref('')
const drawerVisible = ref(false)
const listRef = ref<HTMLElement | null>(null)
const composerFocused = ref(false)
const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)

/** 待发送的附件：图片给缩略图，PDF 给文件卡 */
const pending = ref<ChatAttachment[]>([])
const MAX_FILES = 4
const MAX_SIZE = 20 * 1024 * 1024

const title = computed(() => (isStudent.value ? '智能 AI 老师' : '课程 AI 助教'))
const subtitle = computed(() =>
  isStudent.value
    ? '发一张成品图或本节课的菜谱，问怎么把这道菜做得更好'
    : '上传菜谱让 AI 先读一遍，备课与讲解要点直接取用',
)

const placeholder = computed(() =>
  pending.value.length
    ? '再说一句你想问的，比如「这个芡汁为什么挂不住」'
    : '问工艺、发成品图或菜谱 PDF…',
)

const suggestions = computed(() =>
  isStudent.value
    ? [
        '糖醋汁的酸甜比怎么调才不发苦？',
        '滑油的时候总粘锅，是油温不够吗？',
        '切丝怎么才能切得又快又齐？',
        '摆盘的时候配菜应该放在哪？',
      ]
    : [
        '怎么把这份菜谱拆成可讲解的三个难点？',
        '焯水环节的合格标准怎么定？',
        '学生收汁总过头，怎么讲更清楚？',
        '过程评价的观测点应该选哪几个？',
      ],
)

/** 仅当用户停留在底部附近时才自动滚动，避免打断向上翻阅 */
function scrollToBottom(force = false): void {
  const el = listRef.value
  if (!el) return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
  if (force || nearBottom) {
    el.scrollTop = el.scrollHeight
  }
}

onMounted(async () => {
  await chatStore.init()
  await nextTick()
  scrollToBottom(true)
})

watch(
  () => [messages.value.length, messages.value[messages.value.length - 1]?.content.length],
  () => {
    void nextTick(() => scrollToBottom())
  },
  { flush: 'post' },
)

/* ---------------- 附件 ---------------- */

function kindOf(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  return 'file'
}

function addFiles(files: FileList | File[]): void {
  const list = Array.from(files)
  for (const file of list) {
    if (pending.value.length >= MAX_FILES) {
      ElMessage.warning(`一次最多 ${MAX_FILES} 个文件`)
      break
    }
    if (file.size > MAX_SIZE) {
      ElMessage.warning(`${file.name} 超过 20MB，请压缩后再发`)
      continue
    }
    const kind = kindOf(file)
    if (kind === 'file') {
      ElMessage.warning('目前支持图片与 PDF')
      continue
    }
    pending.value.push({
      id: `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      kind,
      mime: file.type,
      // 真实环境这里先压缩再上传；面试/演示阶段只用 objectURL 做缩略图
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    })
  }
}

function pickFile(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

function removeFile(id: string): void {
  const target = pending.value.find((a) => a.id === id)
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  pending.value = pending.value.filter((a) => a.id !== id)
}

function clearFiles(): void {
  pending.value.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
  pending.value = []
}

/**
 * 发送时把附件从待发区「移交」出去。
 * 注意不能调 URL.revokeObjectURL——气泡里还要用这个地址显示缩略图，
 * 释放了图片就变成一块黑框（踩过一次）。
 */
function takeFiles(): ChatAttachment[] {
  const taken = pending.value
  pending.value = []
  return taken
}

/** 截图后直接 Ctrl+V 粘进来，是最顺手的动作 */
function onPaste(event: ClipboardEvent): void {
  const files = event.clipboardData?.files
  if (!files?.length) return
  event.preventDefault()
  addFiles(files)
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files)
}

/* ---------------- 发送 ---------------- */

async function handleSend(text?: string): Promise<void> {
  const content = (text ?? draft.value).trim()
  if ((!content && !pending.value.length) || streaming.value) return

  const attachments = takeFiles()
  draft.value = ''
  await nextTick()
  scrollToBottom(true)
  await chatStore.send(content, attachments)
  await nextTick()
  scrollToBottom(true)
}

async function handleRegenerate(): Promise<void> {
  await chatStore.regenerate()
  await nextTick()
  scrollToBottom(true)
}

function handleNewSession(): void {
  if (streaming.value) {
    ElMessage.warning('当前回答生成中，请先停止再新建会话')
    return
  }
  clearFiles()
  chatStore.createSession()
  drawerVisible.value = false
}

function handleSelect(id: string): void {
  chatStore.switchSession(id)
}

async function handleRemove(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('删除后该会话的历史记录将不可恢复。', '删除会话', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await chatStore.removeSession(id)
  ElMessage.success('会话已删除')
}

/** Enter 发送、Shift+Enter 换行；中文输入法组词期间不触发发送 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) return
  if (event.isComposing) return
  event.preventDefault()
  void handleSend()
}
</script>

<template>
  <div class="chat-page">
    <PageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <el-button @click="drawerVisible = true">
          <el-icon><ChatLineSquare /></el-icon>
          历史会话
        </el-button>
        <el-button @click="apiVisible = true">
          <el-icon><Connection /></el-icon>
          接口
        </el-button>
        <el-button type="primary" @click="handleNewSession">
          <el-icon><Plus /></el-icon>
          新对话
        </el-button>
      </template>
    </PageHeader>

    <section
      class="chat-shell"
      :class="{ 'is-dragging': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="chat-shell__inner">
        <header class="chat-shell__bar">
          <div class="chat-shell__title">
            <span class="status-dot status-dot--success status-dot--live" />
            {{ messages.length ? (activeSession?.title ?? '新对话') : '新对话' }}
          </div>
          <div class="chat-shell__meta">
            <span>{{ messages.length }} 条消息</span>
            <span class="chat-shell__sep" />
            <span>{{ USE_MOCK ? 'Mock 模式' : '已连接后端' }}</span>
          </div>
        </header>

        <div ref="listRef" class="chat-shell__list">
          <div v-if="!messages.length" class="welcome">
            <p class="welcome__eyebrow">AI 老师</p>
            <h2 class="welcome__title">把手上有的东西发过来，问题就好讲清楚</h2>

            <!-- 三个入口对应三种卡点：说不清 → 给图 / 给菜谱 / 直接问 -->
            <ul class="welcome__modes">
              <li>
                <button type="button" class="mode" @click="pickFile">
                  <span class="mode__label">拍一张成品图</span>
                  <span class="mode__desc">按图说问题出在哪、下一步练什么</span>
                </button>
              </li>
              <li>
                <button type="button" class="mode" @click="pickFile">
                  <span class="mode__label">上传本节课菜谱 PDF</span>
                  <span class="mode__desc">先讲难点与易错点，再给你练习顺序</span>
                </button>
              </li>
              <li>
                <button type="button" class="mode" @click="draft = '糖醋汁的酸甜比怎么调才不发苦？'">
                  <span class="mode__label">直接问一个工艺问题</span>
                  <span class="mode__desc">火候、刀工、收汁、摆盘都可以问</span>
                </button>
              </li>
            </ul>

            <p class="welcome__sub">也可以从这些问题开始</p>
            <ul class="welcome__list">
              <li
                v-for="(item, index) in suggestions"
                :key="item"
                class="welcome__item"
                :style="{ '--i': index }"
              >
                <button type="button" class="welcome__ask" @click="handleSend(item)">
                  <span class="welcome__text">{{ item }}</span>
                  <el-icon class="welcome__arrow"><ArrowRight /></el-icon>
                </button>
              </li>
            </ul>

            <p class="welcome__foot">
              给的是工艺建议与练习方法；具体得分在「AI 综合评价」里按环节拆开看，这里不报分数。
            </p>
          </div>

          <ChatMessage
            v-for="message in messages"
            :key="message.id"
            :message="message"
            @regenerate="handleRegenerate"
          />
        </div>

        <footer class="chat-shell__composer">
          <div class="composer" :class="{ 'is-focused': composerFocused }">
            <!-- 待发送附件 -->
            <ul v-if="pending.length" class="pending">
              <li v-for="att in pending" :key="att.id" class="pending__item">
                <img
                  v-if="att.kind === 'image' && att.previewUrl"
                  :src="att.previewUrl"
                  :alt="att.name"
                  class="pending__thumb"
                />
                <span v-else class="pending__badge">{{ att.kind === 'pdf' ? 'PDF' : 'FILE' }}</span>
                <span class="pending__name">{{ att.name }}</span>
                <button
                  type="button"
                  class="pending__remove"
                  :aria-label="`移除 ${att.name}`"
                  @click="removeFile(att.id)"
                >
                  ×
                </button>
              </li>
            </ul>

            <el-input
              v-model="draft"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 6 }"
              resize="none"
              :placeholder="placeholder"
              class="composer__input"
              @keydown="handleKeydown"
              @paste="onPaste"
              @focus="composerFocused = true"
              @blur="composerFocused = false"
            />

            <div class="composer__bar">
              <div class="composer__left">
                <button type="button" class="attach" aria-label="添加图片或 PDF" @click="pickFile">
                  <el-icon><Paperclip /></el-icon>
                </button>
                <span class="composer__hint">Enter 发送 · Shift + Enter 换行 · 可拖入文件</span>
              </div>

              <div class="composer__actions">
                <el-button v-if="streaming" size="small" @click="chatStore.stop()">
                  <el-icon><VideoPause /></el-icon>
                  停止
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  size="small"
                  :disabled="!draft.trim() && !pending.length"
                  @click="handleSend()"
                >
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <!-- 拖拽提示：只在拖动经过时出现，不做常驻蒙层 -->
      <div v-if="dragging" class="dropzone" aria-hidden="true">
        <span>松手即可添加图片或 PDF</span>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*,application/pdf"
        multiple
        class="chat-shell__file"
        @change="onFileChange"
      />
    </section>

    <SessionDrawer
      v-model="drawerVisible"
      :sessions="sessions"
      :active-id="activeSessionId"
      @select="handleSelect"
      @create="handleNewSession"
      @remove="handleRemove"
    />

    <ApiDrawer v-model="apiVisible" :endpoints="endpoints" title="智能 AI 老师 · 后端接入" />
  </div>
</template>

<style scoped lang="scss">
.chat-page {
  display: flex;
  flex-direction: column;
  // 顶栏 56 + 内容区上下内边距 20 + 32
  height: calc(100vh - 108px);
  min-height: 540px;
}

.chat-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  transition: border-color $duration-fast $ease-standard;

  &.is-dragging {
    border-color: $color-primary;
  }

  &__inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 820px;
    height: 100%;
    margin: 0 auto;
    padding: 0 $space-6;
  }

  &__bar {
    display: flex;
    flex-shrink: 0;
    gap: $space-3;
    align-items: center;
    justify-content: space-between;
    height: 46px;
    border-bottom: 1px solid $color-border-light;
  }

  &__title {
    display: flex;
    gap: $space-2;
    align-items: center;
    overflow: hidden;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
    align-items: center;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__sep {
    width: 1px;
    height: 10px;
    background: $color-border;
  }

  &__list {
    flex: 1;
    min-height: 0;
    padding: $space-5 0 $space-4;
    overflow-y: auto;
    // 平滑滚动只用于程序化滚动，用户拖动不受影响
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }

  &__composer {
    flex-shrink: 0;
    padding: 0 0 $space-4;
  }

  &__file {
    display: none;
  }
}

.dropzone {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-sm;
  color: $color-primary;
  pointer-events: none;
  background: rgba(47, 84, 235, 0.04);
  border: 1.5px dashed rgba(47, 84, 235, 0.5);
  border-radius: $radius-lg;
}

// ---------- 空状态 ----------
.welcome {
  padding-top: clamp(24px, 5vh, 56px);

  &__eyebrow {
    font-size: 11px;
    font-weight: $font-weight-medium;
    letter-spacing: 0.08em;
    color: $color-text-placeholder;
    text-transform: uppercase;
  }

  &__title {
    max-width: 22em;
    margin-top: 6px;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    line-height: 1.45;
  }

  // 三个入口用横排三栏：入口是「动作」，不是「问题」，所以不能和下面的列表同样式
  &__modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $space-2;
    padding: 0;
    margin: $space-4 0 0;
    list-style: none;
  }

  &__sub {
    margin: $space-6 0 0;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: $color-text-placeholder;
  }

  &__list {
    margin-top: $space-2;
  }

  &__item {
    opacity: 0;
    animation: app-fade-up 380ms $ease-emphasized forwards;
    animation-delay: calc(80ms + var(--i) * 45ms);

    & + & {
      border-top: 1px solid $color-border-light;
    }
  }

  &__ask {
    display: flex;
    gap: $space-3;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 11px 8px 11px 0;
    font-size: $font-size-sm;
    color: $color-text-regular;
    text-align: left;
    cursor: pointer;
    background: none;
    border: none;
    border-radius: $radius-sm;
    transition: color $duration-fast $ease-standard, padding-left $duration-fast $ease-standard;

    &:hover {
      padding-left: 6px;
      color: $color-text-primary;

      .welcome__arrow {
        color: $color-text-secondary;
        transform: translateX(2px);
      }
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__arrow {
    flex: 0 0 12px;
    font-size: 12px;
    color: $color-text-placeholder;
    transition: transform $duration-fast $ease-standard, color $duration-fast $ease-standard;
  }

  &__foot {
    margin-top: $space-4;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.mode {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  height: 100%;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  background: $color-bg-page;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  transition:
    border-color $duration-fast $ease-standard,
    transform $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-strong;
    transform: translateY(-1px);
  }

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__desc {
    font-size: 11.5px;
    line-height: 1.55;
    color: $color-text-placeholder;
  }
}

// ---------- 输入区：一体化容器，聚焦时整块高亮 ----------
.composer {
  padding: 10px 12px 8px;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  transition: border-color $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-strong;
  }

  &.is-focused {
    border-color: $color-primary;
    box-shadow: $shadow-focus;
  }

  &__input {
    :deep(.el-textarea__inner) {
      padding: 2px 2px 8px;
      font-size: $font-size-base;
      line-height: 1.65;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      resize: none;

      &:focus {
        background: transparent;
        box-shadow: none;
      }
    }
  }

  &__bar {
    display: flex;
    gap: $space-3;
    align-items: center;
    justify-content: space-between;
  }

  &__left {
    display: flex;
    gap: $space-2;
    align-items: center;
    min-width: 0;
  }

  &__hint {
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
  }
}

// 回形针：与发送按钮同高，但视觉上退到输入框里
.attach {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: $color-text-secondary;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: $radius-sm;
  transition:
    color $duration-fast $ease-standard,
    background-color $duration-fast $ease-standard;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-subtle;
  }
}

.pending {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 0 0 8px;
  list-style: none;

  &__item {
    display: flex;
    gap: 7px;
    align-items: center;
    max-width: 220px;
    padding: 4px 6px 4px 4px;
    background: $color-bg-subtle;
    border: 1px solid $color-border-light;
    border-radius: $radius-sm;
  }

  &__thumb {
    width: 30px;
    height: 30px;
    object-fit: cover;
    border-radius: 3px;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    font-size: 9px;
    font-weight: 600;
    color: $color-text-secondary;
    background: $color-bg-surface;
    border: 1px solid $color-border-light;
    border-radius: 3px;
  }

  &__name {
    overflow: hidden;
    font-size: 11.5px;
    color: $color-text-regular;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__remove {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 13px;
    line-height: 1;
    color: $color-text-placeholder;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: $color-danger;
    }
  }
}

@media (max-width: $breakpoint-lg) {
  .chat-page {
    height: calc(100vh - 88px);
  }
}

@media (max-width: $breakpoint-md) {
  .chat-shell__inner {
    padding: 0 $space-4;
  }

  .composer__hint {
    display: none;
  }

  .chat-shell__meta {
    display: none;
  }

  .welcome__modes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
