<script setup lang="ts">
/**
 * 浮空助手
 * ----------------------------------------------------------------------------
 * 位置：右下角，挂在 DefaultLayout 上。
 *
 * 【与七大模块的边界】它不评价菜品、不报告识别结果，只做四件事：
 *   找功能（导航）、解释规则、排查故障、指向数据。越界提问会被引导到模块页。
 *
 * 【按角色服务】学生问菜谱与工艺，教师问上传与扣分，同一句「怎么弄」两侧
 *   答案不同（见 utils/assistant.ts 的 roles）。管理员不挂这个入口——
 *   能力点 assistant.use 里没有 admin，整个组件直接不渲染。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useRole } from '@/composables/useRole'
import { assistantName } from '@/config/permissions'
import {
  getGreeting,
  getQuickQuestions,
  matchIntent,
  type AssistantAction,
  type AssistantRole,
} from '@/utils/assistant'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** 回复附带的跳转动作 */
  action?: AssistantAction
  /** 是否仍在逐字输出 */
  typing?: boolean
}

const router = useRouter()
const { role, can } = useRole()

/** 只有学生与教师有这个入口；管理员整天在管人，不需要一个陪聊的球 */
const enabled = computed(() => can('assistant.use'))
const audience = computed<AssistantRole>(() => (role.value === 'teacher' ? 'teacher' : 'student'))
/** 面板标题与菜单、页头同源，不在这里另起一个「教学助手」的叫法 */
const panelTitle = computed(() => assistantName(role.value))
const quickQuestions = computed(() => getQuickQuestions(audience.value))
const subtitle = computed(() =>
  audience.value === 'teacher' ? '上传 · 扣分 · 归档 · 对接' : '菜谱 · 工艺 · 我的成绩',
)

const open = ref(false)
const input = ref('')
const listRef = ref<HTMLDivElement>()
const inputRef = ref<HTMLInputElement>()

let seed = 0
const messages = ref<Message[]>([
  { id: ++seed, role: 'assistant', text: getGreeting('student') },
])

const hasUnread = ref(true)

/** 角色切换（演示账号互相切换时会走到）要重置开场白，不然学生会看到教师的自我介绍 */
watch(
  audience,
  (next) => {
    messages.value = [{ id: ++seed, role: 'assistant', text: getGreeting(next) }]
    hasUnread.value = true
  },
  { immediate: false },
)

let typingTimer: number | undefined
let scrollRaf = 0

const lastAssistantTyping = computed(() => messages.value.some((m) => m.typing))

function scrollToBottom(): void {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/** 逐字输出：每 18ms 一个字，中文阅读节奏接近真实打字 */
function typeOut(message: Message, full: string): void {
  message.typing = true
  let i = 0
  typingTimer = window.setInterval(() => {
    i += 1
    message.text = full.slice(0, i)
    scrollToBottom()
    if (i >= full.length) {
      window.clearInterval(typingTimer)
      message.typing = false
      scrollToBottom()
    }
  }, 18)
}

async function ask(text: string): Promise<void> {
  const question = text.trim()
  if (!question || lastAssistantTyping.value) return

  messages.value.push({ id: ++seed, role: 'user', text: question })
  input.value = ''
  scrollToBottom()

  // 模拟检索耗时，避免回复快到不真实
  await new Promise((r) => setTimeout(r, 320))
  const reply = matchIntent(question, audience.value)

  messages.value.push({ id: ++seed, role: 'assistant', text: '', typing: true })
  // 必须拿回数组里的响应式代理再改；直接改 push 前的字面量不会触发视图更新
  const message = messages.value[messages.value.length - 1]
  typeOut(message, reply.text)

  // 动作在打字结束后挂上，避免按钮先于文字出现
  const timer = window.setInterval(() => {
    if (!message.typing) {
      window.clearInterval(timer)
      if (reply.action) message.action = reply.action
      scrollToBottom()
    }
  }, 60)
}

function openPanel(): void {
  open.value = true
  hasUnread.value = false
  void nextTick(() => {
    inputRef.value?.focus()
    scrollToBottom()
  })
}

function closePanel(): void {
  open.value = false
}

function go(action: AssistantAction): void {
  if (action.to) {
    void router.push(action.to)
    closePanel()
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) closePanel()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearInterval(typingTimer)
  cancelAnimationFrame(scrollRaf)
})

watch(open, (v) => {
  if (v) hasUnread.value = false
})
</script>

<template>
  <div v-if="enabled" class="assistant">
    <!-- 触发球 -->
    <button
      v-show="!open"
      type="button"
      class="ball"
      :aria-label="audience === 'teacher' ? '打开教学端助手' : '打开学习端助手'"
      @click="openPanel"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 9.2c0-3.1 2.9-5.6 6.5-5.6s6.5 2.5 6.5 5.6c0 2.2-1.4 4.1-3.6 5l.6 2.6-3.1-1.6a8 8 0 0 1-1.4.1c-3.6 0-6.5-2.5-6.5-5.6Z"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <path d="M18.2 13.6c.9.8 1.4 1.9 1.4 3.1 0 1.8-1.3 3.4-3.2 4.2l.4 1.8-2.2-1.1" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
      <span v-if="hasUnread" class="ball__dot" aria-hidden="true" />
    </button>

    <!-- 面板 -->
    <Transition name="assistant">
      <section
        v-if="open"
        class="panel"
        role="dialog"
        :aria-label="audience === 'teacher' ? '教学端助手' : '学习端助手'"
        aria-modal="false"
      >
        <header class="panel__head">
          <div class="panel__title">
            <h2>{{ panelTitle }}</h2>
            <p>{{ subtitle }}</p>
          </div>
          <button type="button" class="panel__close" aria-label="关闭助手" @click="closePanel">
            <span />
          </button>
        </header>

        <div ref="listRef" class="panel__body">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="msg"
            :class="`msg--${msg.role}`"
          >
            <p class="msg__text">{{ msg.text }}<span v-if="msg.typing" class="msg__caret" /></p>
            <button
              v-if="msg.action"
              type="button"
              class="msg__action"
              @click="go(msg.action)"
            >
              {{ msg.action.label }}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div class="panel__quick">
          <button
            v-for="q in quickQuestions"
            :key="q"
            type="button"
            class="quick"
            @click="ask(q)"
          >
            {{ q }}
          </button>
        </div>

        <form class="panel__composer" @submit.prevent="ask(input)">
          <input
            ref="inputRef"
            v-model="input"
            type="text"
            placeholder="描述你遇到的问题"
            aria-label="输入问题"
            maxlength="60"
          />
          <button type="submit" aria-label="发送" :disabled="!input.trim() || lastAssistantTyping">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </form>
      </section>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.assistant {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
}

// ---------- 球 ----------
.ball {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  color: #fff;
  cursor: pointer;
  background: $color-text-primary;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 6px 20px -6px rgba(24, 24, 27, 0.45);
  transition:
    transform $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;
  place-items: center;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    box-shadow: 0 10px 26px -8px rgba(24, 24, 27, 0.5);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &__dot {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 9px;
    height: 9px;
    background: $color-primary;
    border: 2px solid #fff;
    border-radius: 50%;
  }
}

// ---------- 面板 ----------
.panel {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 372px;
  height: 552px;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-xl;
  box-shadow: 0 16px 48px -12px rgba(24, 24, 27, 0.22), 0 2px 8px -2px rgba(24, 24, 27, 0.06);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 16px 14px;
    border-bottom: 1px solid $color-border-light;
  }

  &__title {
    h2 {
      margin: 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__close {
    display: grid;
    width: 26px;
    height: 26px;
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: $radius-sm;
    place-items: center;

    span {
      position: relative;
      display: block;
      width: 12px;
      height: 1.5px;
      background: $color-text-secondary;
      transform: rotate(45deg);

      &::after {
        position: absolute;
        top: 0;
        left: 0;
        width: 12px;
        height: 1.5px;
        content: '';
        background: $color-text-secondary;
        transform: rotate(90deg);
      }
    }

    &:hover {
      background: $color-bg-subtle;
    }
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &__quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 16px;
    border-top: 1px solid $color-border-light;
  }

  &__composer {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px 12px;
    border-top: 1px solid $color-border-light;

    input {
      flex: 1;
      height: 36px;
      padding: 0 12px;
      font-family: inherit;
      font-size: $font-size-sm;
      color: $color-text-primary;
      background: $color-bg-subtle;
      border: 1px solid transparent;
      border-radius: $radius-md;
      transition: border-color $duration-fast $ease-standard;

      &::placeholder {
        color: $color-text-placeholder;
      }

      &:focus {
        background: $color-bg-surface;
        border-color: $color-border-strong;
        outline: none;
      }
    }

    button {
      display: grid;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      color: #fff;
      cursor: pointer;
      background: $color-primary;
      border: 0;
      border-radius: $radius-md;
      transition: background-color $duration-fast $ease-standard;
      place-items: center;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: $color-primary-hover;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
      }
    }
  }
}

// ---------- 消息 ----------
.msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 92%;

  &__text {
    padding: 10px 13px;
    margin: 0;
    font-size: $font-size-sm;
    line-height: 1.75;
    color: $color-text-regular;
    white-space: pre-wrap;
    background: $color-bg-subtle;
    border-radius: 10px 10px 10px 3px;
  }

  &--user {
    align-self: flex-end;
    align-items: flex-end;

    .msg__text {
      color: #fff;
      background: $color-text-primary;
      border-radius: 10px 10px 3px;
    }
  }

  &__caret {
    display: inline-block;
    width: 2px;
    height: 13px;
    margin-left: 2px;
    vertical-align: -2px;
    background: $color-text-regular;
    animation: caret 0.9s steps(2) infinite;
  }

  &__action {
    margin-top: 8px;
    padding: 6px 12px;
    font-family: inherit;
    font-size: $font-size-xs;
    color: $color-primary;
    cursor: pointer;
    background: $color-primary-soft;
    border: 0;
    border-radius: $radius-md;
    transition: background-color $duration-fast $ease-standard;

    span {
      margin-left: 4px;
    }

    &:hover {
      background: #e3e8fc;
    }
  }
}

@keyframes caret {
  50% {
    opacity: 0;
  }
}

.quick {
  padding: 5px 10px;
  font-family: inherit;
  font-size: 11.5px;
  color: $color-text-secondary;
  cursor: pointer;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  transition:
    border-color $duration-fast $ease-standard,
    color $duration-fast $ease-standard;

  &:hover {
    color: $color-text-primary;
    border-color: $color-border-strong;
  }
}

// ---------- 进出场 ----------
.assistant-enter-active,
.assistant-leave-active {
  transition:
    opacity $duration-base $ease-standard,
    transform $duration-base $ease-standard;
  transform-origin: bottom right;
}

.assistant-enter-from,
.assistant-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

// ---------- 移动端 ----------
@media (max-width: $breakpoint-md) {
  .assistant {
    right: 16px;
    bottom: 16px;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    height: auto;
    max-height: none;
    border: 0;
    border-radius: 0;
  }

  .ball {
    width: 48px;
    height: 48px;
  }
}
</style>
