import { authHeaders } from './token'

/**
 * SSE over fetch（POST + 自定义请求头 + ReadableStream 逐块解析）
 * 不使用 EventSource：它只支持 GET、无法携带 Authorization 头、也无法传请求体。
 */

export interface SSEFrame {
  event: string
  data: string
  id: string
}

export interface StreamSSEOptions {
  url: string
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  onOpen?: (response: Response) => void
  onFrame: (frame: SSEFrame) => void
}

export class SSEHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SSEHttpError'
    this.status = status
  }
}

/** 解析单个 SSE 帧：支持 event / data / id 字段与多行 data */
function parseFrame(raw: string): SSEFrame | null {
  if (!raw.trim()) return null

  let event = 'message'
  let id = ''
  const dataLines: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue // 注释帧（心跳）忽略
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') event = value
    else if (field === 'data') dataLines.push(value)
    else if (field === 'id') id = value
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n'), id }
}

/**
 * 发起流式请求并逐帧回调。
 * 返回 Promise，流正常结束时 resolve；HTTP 错误或网络异常时 reject。
 */
export async function streamSSE(options: StreamSSEOptions): Promise<void> {
  const { url, body, headers, signal, onOpen, onFrame } = options

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let detail = `流式请求失败（HTTP ${response.status}）`
    try {
      const text = await response.text()
      if (text) detail = text.slice(0, 200)
    } catch {
      // 忽略读取失败，使用默认提示
    }
    throw new SSEHttpError(response.status, detail)
  }

  onOpen?.(response)

  const contentType = response.headers.get('content-type') ?? ''

  // 后端若暂时返回一次性 JSON（非流式），也要能正常渲染
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text()
    if (text) onFrame({ event: 'message', data: text, id: '' })
    return
  }

  if (!response.body) {
    throw new Error('当前浏览器不支持流式响应（ReadableStream 不可用）')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 以空行分隔帧，可能跨 chunk，需要保留最后一段不完整内容
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      for (const raw of frames) {
        const frame = parseFrame(raw)
        if (frame) onFrame(frame)
      }
    }

    // 流结束前残留的最后一帧
    buffer += decoder.decode()
    const tail = parseFrame(buffer)
    if (tail) onFrame(tail)
  } finally {
    reader.releaseLock()
  }
}
