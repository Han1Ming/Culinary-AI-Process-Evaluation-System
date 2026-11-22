/**
 * 烹饪过程 Mock
 * ----------------------------------------------------------------------------
 * 四路通道刻意配了四种状态（在线 / 在线 / 连接中 / 播放失败）：
 * 演示时讲师能直接讲「断流时页面是什么样」，而不是四格全是完美画面。
 * 六个步骤里放了「待复核」「进行中」「未开始」三种，事件里有跳步与超时。
 */
import wok from '@/assets/images/wok-frying.jpg'
import prep from '@/assets/images/prep-cutting.jpg'
import type { CameraChannel, CookingEvent, CookingStep } from '@/types/cooking'

const NOW = '2026-11-21T08:56:20'
const COURSE = '《中式热菜制作》—— 糖醋里脊'

export const mockCourseLabel = COURSE

export const mockChannels: CameraChannel[] = [
  {
    id: 'cam_01',
    name: '工位 02 · 正前方',
    station: '02',
    status: 'online',
    fps: 25,
    latency: 180,
    updatedAt: NOW,
  },
  {
    id: 'cam_02',
    name: '工位 02 · 俯拍砧板',
    station: '02',
    status: 'online',
    fps: 24,
    latency: 210,
    updatedAt: NOW,
  },
  {
    id: 'cam_03',
    name: '工位 02 · 侧方',
    station: '02',
    status: 'connecting',
    updatedAt: '2026-11-21T08:56:02',
  },
  {
    id: 'cam_04',
    name: '工位 02 · 灶台',
    station: '02',
    status: 'failed',
    updatedAt: '2026-11-21T08:51:47',
  },
]

export const mockSteps: CookingStep[] = [
  {
    key: 'prep',
    name: '备菜',
    standard: 300,
    startAt: '2026-11-21T08:21:03',
    endAt: '2026-11-21T08:47:12',
    duration: 1569,
    status: 'done',
    confidence: 0.94,
    updatedAt: '2026-11-21T08:47:12',
  },
  {
    key: 'blanch',
    name: '焯水',
    standard: 90,
    startAt: '2026-11-21T08:48:05',
    endAt: '2026-11-21T08:49:31',
    duration: 86,
    status: 'done',
    confidence: 0.91,
    updatedAt: '2026-11-21T08:49:31',
  },
  {
    key: 'heat',
    name: '烧干锅',
    standard: 40,
    startAt: '2026-11-21T08:50:02',
    endAt: '2026-11-21T08:50:29',
    duration: 27,
    status: 'abnormal',
    confidence: 0.72,
    updatedAt: '2026-11-21T08:50:29',
  },
  {
    key: 'oil',
    name: '加油润锅',
    standard: 30,
    startAt: '2026-11-21T08:50:31',
    endAt: '2026-11-21T08:51:02',
    duration: 31,
    status: 'review',
    confidence: 0.62,
    updatedAt: '2026-11-21T08:51:02',
  },
  {
    key: 'stir',
    name: '翻炒',
    standard: 240,
    startAt: '2026-11-21T08:51:10',
    status: 'running',
    confidence: 0.88,
    updatedAt: NOW,
  },
  {
    key: 'plate',
    name: '装盘',
    standard: 60,
    status: 'pending',
  },
]

export const mockEvents: CookingEvent[] = [
  {
    id: 'ev_01',
    stepKey: 'heat',
    stepName: '烧干锅',
    type: 'skip',
    severity: 'danger',
    title: '疑似跳步：锅未烧干直接下油',
    description: '08:50:31 检测到倒油动作，但锅体温度曲线未出现空烧段，判定为未完成烧干锅。',
    at: '2026-11-21T08:50:31',
    camera: 'cam_01',
    confidence: 0.72,
    snapshot: wok,
    acknowledged: false,
  },
  {
    id: 'ev_02',
    stepKey: 'oil',
    stepName: '加油润锅',
    type: 'timeout',
    severity: 'warning',
    title: '润锅时长低于标准',
    description: '本步持续 31s，标准 30s，边界值；但画面遮挡导致置信度仅 0.62，建议教师复核。',
    at: '2026-11-21T08:51:02',
    camera: 'cam_02',
    confidence: 0.62,
    snapshot: prep,
    acknowledged: false,
  },
  {
    id: 'ev_03',
    stepKey: 'stir',
    stepName: '翻炒',
    type: 'order',
    severity: 'warning',
    title: '顺序异常：先下配料后下主料',
    description: '配料入锅时间早于主料 12s，与课程标准顺序不符。',
    at: '2026-11-21T08:53:40',
    camera: 'cam_01',
    confidence: 0.86,
    snapshot: wok,
    acknowledged: false,
  },
  {
    id: 'ev_04',
    stepKey: 'stir',
    stepName: '翻炒',
    type: 'anomaly',
    severity: 'danger',
    title: '工位无人超过 3 分钟',
    description: '08:53:00–08:56:10 画面内未检测到人体，灶台仍处于加热状态。',
    at: '2026-11-21T08:56:10',
    camera: 'cam_01',
    confidence: 0.95,
    snapshot: wok,
    acknowledged: false,
  },
  {
    id: 'ev_05',
    stepKey: 'stir',
    stepName: '翻炒',
    type: 'step',
    severity: 'info',
    title: '进入翻炒环节',
    description: '识别到连续翻锅动作，自动切分至翻炒步骤。',
    at: '2026-11-21T08:51:10',
    camera: 'cam_01',
    confidence: 0.88,
    snapshot: wok,
    acknowledged: true,
    handledBy: '系统',
    handledAt: '2026-11-21T08:51:10',
    handleNote: '自动确认，无需教师处理',
  },
  {
    id: 'ev_06',
    stepKey: 'blanch',
    stepName: '焯水',
    type: 'timeout',
    severity: 'warning',
    title: '焯水时长偏短',
    description: '实际 86s，标准 90s，偏差在容差内，仅记录不扣分。',
    at: '2026-11-21T08:49:31',
    camera: 'cam_02',
    confidence: 0.91,
    acknowledged: true,
    handledBy: '陈立群',
    handledAt: '2026-11-21T09:02:11',
    handleNote: '偏差在容差内，确认通过',
  },
]

/** 摄像头与工位重新绑定：真实环境写回后端，并记一条设备操作日志 */
export function bindChannelMock(channelId: string, patch: Partial<CameraChannel>): CameraChannel | null {
  const channel = mockChannels.find((item) => item.id === channelId)
  if (!channel) return null
  Object.assign(channel, patch)
  return { ...channel }
}

/** 教师确认事件：记录处理人、时间与说明，事件不再计入待处理 */
export function ackEventMock(id: string, note: string, by: string): CookingEvent | null {
  const event = mockEvents.find((item) => item.id === id)
  if (!event) return null
  event.acknowledged = true
  event.handledBy = by
  event.handledAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  event.handleNote = note
  return { ...event }
}

/** 教师修正步骤结果（确认 / 驳回 / 改判） */
export function reviewStepMock(key: string, status: CookingStep['status'], note: string): CookingStep | null {
  const step = mockSteps.find((item) => item.key === key)
  if (!step) return null
  step.status = status
  step.updatedAt = new Date().toISOString()
  const event: CookingEvent = {
    id: `ev_review_${Date.now()}`,
    stepKey: step.key,
    stepName: step.name,
    type: 'anomaly',
    severity: 'info',
    title: `教师修正：${step.name} → ${status === 'done' ? '已完成' : status === 'abnormal' ? '异常' : '待复核'}`,
    description: note,
    at: step.updatedAt,
    camera: '—',
    snapshot: undefined,
    acknowledged: true,
    handledBy: '陈立群',
    handledAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    handleNote: note,
  }
  mockEvents.unshift(event)
  return { ...step }
}
