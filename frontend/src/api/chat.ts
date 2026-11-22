import { http } from '@/utils/request'
import { API_BASE_URL, USE_MOCK } from '@/utils/env'
import { mockChatSessions, mockDelay } from '@/mock'
import type { ChatSession } from '@/types'

/**
 * 智能 AI 老师接口（流式问答 + 附件）
 * 流式对话不走 axios，由 composables/useSSE 直接 fetch 该地址
 * 后端约定：POST /api/v1/chat，Content-Type: text/event-stream
 */
export const CHAT_STREAM_URL = `${API_BASE_URL}/chat`

/** 会话列表 GET /v1/chat/sessions */
export async function fetchChatSessions(): Promise<ChatSession[]> {
  if (USE_MOCK) {
    await mockDelay(200)
    return [...mockChatSessions]
  }
  return http.get<ChatSession[]>('/chat/sessions')
}

/** 删除会话 DELETE /v1/chat/sessions/{id} */
export async function deleteChatSession(id: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(150)
    return
  }
  await http.delete<null>(`/chat/sessions/${id}`)
}
