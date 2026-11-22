import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { DEFAULT_VOICE_CONFIG, type VoiceConfig } from '@/types/voice'

/**
 * 语音播报
 * ----------------------------------------------------------------------------
 * 独立 store，不引用 WS、不引用媒体流、不依赖看板接口是否成功。
 * 三类调用方：
 *   1. 烹饪模块 —— 事件到达时 speak()（事件从 WS 来，但播报只认「有没有事件」）；
 *   2. 页头/设置面板 —— configure() 改开关与音量，立即持久化到 localStorage；
 *   3. 事后补播 —— 教师手动点某条事件「再播一遍」。
 *
 * 为什么本地也存一份配置：
 * 服务端保存是为了多设备一致，但「这台工位现在要不要出声」是设备本地属性。
 * 断网、WS 未连、接口 500 都不该让语音变哑——这正是之前「设置保存了但不响」的成因。
 */
const STORAGE_KEY = 'culinary_ai_voice_config'

function readLocal(): VoiceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_VOICE_CONFIG }
    const parsed = JSON.parse(raw) as Partial<VoiceConfig>
    return { ...DEFAULT_VOICE_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_VOICE_CONFIG }
  }
}

/** 选一个中文音色；没有中文就用系统默认，不要因此判「不支持」 */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith('zh')) ?? null
}

export const useSpeechStore = defineStore('speech', () => {
  const supported = ref(
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  )
  const config = ref<VoiceConfig>(readLocal())
  /** 浏览器要求播报前有过用户手势，否则会被静默丢弃 */
  const unlocked = ref(false)
  const speaking = ref(false)
  const lastText = ref('')

  const statusText = computed(() => {
    if (!supported.value) return '当前浏览器不支持语音播报'
    if (!config.value.enabled) return '语音播报已关闭'
    // 开关是开着的事实要写在前面。以前这句写成「点击页面任意位置后开始播报」，
    // 读起来像功能没启用——教师第一眼就会以为坏了。
    if (!unlocked.value) return '已开启 · 首次播报前请点击页面一次'
    return '语音播报已开启'
  })

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
    } catch {
      // 隐私模式下 localStorage 可能只读，播报本身不受影响，不必打扰用户
    }
  }

  function configure(patch: Partial<VoiceConfig>): void {
    config.value = { ...config.value, ...patch }
    persist()
  }

  /** 首个用户手势调用一次；重复调用无副作用 */
  function unlock(): void {
    if (unlocked.value || !supported.value) return
    unlocked.value = true
  }

  /**
   * 播报。返回是否真的发出去了，调用方可据此给按钮状态。
   * severity 缺省视为 info：strategy=critical 时只有 critical 会响。
   */
  function speak(
    text: string,
    options: { severity?: 'info' | 'warning' | 'critical'; station?: string } = {},
  ): boolean {
    if (!supported.value || !config.value.enabled) return false
    if (config.value.strategy === 'none') return false
    const severity = options.severity ?? 'info'
    if (config.value.strategy === 'critical' && severity !== 'critical') return false

    const station = options.station ?? config.value.station
    const prefix = config.value.announceStation && station ? `${station} 号工位` : ''
    const sentence = [prefix, text].filter(Boolean).join('，')

    const utterance = new SpeechSynthesisUtterance(sentence)
    utterance.lang = 'zh-CN'
    utterance.volume = Math.min(1, Math.max(0, config.value.volume / 100))
    utterance.rate = config.value.rate ?? 1
    const voice = pickChineseVoice()
    if (voice) utterance.voice = voice

    utterance.onstart = () => (speaking.value = true)
    utterance.onend = () => (speaking.value = false)
    utterance.onerror = () => (speaking.value = false)

    // 只播最新一条：实训现场同时来三条告警时，排队念完已经过时了
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    lastText.value = sentence
    return true
  }

  function stop(): void {
    if (!supported.value) return
    window.speechSynthesis.cancel()
    speaking.value = false
  }

  /** 试听：设置面板里验证音量与音色，固定按 info 播，不受 strategy 限制 */
  function preview(): boolean {
    if (!supported.value) return false
    const saved = config.value.strategy
    config.value.strategy = 'all'
    const ok = speak('语音播报已就绪，这是一条试听')
    config.value.strategy = saved
    return ok
  }

  return {
    supported,
    config,
    unlocked,
    speaking,
    lastText,
    statusText,
    configure,
    unlock,
    speak,
    stop,
    preview,
  }
})
