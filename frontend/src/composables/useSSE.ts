import { getCurrentScope, onScopeDispose, ref } from 'vue'

import { streamSSE, type SSEFrame } from '@/utils/sse'
import type { ChatStreamChunk } from '@/types'

/**
 * useSSE：通用流式请求组合式函数
 * 场景：POST + 自定义请求头 + text/event-stream（EventSource 无法满足）
 * 能力：token 回调、错误状态、主动中断、组件卸载自动释放连接
 */

export interface SSEHandlers {
  /** 每收到一个增量 token 时触发 */
  onToken?: (token: string) => void
  /** 每收到一个完整 SSE 帧时触发（需要自定义事件时使用） */
  onFrame?: (frame: SSEFrame) => void
  onOpen?: (response: Response) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string })?.name === 'AbortError'
}

/**
 * 解析单帧数据：兼容三种后端实现
 * 1. data: 纯文本 token
 * 2. data: {"content": "..."} / {"token": "..."} / {"delta": "..."}
 * 3. data: {"error": "..."}
 */
function extractToken(data: string): string {
  const trimmed = data.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) return data

  try {
    const parsed = JSON.parse(trimmed) as ChatStreamChunk | string
    if (typeof parsed === 'string') return parsed
    if (parsed.error) throw new Error(parsed.error)
    return parsed.content ?? parsed.token ?? parsed.delta ?? ''
  } catch (err) {
    if (err instanceof SyntaxError) return data
    throw err
  }
}

export function useSSE() {
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  let controller: AbortController | null = null

  async function start(url: string, payload: unknown, handlers: SSEHandlers = {}): Promise<void> {
    if (isStreaming.value) return

    controller = new AbortController()
    isStreaming.value = true
    error.value = null

    try {
      await streamSSE({
        url,
        body: payload,
        signal: controller.signal,
        onOpen: handlers.onOpen,
        onFrame: (frame) => {
          // 约定的结束标记，两种写法都兼容
          if (frame.data === '[DONE]' || frame.event === 'done') return
          const token = extractToken(frame.data)
          if (token) handlers.onToken?.(token)
          handlers.onFrame?.(frame)
        },
      })
    } catch (err) {
      // 主动中断不算错误：保留已输出的内容
      if (isAbortError(err)) return
      error.value = err instanceof Error ? err.message : '流式请求失败'
      throw err
    } finally {
      isStreaming.value = false
      controller = null
    }
  }

  function abort(): void {
    controller?.abort()
    controller = null
    isStreaming.value = false
  }

  // 在组件/effect scope 内使用时，卸载自动断开，避免内存泄漏
  if (getCurrentScope()) {
    onScopeDispose(abort)
  }

  return { isStreaming, error, start, abort }
}
