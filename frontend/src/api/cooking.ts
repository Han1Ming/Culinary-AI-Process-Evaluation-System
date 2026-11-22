import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import {
  ackEventMock,
  bindChannelMock,
  mockChannels,
  mockEvents,
  mockSteps,
  reviewStepMock,
} from '@/mock/cooking'
import type { CameraChannel, CookingEvent, CookingStep, StepStatus } from '@/types/cooking'

/**
 * 烹饪过程接口
 * ----------------------------------------------------------------------------
 *   GET  /cooking/board?taskId=&studentId=   四路通道 + 六步骤 + 事件
 *   POST /cooking/events/{id}/ack            教师确认异常事件（带说明）
 *   POST /cooking/steps/{key}/review         教师修正步骤结果
 *   PUT  /cooking/channels/{id}              摄像头与工位绑定
 *
 * 语音播报不在这里：它是独立资源（api/voice.ts），与看板加载、WS 连接都无关。
 * 以前把它塞进看板返回体，看板一失败连开关都没有，是「设置保存了但不响」的根因之一。
 *
 * 实时变化走 WebSocket /ws/cooking（见 utils/ws.ts），这里只负责首屏快照与写操作。
 */

export interface CookingBoard {
  taskId: string
  courseTitle: string
  studentName: string
  channels: CameraChannel[]
  steps: CookingStep[]
  events: CookingEvent[]
}

export async function fetchCookingBoard(studentId: number): Promise<CookingBoard> {
  if (USE_MOCK) {
    await mockDelay(320)
    return {
      taskId: 'task_20261121_01',
      courseTitle: '《中式热菜制作》—— 糖醋里脊',
      studentName: '陈子豪',
      channels: mockChannels.map((item) => ({ ...item })),
      steps: mockSteps.map((item) => ({ ...item })),
      events: mockEvents.map((item) => ({ ...item })),
    }
  }
  return http.get<CookingBoard>('/cooking/board', { studentId })
}

export async function ackCookingEvent(id: string, note: string): Promise<CookingEvent> {
  if (USE_MOCK) {
    await mockDelay(300)
    const event = ackEventMock(id, note, '陈立群')
    if (!event) throw new Error('事件不存在或已被处理')
    return event
  }
  return http.post<CookingEvent>(`/cooking/events/${id}/ack`, { note })
}

export async function reviewCookingStep(
  key: string,
  status: StepStatus,
  note: string,
): Promise<CookingStep> {
  if (USE_MOCK) {
    await mockDelay(320)
    const step = reviewStepMock(key, status, note)
    if (!step) throw new Error('步骤不存在')
    return step
  }
  return http.post<CookingStep>(`/cooking/steps/${key}/review`, { status, note })
}

export async function bindCookingChannel(
  id: string,
  patch: Pick<CameraChannel, 'name' | 'station'>,
): Promise<CameraChannel> {
  if (USE_MOCK) {
    await mockDelay(300)
    const channel = bindChannelMock(id, patch)
    if (!channel) throw new Error('摄像头不存在')
    return channel
  }
  return http.put<CameraChannel>(`/cooking/channels/${id}`, patch)
}
