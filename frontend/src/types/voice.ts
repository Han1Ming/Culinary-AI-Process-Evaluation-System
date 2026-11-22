/**
 * 语音播报（与 WS、媒体流完全独立）
 * ----------------------------------------------------------------------------
 * 三条边界，之前混在一起才导致「设置保存了但不响」：
 *   1. 配置读取：独立接口 GET /voice/config，不再挂在 /cooking 的看板接口里
 *      ——否则 WS 一断，整页数据取不到，连开关都是空的；
 *   2. 触发条件：由「事件到达」决定，与 WS 是否 connected 无关。
 *      断线时前端本来就没有新事件，不该出现「断线所以不播」这种耦合；
 *   3. 播放：走浏览器 SpeechSynthesis，不依赖任何媒体流轨道。
 *
 * 浏览器自动播放策略：speechSynthesis 在用户手势之前会被静默丢弃，
 * 所以页面挂载后要等第一次点击/按键时解锁（见 stores/speech.ts 的 unlock）。
 */

export type VoiceStrategy = 'critical' | 'all' | 'none'

export const VOICE_STRATEGY_LABEL: Record<VoiceStrategy, string> = {
  critical: '仅严重事件',
  all: '全部事件',
  none: '仅记录不播报',
}

export interface VoiceConfig {
  enabled: boolean
  /** 0-100，映射到 SpeechSynthesisUtterance.volume */
  volume: number
  strategy: VoiceStrategy
  /** 播报前加「2 号工位」，多工位同时播报时学生才分得清 */
  announceStation: boolean
  /** 本设备的工位号，来自设备绑定 */
  station: string
  /** 语速，0.5~1.5，默认 1 */
  rate?: number
  updatedAt?: string
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: true,
  volume: 70,
  strategy: 'critical',
  announceStation: true,
  station: '',
  rate: 1,
}
