/**
 * 烹饪过程评价类型
 * ----------------------------------------------------------------------------
 * 四路视频与 AI 事件刻意分开建模：
 *   CameraChannel —— 媒体流状态（在线 / 离线 / 连接中 / 播放失败、帧率、延迟）
 *   CookingStep   —— 六个步骤的状态机（未开始 / 进行中 / 已完成 / 待复核 / 异常）
 *   CookingEvent  —— 事件（跳步、顺序错、超时、异常），带截图与机位
 * 视频走媒体流，事件走 WebSocket/SSE；前端不把「浏览器定时截图」当正式架构。
 */

export type ChannelStatus = 'online' | 'offline' | 'connecting' | 'failed'

export interface CameraChannel {
  id: string
  /** 摄像头名称，如「工位 02 · 正前方」 */
  name: string
  /** 绑定的工位 */
  station: string
  status: ChannelStatus
  /** 后端推送的实时帧率，离线时为 undefined */
  fps?: number
  /** 端到端延迟（毫秒） */
  latency?: number
  /** 最近一次收到画面的时间 */
  updatedAt?: string
  /** 播放地址（HLS / WebRTC）；为空表示尚未接入 */
  url?: string
  /** 是否教师视角的本机演示通道 */
  local?: boolean
}

export type StepStatus = 'pending' | 'running' | 'done' | 'review' | 'abnormal'

export interface CookingStep {
  key: string
  name: string
  /** 标准时长（秒） */
  standard: number
  startAt?: string
  endAt?: string
  /** 实际时长（秒），由后端按起止时间算好 */
  duration?: number
  status: StepStatus
  /** 识别置信度 0~1 */
  confidence?: number
  updatedAt?: string
}

export type EventType = 'step' | 'skip' | 'order' | 'timeout' | 'anomaly'
export type EventSeverity = 'info' | 'warning' | 'danger'

export interface CookingEvent {
  id: string
  stepKey: string
  stepName: string
  type: EventType
  severity: EventSeverity
  title: string
  description: string
  at: string
  /** 机位编号，如 cam_01 */
  camera: string
  /** 识别置信度 */
  confidence?: number
  /** 关键截图 */
  snapshot?: string
  /** 教师是否已确认处理 */
  acknowledged: boolean
  handledBy?: string
  handledAt?: string
  /** 教师处理说明 */
  handleNote?: string
}

export const STEP_STATUS_META: Record<StepStatus, { label: string; tone: 'idle' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: '未开始', tone: 'idle' },
  running: { label: '进行中', tone: 'primary' },
  done: { label: '已完成', tone: 'success' },
  review: { label: '待复核', tone: 'warning' },
  abnormal: { label: '异常', tone: 'danger' },
}

export const CHANNEL_STATUS_META: Record<ChannelStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'idle' }> = {
  online: { label: '在线', tone: 'success' },
  offline: { label: '离线', tone: 'idle' },
  connecting: { label: '连接中', tone: 'warning' },
  failed: { label: '播放失败', tone: 'danger' },
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  step: '步骤变更',
  skip: '步骤遗漏',
  order: '顺序异常',
  timeout: '超时',
  anomaly: '现场异常',
}

export const SEVERITY_META: Record<EventSeverity, { label: string; tone: 'idle' | 'warning' | 'danger' }> = {
  info: { label: '提示', tone: 'idle' },
  warning: { label: '警告', tone: 'warning' },
  danger: { label: '严重', tone: 'danger' },
}

/** 语音播报设置已迁到 types/voice.ts（独立资源，不再属于烹饪看板） */
