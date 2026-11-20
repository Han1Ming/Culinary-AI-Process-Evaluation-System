/** 智能 AI 老师相关类型 */

export type ChatRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'streaming' | 'done' | 'error'

/** 附件类型：图片走视觉模型，PDF 走文档解析，其余按纯文本附件处理 */
export type AttachmentKind = 'image' | 'pdf' | 'file'

export interface ChatAttachment {
  id: string
  name: string
  /** 字节数，用于展示与后端体积校验 */
  size: number
  kind: AttachmentKind
  mime: string
  /**
   * 本地预览地址（URL.createObjectURL）。只用于发出去之前的缩略图，
   * 真实上传成功后换成后端返回的 URL。会话切换后不保证还有效。
   */
  previewUrl?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  status: MessageStatus
  /** 失败时的提示文案 */
  error?: string
  /** 该条用户消息对应的助手消息 id，用于「重新生成」 */
  replyTo?: string
  /** 用户消息携带的附件 */
  attachments?: ChatAttachment[]
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: number
  messageCount: number
}

/** POST /api/v1/chat 请求体 */
export interface ChatRequest {
  message: string
  session_id?: string
  stream?: boolean
  /** 已上传文件的 id 列表（先调 POST /api/v1/files 换 id，再随消息发送） */
  file_ids?: string[]
}

/** SSE 事件里可能出现的 JSON 负载（兼容多种后端实现） */
export interface ChatStreamChunk {
  content?: string
  token?: string
  delta?: string
  done?: boolean
  error?: string
  session_id?: string
}
