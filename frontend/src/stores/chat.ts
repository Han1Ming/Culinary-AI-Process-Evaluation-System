import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'

import { CHAT_STREAM_URL, deleteChatSession, fetchChatSessions } from '@/api/chat'
import { useSSE } from '@/composables/useSSE'
import { USE_MOCK } from '@/utils/env'
import { mockChatSessions } from '@/mock'
import { mockTeacherReply } from '@/mock/teacher'
import type { ChatAttachment, ChatMessage, ChatSession } from '@/types'

const uid = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * 智能 AI 老师 · 会话状态
 * - messages：当前会话消息列表（按会话 id 分组保存，支持切换）
 * - streaming：是否正在流式输出
 * - 流式能力来自 composables/useSSE（fetch + ReadableStream）
 *
 * 附件不在这里处理上传：页面负责选文件、压图、生成缩略图，
 * 真正上传（POST /api/v1/files）拿到 file_id 后再随消息发送。
 * store 只负责把附件挂在消息上，让气泡能显示「我发了什么」。
 */
export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref('')
  const messagesMap = reactive<Record<string, ChatMessage[]>>({})
  const streaming = ref(false)
  const initialized = ref(false)

  const { start, abort } = useSSE()
  let cancelled = false

  const messages = computed<ChatMessage[]>(() => messagesMap[activeSessionId.value] ?? [])
  const activeSession = computed<ChatSession | null>(
    () => sessions.value.find((item) => item.id === activeSessionId.value) ?? null,
  )

  function createSession(title = '新的对话'): ChatSession {
    const session: ChatSession = { id: uid('s'), title, updatedAt: Date.now(), messageCount: 0 }
    sessions.value.unshift(session)
    messagesMap[session.id] = []
    activeSessionId.value = session.id
    return session
  }

  function ensureActive(): ChatSession {
    const found = sessions.value.find((item) => item.id === activeSessionId.value)
    if (found) {
      if (!messagesMap[found.id]) messagesMap[found.id] = []
      return found
    }
    return createSession()
  }

  async function init(): Promise<void> {
    if (initialized.value) return
    initialized.value = true
    try {
      sessions.value = await fetchChatSessions()
    } catch {
      sessions.value = USE_MOCK ? [...mockChatSessions] : []
    }
    if (!sessions.value.length) {
      createSession()
      return
    }
    sessions.value.forEach((item) => {
      messagesMap[item.id] = []
    })
    activeSessionId.value = sessions.value[0].id
  }

  function switchSession(id: string): void {
    if (streaming.value || id === activeSessionId.value) return
    if (!messagesMap[id]) messagesMap[id] = []
    activeSessionId.value = id
  }

  async function removeSession(id: string): Promise<void> {
    sessions.value = sessions.value.filter((item) => item.id !== id)
    delete messagesMap[id]
    if (!sessions.value.length) {
      createSession()
      return
    }
    if (activeSessionId.value === id) activeSessionId.value = sessions.value[0].id
    try {
      await deleteChatSession(id)
    } catch {
      // mock 模式不落库，忽略即可
    }
  }

  /** Mock 流式：按 3 字符切片模拟打字机，可被 stop() 中断 */
  function mockStream(text: string, onChunk: (chunk: string) => void): Promise<void> {
    return new Promise((resolve) => {
      const chunks: string[] = []
      for (let i = 0; i < text.length; i += 3) chunks.push(text.slice(i, i + 3))
      let index = 0
      const tick = (): void => {
        if (cancelled || index >= chunks.length) {
          resolve()
          return
        }
        onChunk(chunks[index] ?? '')
        index += 1
        window.setTimeout(tick, 22)
      }
      tick()
    })
  }

  async function send(raw: string, attachments: ChatAttachment[] = []): Promise<void> {
    const text = raw.trim()
    // 只发附件不写字也允许：拍完图直接扔进来是最常见的动作
    if ((!text && !attachments.length) || streaming.value) return

    const session = ensureActive()
    const list = messagesMap[session.id]
    if (!list) return

    const userMessage: ChatMessage = {
      id: uid('m'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      status: 'done',
      attachments: attachments.length ? attachments : undefined,
    }
    // 必须用 reactive 包裹：通过数组取回的是响应式代理，
    // 后续 onToken 里对 reply.content 的增量写入才能触发视图更新
    const reply = reactive<ChatMessage>({
      id: uid('m'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      status: 'streaming',
      replyTo: userMessage.id,
    })
    list.push(userMessage, reply)

    if (session.title === '新的对话') {
      session.title = text.slice(0, 18) || attachments[0]?.name.slice(0, 18) || '新的对话'
    }
    session.updatedAt = Date.now()
    session.messageCount = list.length

    streaming.value = true
    cancelled = false

    try {
      if (USE_MOCK) {
        await mockStream(mockTeacherReply(text, attachments), (chunk) => {
          reply.content += chunk
        })
      } else {
        // 真实环境：附件应先用 POST /api/v1/files 换成 file_id
        await start(
          CHAT_STREAM_URL,
          {
            message: text,
            session_id: session.id,
            stream: true,
            file_ids: attachments.map((a) => a.id),
          },
          { onToken: (token) => (reply.content += token) },
        )
      }
      if (reply.content) {
        reply.status = 'done'
      } else {
        reply.status = 'error'
        reply.error = '未收到模型响应，请稍后重试'
      }
    } catch (error) {
      reply.status = 'error'
      reply.error = error instanceof Error ? error.message : '请求失败，请稍后重试'
    } finally {
      streaming.value = false
      session.updatedAt = Date.now()
      session.messageCount = messagesMap[session.id]?.length ?? 0
    }
  }

  /** 中断当前输出，已生成内容保留 */
  function stop(): void {
    cancelled = true
    abort()
    streaming.value = false
  }

  /** 重新生成：移除最后一轮问答后重发同样的问题（附件一起带上） */
  async function regenerate(): Promise<void> {
    if (streaming.value) return
    const list = messagesMap[activeSessionId.value]
    if (!list?.length) return

    const lastReply = [...list].reverse().find((item) => item.role === 'assistant')
    if (!lastReply?.replyTo) return
    const userMessage = list.find((item) => item.id === lastReply.replyTo)
    if (!userMessage) return

    const text = userMessage.content
    const attachments = userMessage.attachments ?? []
    list.splice(list.indexOf(lastReply), 1)
    list.splice(list.indexOf(userMessage), 1)
    await send(text, attachments)
  }

  function clearCurrent(): void {
    if (streaming.value) stop()
    const list = messagesMap[activeSessionId.value]
    if (list) list.splice(0, list.length)
  }

  return {
    sessions,
    activeSessionId,
    messages,
    activeSession,
    streaming,
    initialized,
    init,
    createSession,
    switchSession,
    removeSession,
    send,
    stop,
    regenerate,
    clearCurrent,
  }
})
