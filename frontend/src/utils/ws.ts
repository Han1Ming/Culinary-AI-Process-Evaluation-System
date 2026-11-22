import { ref } from 'vue'
import type { Ref } from 'vue'

import { WS_BASE_URL } from './env'

/**
 * 可重连 WebSocket
 * ----------------------------------------------------------------------------
 * 甲方要求：WebSocket 支持断线重连、心跳和重复连接清理。
 * 三个问题在演示现场最容易翻车，这里各给一条硬规则：
 *   1. 重复连接：connect() 在 CONNECTING / OPEN 状态下直接返回，不新建 socket；
 *   2. 心跳：每 15s 发 ping，超过 2 个周期没收到任何消息即判定假死并主动断开；
 *   3. 重连：指数退避（1s → 2s → 4s … 上限 15s）+ 抖动，主动 close() 后不再重连。
 *
 * 用法：
 *   const socket = createReconnectingSocket({
 *     path: '/cooking?taskId=...',
 *     onMessage: (event) => { ... },
 *     onStatus: (status) => { statusText.value = status },
 *   })
 *   socket.connect()
 *   onBeforeUnmount(() => socket.close())
 */

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface SocketStatusMeta {
  /** 当前第几次重连，0 表示首次连接 */
  retry: number
  /** 最近一次失败原因，便于页面给出「服务暂不可用」而非编造数据 */
  error?: string
}

export interface ReconnectingSocketOptions {
  /** 相对路径，如 '/cooking'；也接受完整 ws(s):// 地址 */
  path: string
  onMessage?: (data: unknown, raw: MessageEvent) => void
  onStatus?: (status: SocketStatus, meta: SocketStatusMeta) => void
  /** 心跳间隔，默认 15000ms；传 0 关闭心跳 */
  heartbeatMs?: number
  /** 最大重连次数，默认 8；超过后停在 closed */
  maxRetries?: number
}

export interface ReconnectingSocket {
  status: Ref<SocketStatus>
  connect: () => void
  send: (payload: unknown) => boolean
  close: () => void
}

function resolveUrl(path: string): string {
  if (/^wss?:\/\//i.test(path)) return path
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base = WS_BASE_URL.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${protocol}//${window.location.host}${base}${suffix}`
}

export function createReconnectingSocket(options: ReconnectingSocketOptions): ReconnectingSocket {
  const { path, onMessage, onStatus, heartbeatMs = 15000, maxRetries = 8 } = options

  const status = ref<SocketStatus>('idle')
  let socket: WebSocket | null = null
  let retry = 0
  let manualClosed = false
  let retryTimer: number | null = null
  let heartbeatTimer: number | null = null
  let pongTimer: number | null = null

  function setStatus(next: SocketStatus, error?: string): void {
    status.value = next
    onStatus?.(next, { retry, error })
  }

  function clearTimers(): void {
    if (retryTimer !== null) window.clearTimeout(retryTimer)
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer)
    if (pongTimer !== null) window.clearTimeout(pongTimer)
    retryTimer = null
    heartbeatTimer = null
    pongTimer = null
  }

  /** 假死检测：发出 ping 后 2 个周期内没收到任何帧，就按断线处理 */
  function armPongTimer(): void {
    if (pongTimer !== null) window.clearTimeout(pongTimer)
    if (!heartbeatMs) return
    pongTimer = window.setTimeout(() => {
      socket?.close()
    }, heartbeatMs * 2)
  }

  function startHeartbeat(): void {
    if (!heartbeatMs) return
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer)
    heartbeatTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
        armPongTimer()
      }
    }, heartbeatMs)
    armPongTimer()
  }

  function scheduleReconnect(error?: string): void {
    if (manualClosed) return
    if (retry >= maxRetries) {
      setStatus('closed', error ?? `重连 ${maxRetries} 次仍失败`)
      return
    }
    retry += 1
    setStatus('reconnecting', error)
    const delay = Math.min(1000 * 2 ** (retry - 1), 15000) + Math.round(Math.random() * 400)
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      open()
    }, delay)
  }

  function open(): void {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      return
    }

    manualClosed = false
    setStatus(retry > 0 ? 'reconnecting' : 'connecting')

    try {
      socket = new WebSocket(resolveUrl(path))
    } catch (error) {
      scheduleReconnect(error instanceof Error ? error.message : '无法建立连接')
      return
    }

    socket.onopen = () => {
      retry = 0
      setStatus('open')
      startHeartbeat()
    }

    socket.onmessage = (event) => {
      // 任何消息都说明链路是活的，重置假死计时
      armPongTimer()
      let data: unknown = event.data
      try {
        data = JSON.parse(String(event.data))
      } catch {
        // 非 JSON 帧按原样交给业务层（如后端直接推文本）
      }
      onMessage?.(data, event)
    }

    socket.onerror = () => {
      // onerror 后浏览器一定跟一个 onclose，重连交给 onclose，避免重复排程
      setStatus('reconnecting', '连接异常')
    }

    socket.onclose = (event) => {
      socket = null
      clearTimers()
      if (manualClosed) {
        setStatus('closed')
        return
      }
      scheduleReconnect(event.reason || '连接已断开')
    }
  }

  function connect(): void {
    manualClosed = false
    retry = 0
    open()
  }

  function send(payload: unknown): boolean {
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return true
  }

  function close(): void {
    manualClosed = true
    clearTimers()
    if (socket) {
      socket.onclose = null
      socket.close(1000, 'client closed')
      socket = null
    }
    setStatus('closed')
  }

  return { status, connect, send, close }
}
