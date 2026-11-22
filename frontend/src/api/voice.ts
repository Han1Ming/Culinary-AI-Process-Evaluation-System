import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { DEFAULT_VOICE_CONFIG, type VoiceConfig } from '@/types/voice'

/**
 * 语音播报配置（独立资源）
 * ----------------------------------------------------------------------------
 *   GET /voice/config?station=A-02
 *   PUT /voice/config
 *
 * 以前挂在 /cooking 的看板接口里，看板加载失败时连开关都渲染不出来。
 * 现在拆开：配置接口挂了，页面用 localStorage 的本地值继续工作，
 * 只是标注「未同步」，不会导致整个语音功能消失。
 */
let mockConfig: VoiceConfig = { ...DEFAULT_VOICE_CONFIG, station: 'A-02' }

export async function fetchVoiceConfig(station?: string): Promise<VoiceConfig> {
  if (USE_MOCK) {
    await mockDelay(180)
    return { ...mockConfig, station: station || mockConfig.station }
  }
  return http.get<VoiceConfig>('/voice/config', { params: { station } })
}

export async function saveVoiceConfig(config: VoiceConfig): Promise<VoiceConfig> {
  if (USE_MOCK) {
    await mockDelay(220)
    mockConfig = { ...config, updatedAt: new Date().toISOString() }
    return { ...mockConfig }
  }
  return http.put<VoiceConfig>('/voice/config', config)
}
