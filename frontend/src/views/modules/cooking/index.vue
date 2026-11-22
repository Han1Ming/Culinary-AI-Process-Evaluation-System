<script setup lang="ts">
/**
 * 烹饪过程评价
 * ----------------------------------------------------------------------------
 * 四路画面 + 六步骤时间轴 + 异常事件，三块信息按「先看现场、再看过程、最后处理」
 * 的顺序排。视频走媒体流，事件走 WebSocket——两者不共用一条链路，
 * 断流时事件仍在，事件服务挂了画面也不受影响。
 *
 * 教师视角：通道 01 换成被选中学生的录像回放；步骤与事件都记在这个人名下。
 * 学生视角：通道 01 是本机摄像头预览（明确标注「本机预览，非正式分析流」，
 * 正式部署是四路 RTSP 经后端转 HLS/WebRTC）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import ReviewStage from '@/components/ReviewStage.vue'
import StateView from '@/components/StateView.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { ackCookingEvent, bindCookingChannel, fetchCookingBoard, reviewCookingStep } from '@/api/cooking'
import { fetchVoiceConfig, saveVoiceConfig } from '@/api/voice'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useReviewStore } from '@/stores/review'
import { useSpeechStore } from '@/stores/speech'
import { formatDateTime } from '@/utils/format'
import { USE_MOCK } from '@/utils/env'
import { createReconnectingSocket } from '@/utils/ws'
import type { SocketStatus } from '@/utils/ws'
import {
  CHANNEL_STATUS_META,
  EVENT_TYPE_LABEL,
  SEVERITY_META,
  STEP_STATUS_META,
} from '@/types/cooking'
import { VOICE_STRATEGY_LABEL } from '@/types/voice'
import type { VoiceConfig, VoiceStrategy } from '@/types/voice'
import type {
  CameraChannel,
  CookingEvent,
  CookingStep,
  EventSeverity,
  EventType,
  StepStatus,
} from '@/types/cooking'

import BindChannelDialog from './components/BindChannelDialog.vue'
import EventDrawer from './components/EventDrawer.vue'

const { can } = useRole()
const reviewStore = useReviewStore()

const isReviewing = computed(() => can('module.review'))
const target = computed(() => reviewStore.activeStudent)

/** 过程类违规：跳步、顺序错、超时未处理，机器只报时长，是否扣分由教师定 */
const reviewItems = [
  { label: '跳步：未热锅直接下油', points: 4 },
  { label: '顺序错：先下配料后下主料', points: 3 },
  { label: '超时未出锅', points: 3 },
  { label: '中途离岗超过 3 分钟', points: 5 },
  { label: '砧板生熟混用', points: 6 },
  { label: '尝味未换勺', points: 2 },
]

const { videoRef, active, error: cameraError, start } = useCamera({ facingMode: 'environment' })

const loading = ref(true)
const loadError = ref('')
const channels = ref<CameraChannel[]>([])
const steps = ref<CookingStep[]>([])
const events = ref<CookingEvent[]>([])
const taskLabel = ref('')

/**
 * 语音配置来自独立 store（本地持久化 + 独立接口），
 * 不再跟着 board 走：看板加载失败时开关依然可用，这是「设置保存了但不响」的修复点之一。
 */
const speech = useSpeechStore()
const voiceSynced = ref(true)
const strategyOptions: Array<{ value: VoiceStrategy; label: string }> = (
  Object.entries(VOICE_STRATEGY_LABEL) as Array<[VoiceStrategy, string]>
).map(([value, label]) => ({ value, label }))

/** 事件类型下拉：用数组而不是直接遍历常量，避免模板里做类型断言 */
const typeOptions: Array<{ value: EventType; label: string }> = (
  Object.entries(EVENT_TYPE_LABEL) as Array<[EventType, string]>
).map(([value, label]) => ({ value, label }))

const focusedId = ref('')
const bindVisible = ref(false)
const bindingChannel = ref<CameraChannel | null>(null)
const drawerVisible = ref(false)
const activeEvent = ref<CookingEvent | null>(null)

/** 筛选：严重程度 / 事件类型 / 只看待处理 / 按步骤 */
const severityFilter = ref<EventSeverity | ''>('')
const typeFilter = ref<EventType | ''>('')
const pendingOnly = ref(false)
const stepFilter = ref('')

const wsStatus = ref<SocketStatus>('idle')

let socket: ReturnType<typeof createReconnectingSocket> | null = null

const endpoints = [
  {
    name: '过程快照',
    method: 'GET' as const,
    path: '/api/v1/cooking/board',
    note: '首屏一次性取四路通道、六步骤与事件；语音配置独立走 /voice/config，本接口失败不影响播报开关。实时增量走 /ws/cooking。',
    request: `GET /api/v1/cooking/board?taskId=task_20261121_01&studentId=1001`,
    response: `{
  "code": 0,
  "data": {
    "channels": [
      { "id": "cam_01", "station": "02", "status": "online", "fps": 25, "latency": 180, "updatedAt": "2026-11-21T08:56:20" },
      { "id": "cam_04", "station": "02", "status": "failed", "updatedAt": "2026-11-21T08:51:47" }
    ],
    "steps": [
      { "key": "stir", "name": "翻炒", "standard": 240, "status": "running", "confidence": 0.88 }
    ],
    "events": [
      { "id": "ev_01", "stepKey": "heat", "type": "skip", "severity": "danger", "acknowledged": false }
    ]
  },
  "message": "ok"
}`,
  },
  {
    name: '事件推送',
    method: 'WS' as const,
    path: '/ws/cooking',
    note: '心跳 15s，断线指数退避重连（1s→15s），重复连接自动复用；断线期间页面明确显示「未连接」，不伪造事件。',
    request: `{ "action": "subscribe", "taskId": "task_20261121_01", "channels": ["cam_01","cam_02","cam_03","cam_04"] }`,
    response: `{ "event": "step_change", "step": "stir", "status": "running", "at": "2026-11-21T08:51:10", "confidence": 0.88 }`,
  },
  {
    name: '事件确认',
    method: 'POST' as const,
    path: '/api/v1/cooking/events/{id}/ack',
    note: '教师确认后记录处理人、时间与说明；未确认的事件在待复核数里继续计数。',
    request: `{ "note": "已提醒学生回岗并调小火" }`,
    response: `{ "code": 0, "data": { "id": "ev_01", "acknowledged": true, "handledBy": "陈立群" } }`,
  },
  {
    name: '步骤修正',
    method: 'POST' as const,
    path: '/api/v1/cooking/steps/{key}/review',
    note: '保留 AI 原始判定，另存一条修正记录（人员 / 时间 / 原结果 / 新结果 / 原因）。',
    request: `{ "status": "done", "note": "画面遮挡误判，现场确认锅已烧干" }`,
    response: `{ "code": 0, "data": { "key": "heat", "status": "done" } }`,
  },
  {
    name: '通道绑定',
    method: 'PUT' as const,
    path: '/api/v1/cooking/channels/{id}',
    note: '摄像头与工位绑定变更写设备日志；该接口只改通道，不动语音。',
    request: `PUT /api/v1/cooking/channels/cam_01  { "name": "工位 02 · 正前方", "station": "02" }`,
    response: `{ "code": 0, "message": "ok" }`,
  },
  {
    name: '语音配置',
    method: 'GET' as const,
    path: '/api/v1/voice/config',
    note: '语音播报与 WebSocket、媒体流完全解耦：单独接口读写，按工位生效，前端本地缓存一份（localStorage），断网也能开关。播报触发只取决于事件到达，不依赖 WS 连接状态。',
    request: `GET /api/v1/voice/config?station=A-02`,
    response: `{
  "code": 0,
  "data": {
    "enabled": true,
    "volume": 70,
    "strategy": "critical",
    "announceStation": true,
    "station": "A-02",
    "rate": 1,
    "updatedAt": "2026-11-22T09:12:00"
  },
  "message": "ok"
}`,
  },
  {
    name: '保存语音配置',
    method: 'PUT' as const,
    path: '/api/v1/voice/config',
    note: '按工位保存，播报带工位号避免多工位串线；保存失败时前端仍保留本地设置，并在页面上明确提示「尚未同步到服务器」。',
    request: `{ "enabled": true, "volume": 70, "strategy": "critical", "announceStation": true, "station": "A-02", "rate": 1 }`,
    response: `{ "code": 0, "data": { "station": "A-02", "updatedAt": "2026-11-22T09:12:00" }, "message": "ok" }`,
  },
]

/* ------------------------------ 派生 ------------------------------ */

const onlineCount = computed(() => channels.value.filter((item) => item.status === 'online').length)

const filteredEvents = computed(() =>
  events.value.filter((item) => {
    if (pendingOnly.value && item.acknowledged) return false
    if (severityFilter.value && item.severity !== severityFilter.value) return false
    if (typeFilter.value && item.type !== typeFilter.value) return false
    if (stepFilter.value && item.stepKey !== stepFilter.value) return false
    return true
  }),
)

const pendingCount = computed(() => events.value.filter((item) => !item.acknowledged).length)

const finishedSteps = computed(() => steps.value.filter((item) => item.status === 'done').length)

const wsText = computed(() => {
  if (USE_MOCK) return '事件推送：Mock 模式（本地事件）'
  if (wsStatus.value === 'open') return '事件推送：已连接'
  if (wsStatus.value === 'connecting') return '事件推送：连接中'
  if (wsStatus.value === 'reconnecting') return '事件推送：重连中，事件可能延迟'
  return '事件推送：未连接（不会显示伪造事件）'
})

function mmss(seconds?: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function durationOf(step: CookingStep): number | undefined {
  if (step.duration) return step.duration
  if (!step.startAt) return undefined
  const start = new Date(step.startAt).getTime()
  const end = step.endAt ? new Date(step.endAt).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 1000))
}

/* ------------------------------ 加载 ------------------------------ */

async function load(): Promise<void> {
  loading.value = !channels.value.length
  loadError.value = ''
  // 语音配置单独取、失败不阻塞：它和过程数据没有依赖关系
  const voiceTask = fetchVoiceConfig()
    .then((config) => {
      speech.configure(config)
      voiceSynced.value = true
      return config
    })
    .catch(() => {
      voiceSynced.value = false
      return null
    })

  try {
    const board = await fetchCookingBoard(target.value.id)
    channels.value = board.channels
    steps.value = board.steps
    events.value = board.events
    taskLabel.value = board.courseTitle
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '过程数据加载失败'
  } finally {
    loading.value = false
    await voiceTask
  }
}

/** 实时增量：只认明确的事件名，未知帧忽略，不猜 */
function handleSocketMessage(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const payload = data as Record<string, unknown>
  const name = payload.event ?? payload.type

  if (name === 'step_change' && typeof payload.step === 'string') {
    const step = steps.value.find((item) => item.key === payload.step)
    if (step && typeof payload.status === 'string') {
      step.status = payload.status as StepStatus
      step.updatedAt = typeof payload.at === 'string' ? payload.at : new Date().toISOString()
      if (typeof payload.confidence === 'number') step.confidence = payload.confidence
    }
    return
  }

  if (name === 'anomaly') {
    // 播报只看「有没有事件」，不看 WS 是否还在 connected：事件已经到这儿了就该出声
    const title = typeof payload.title === 'string' ? payload.title : '检测到异常环节，请查看事件列表'
    const severity = (payload.severity as EventSeverity | undefined) ?? 'critical'
    speech.speak(title, { severity })
    void load()
  }
}

onMounted(async () => {
  // 浏览器自动播放策略：第一次点击/按键后才允许 speechSynthesis 出声
  const unlock = (): void => speech.unlock()
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })

  await load()

  if (!USE_MOCK) {
    socket = createReconnectingSocket({
      path: `/cooking?taskId=task_20261121_01`,
      onMessage: handleSocketMessage,
      onStatus: (status) => {
        wsStatus.value = status
      },
    })
    socket.connect()
  }
})

watch(
  () => target.value.id,
  (next, prev) => {
    if (!isReviewing.value || next === prev) return
    focusedId.value = ''
    void load()
  },
)

onBeforeUnmount(() => {
  socket?.close()
})

/* ------------------------------ 通道交互 ------------------------------ */

async function retryChannel(channel: CameraChannel): Promise<void> {
  if (channel.local && !isReviewing.value) {
    const ok = await start()
    if (!ok) ElMessage.error(cameraError.value ?? '摄像头启动失败')
    return
  }
  channel.status = 'connecting'
  // 真实环境由后端重连 RTSP；这里给一次明确的「重连中 → 结果」反馈
  await new Promise((resolve) => setTimeout(resolve, 700))
  channel.status = USE_MOCK ? 'online' : 'failed'
  channel.updatedAt = new Date().toISOString()
  channel.fps = channel.fps ?? 25
  channel.latency = channel.latency ?? 200
  ElMessage[channel.status === 'online' ? 'success' : 'error'](
    channel.status === 'online' ? `${channel.id} 已恢复` : `${channel.id} 仍无法拉流，请联系设备管理员`,
  )
}

function toggleFocus(channel: CameraChannel): void {
  if (channel.status !== 'online') return
  focusedId.value = focusedId.value === channel.id ? '' : channel.id
}

/** 本机预览入口：通道 01 不在线时，学生可以打开自己的摄像头做取景预览 */
function openLocalPreview(): void {
  const first = channels.value[0]
  if (!first) return
  first.local = true
  void retryChannel(first)
}

function openBind(channel: CameraChannel): void {
  bindingChannel.value = channel
  bindVisible.value = true
}

async function saveBind(patch: { name: string; station: string }): Promise<void> {
  const channel = bindingChannel.value
  if (!channel) return
  try {
    const updated = await bindCookingChannel(channel.id, patch)
    Object.assign(channel, updated)
    ElMessage.success(`${channel.id} 已绑定到工位 ${updated.station}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '绑定失败')
  }
}

/* ------------------------------ 事件与步骤 ------------------------------ */

function openEvent(event: CookingEvent): void {
  activeEvent.value = event
  drawerVisible.value = true
}

function filterByStep(step: CookingStep): void {
  stepFilter.value = stepFilter.value === step.key ? '' : step.key
  if (stepFilter.value) pendingOnly.value = false
}

async function handleAck(note: string): Promise<void> {
  const event = activeEvent.value
  if (!event) return
  try {
    const updated = await ackCookingEvent(event.id, note || '已确认')
    Object.assign(event, updated)
    drawerVisible.value = false
    ElMessage.success('事件已确认并记录处理人')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '确认失败')
  }
}

async function handleReview(payload: { status: StepStatus; note: string }): Promise<void> {
  const event = activeEvent.value
  if (!event) return
  try {
    await reviewCookingStep(event.stepKey, payload.status, payload.note)
    drawerVisible.value = false
    await load()
    ElMessage.success('步骤结果已修正，原始判定保留')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '修正失败')
  }
}

/* ------------------------------ 语音 ------------------------------ */

/**
 * 改配置：先落本地（立刻能听到），再由用户决定是否同步到服务端。
 * 拖动音量时每次都发请求既吵又慢，而且断网时会失败——本地先生效才是对的。
 */
function setVoice(patch: Partial<VoiceConfig>): void {
  speech.configure(patch)
  voiceSynced.value = false
}

/** el-radio-group 的 update 值是 string，收口成 VoiceStrategy，模板里不做类型断言 */
function setStrategy(value: unknown): void {
  if (value === 'critical' || value === 'all' || value === 'none') {
    setVoice({ strategy: value })
  }
}

async function persistVoice(): Promise<void> {
  try {
    const saved = await saveVoiceConfig({ ...speech.config })
    speech.configure(saved)
    voiceSynced.value = true
    ElMessage.success('语音设置已保存到服务器')
  } catch (error) {
    // 保存失败不影响本机播报，这是解耦的收益
    ElMessage.warning(
      `服务器同步失败，本机设置仍生效：${error instanceof Error ? error.message : '网络异常'}`,
    )
  }
}

function previewVoice(): void {
  speech.unlock()
  const ok = speech.preview()
  ElMessage[ok ? 'success' : 'warning'](ok ? '已试听，注意本机音量' : speech.statusText)
}

function reconnectSocket(): void {
  socket?.connect()
}
</script>

<template>
  <ModuleShell
    title="烹饪过程评价"
    subtitle="六步骤自动分段，记录起止时间与异常事件"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button @click="load">刷新</el-button>
    </template>

    <p class="ws-line" :class="{ 'is-off': wsStatus !== 'open' && !USE_MOCK }">
      <span class="status-dot" :class="wsStatus === 'open' || USE_MOCK ? 'status-dot--success' : 'status-dot--warning'" />
      {{ wsText }}
      <button
        v-if="!USE_MOCK && wsStatus !== 'open' && wsStatus !== 'connecting'"
        type="button"
        class="ws-line__btn"
        @click="reconnectSocket"
      >
        重连
      </button>
      <span class="ws-line__spacer" />
      <span class="ws-line__meta num">
        {{ taskLabel }} · 在线 {{ onlineCount }} / {{ channels.length }} 路 · 待处理事件 {{ pendingCount }} 条
      </span>
    </p>

    <StateView v-if="loading" state="loading" />
    <StateView v-else-if="loadError" state="error" :description="loadError" @retry="load" />

    <template v-else>
      <!-- 四路画面 -->
      <section class="app-card cams">
        <header class="card-head">
          <h2>工位画面</h2>
          <div class="cams__head-right">
            <span class="card-head__hint">
              {{ isReviewing ? `${target.name} · 工位 ${target.seat}` : '工位 02 · 四机位' }}
            </span>
            <el-button v-if="focusedId" size="small" @click="focusedId = ''">返回四宫格</el-button>
          </div>
        </header>

        <div class="cam-grid" :class="{ 'is-focus': !!focusedId }">
          <article
            v-for="ch in channels"
            :key="ch.id"
            class="cam"
            :class="[
              `is-${ch.status}`,
              { 'is-focused': focusedId === ch.id, 'is-hidden': !!focusedId && focusedId !== ch.id },
            ]"
          >
            <!-- 教师：通道 01 用该生录像回放 -->
            <ReviewStage
              v-if="ch.id === 'cam_01' && isReviewing"
              :student="target"
              compact
              :controls="false"
              :channel="`工位 ${target.seat}`"
            />

            <!-- 学生：通道 01 本机预览 -->
            <template v-else-if="ch.id === 'cam_01' && active">
              <video ref="videoRef" class="cam__video" muted playsinline />
            </template>

            <div v-else-if="ch.id === 'cam_01' && !isReviewing" class="cam__state">
              <p>{{ cameraError || '本机预览未开启' }}</p>
              <span>仅用于取景确认，不作为正式分析流；正式部署为后端转码的四路流</span>
            </div>

            <div v-else class="cam__state">
              <template v-if="ch.status === 'online'">
                <p>已接入媒体流</p>
                <span>浏览器端演示不加载 RTSP；正式环境由后端转 HLS / WebRTC</span>
              </template>
              <template v-else-if="ch.status === 'connecting'">
                <p>正在连接…</p>
                <span>握手阶段，最长等待 8 秒</span>
              </template>
              <template v-else-if="ch.status === 'failed'">
                <p>播放失败</p>
                <span>拉流中断或解码失败，可尝试重连</span>
              </template>
              <template v-else>
                <p>{{ ch.id === 'cam_01' ? cameraError || '通道未接入' : '离线' }}</p>
                <span>检查设备电源与网络后重连</span>
              </template>
            </div>

            <header class="cam__bar">
              <span class="cam__id num">{{ ch.id.replace('cam_', '') }}</span>
              <span class="cam__name">{{ ch.name }}</span>
              <span class="cam__status" :class="`is-${CHANNEL_STATUS_META[ch.status].tone}`">
                <i />
                {{ CHANNEL_STATUS_META[ch.status].label }}
              </span>
            </header>

            <footer class="cam__foot">
              <span class="num">
                {{ ch.status === 'online' ? `${ch.fps ?? '—'} fps · ${ch.latency ?? '—'} ms` : '无信号' }}
                · {{ formatDateTime(ch.updatedAt, 'HH:mm:ss') }}
              </span>
              <span class="cam__actions">
                <button
                  v-if="ch.status === 'online'"
                  type="button"
                  class="cam__act"
                  @click="toggleFocus(ch)"
                >
                  {{ focusedId === ch.id ? '还原' : '放大' }}
                </button>
                <button
                  v-if="ch.status === 'failed' || ch.status === 'offline'"
                  type="button"
                  class="cam__act"
                  @click="retryChannel(ch)"
                >
                  重连
                </button>
                <button v-if="can('module.review')" type="button" class="cam__act" @click="openBind(ch)">
                  绑定
                </button>
              </span>
            </footer>
          </article>
        </div>

        <p v-if="!isReviewing && !active && channels.length" class="cams__hint">
          通道 01 可用本机摄像头预览（仅预览，不作为正式分析流）。正式部署为四路 RTSP 经后端转码。
          <el-button size="small" text type="primary" @click="openLocalPreview">打开本机预览</el-button>
        </p>
      </section>

      <!-- 六步骤 -->
      <section class="app-card">
        <header class="card-head">
          <h2>步骤分段</h2>
          <div class="cams__head-right">
            <span class="card-head__hint">
              {{ finishedSteps }} / {{ steps.length }} 已完成
              <template v-if="stepFilter"> · 已筛「{{ steps.find((s) => s.key === stepFilter)?.name }}」</template>
            </span>
            <el-button v-if="stepFilter" size="small" @click="stepFilter = ''">清除筛选</el-button>
          </div>
        </header>

        <ol class="steps-track">
          <li
            v-for="step in steps"
            :key="step.key"
            class="step"
            :class="[`is-${STEP_STATUS_META[step.status].tone}`]"
            @click="filterByStep(step)"
          >
            <div class="step__line" aria-hidden="true" />
            <span class="step__dot" aria-hidden="true" />
            <p class="step__name">{{ step.name }}</p>
            <span class="step__state">{{ STEP_STATUS_META[step.status].label }}</span>
            <p class="step__time num">
              {{ step.startAt ? formatDateTime(step.startAt, 'HH:mm:ss') : '—' }}
            </p>
            <p class="step__dur num">{{ mmss(durationOf(step)) }}</p>
          </li>
        </ol>

        <table class="step-table">
          <thead>
            <tr>
              <th scope="col">步骤</th>
              <th scope="col">状态</th>
              <th scope="col">开始</th>
              <th scope="col">结束</th>
              <th scope="col">时长 / 标准</th>
              <th scope="col">置信度</th>
              <th scope="col">最近更新</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in steps" :key="step.key" @click="filterByStep(step)">
              <td>{{ step.name }}</td>
              <td>
                <span class="state-tag" :class="`is-${STEP_STATUS_META[step.status].tone}`">
                  {{ STEP_STATUS_META[step.status].label }}
                </span>
              </td>
              <td class="num">{{ step.startAt ? formatDateTime(step.startAt, 'HH:mm:ss') : '—' }}</td>
              <td class="num">{{ step.endAt ? formatDateTime(step.endAt, 'HH:mm:ss') : '—' }}</td>
              <td class="num">{{ mmss(durationOf(step)) }} / {{ mmss(step.standard) }}</td>
              <td class="num">{{ step.confidence ? `${(step.confidence * 100).toFixed(0)}%` : '—' }}</td>
              <td class="num">{{ formatDateTime(step.updatedAt, 'HH:mm:ss') }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 异常事件 + 语音设置 -->
      <section class="app-card events">
        <header class="card-head">
          <h2>异常事件</h2>
          <div class="filters">
            <el-select v-model="severityFilter" size="small" placeholder="全部级别" clearable class="filters__sel">
              <el-option label="严重" value="danger" />
              <el-option label="警告" value="warning" />
              <el-option label="提示" value="info" />
            </el-select>
            <el-select v-model="typeFilter" size="small" placeholder="全部类型" clearable class="filters__sel">
              <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <el-checkbox v-model="pendingOnly" size="small">只看待处理</el-checkbox>
          </div>
        </header>

        <ul v-if="filteredEvents.length" class="ev-list">
          <li v-for="ev in filteredEvents" :key="ev.id" class="ev-row" @click="openEvent(ev)">
            <span class="ev-row__dot" :class="`is-${SEVERITY_META[ev.severity].tone}`" aria-hidden="true" />
            <div class="ev-row__body">
              <p class="ev-row__title">
                {{ ev.title }}
                <span v-if="!ev.acknowledged" class="ev-row__flag">待处理</span>
              </p>
              <span class="ev-row__meta num">
                {{ ev.stepName }} · {{ EVENT_TYPE_LABEL[ev.type] }} · {{ ev.camera }} ·
                {{ formatDateTime(ev.at, 'MM-DD HH:mm:ss') }}
              </span>
            </div>
            <span class="ev-row__conf num">
              {{ ev.confidence ? `${(ev.confidence * 100).toFixed(0)}%` : '—' }}
            </span>
            <el-button text size="small" @click.stop="openEvent(ev)">
              {{ ev.acknowledged ? '查看' : '处理' }}
            </el-button>
          </li>
        </ul>
        <p v-else class="ev-empty">当前筛选下没有事件</p>

        <footer class="voice">
          <div class="voice__main">
            <el-switch
              :model-value="speech.config.enabled"
              size="small"
              @update:model-value="(value) => setVoice({ enabled: Boolean(value) })"
            />
            <span class="voice__label">语音播报</span>
            <el-slider
              :model-value="speech.config.volume"
              :min="0"
              :max="100"
              :step="10"
              size="small"
              :disabled="!speech.config.enabled"
              class="voice__slider"
              @update:model-value="(value) => setVoice({ volume: Number(value) })"
            />
            <span class="voice__value num">{{ speech.config.volume }}</span>
            <el-button size="small" text type="primary" @click="previewVoice">试听</el-button>
            <el-button size="small" text :disabled="voiceSynced" @click="persistVoice">保存</el-button>
          </div>
          <el-radio-group
            :model-value="speech.config.strategy"
            size="small"
            :disabled="!speech.config.enabled"
            @update:model-value="setStrategy"
          >
            <el-radio-button v-for="opt in strategyOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
          <p class="voice__note">
            <span class="voice__state" :class="speech.supported ? 'is-ok' : 'is-bad'">
              {{ speech.statusText }}
            </span>
            <span v-if="!voiceSynced" class="voice__unsync">· 本机已生效，尚未同步到服务器</span>
          </p>
          <p class="voice__note">
            播报内容带工位号（如「2 号工位，检测到跳步」），多工位同时报警不会串线；
            配置存在本机，断网或 WS 未连接时依然生效。
          </p>
        </footer>
      </section>
    </template>

    <TeacherReview
      v-if="can('module.review')"
      module="cooking"
      module-label="烹饪过程"
      :items="reviewItems"
    />

    <EventDrawer
      v-model="drawerVisible"
      :event="activeEvent"
      :can-review="can('module.review')"
      @ack="handleAck"
      @review="handleReview"
    />
    <BindChannelDialog v-model="bindVisible" :channel="bindingChannel" @save="saveBind" />
  </ModuleShell>
</template>

<style scoped lang="scss">
.ws-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 7px 12px;
  margin: 0 0 $space-3;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-md;

  &__btn {
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    color: $color-primary;
    cursor: pointer;
    background: none;
    border: 0;
  }

  &__spacer {
    flex: 1;
  }

  &__meta {
    color: $color-text-placeholder;
  }
}

.cams {
  padding-bottom: $space-5;

  &__head-right {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  &__hint {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.cam-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  &.is-focus {
    grid-template-columns: minmax(0, 1fr);
  }
}

.cam {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  &.is-hidden {
    display: none;
  }

  &.is-focused {
    border-color: $color-border;
  }

  &__video {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  &__state {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    padding: 0 $space-4;
    text-align: center;
    background: radial-gradient(circle at 50% 45%, #1a1b1f 0%, #0b0c0e 74%);

    p {
      margin: 0;
      font-size: $font-size-sm;
      color: rgba(255, 255, 255, 0.78);
    }

    span {
      max-width: 240px;
      font-size: 11px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.38);
    }
  }

  &__bar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px 0;
  }

  &__id {
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &__name {
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-regular;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    margin-left: auto;
    font-size: 10px;
    color: $color-text-secondary;

    i {
      width: 5px;
      height: 5px;
      background: $color-border-strong;
      border-radius: 50%;
    }

    &.is-success i {
      background: $color-success-dot;
    }

    &.is-warning i {
      background: $color-warning-dot;
    }

    &.is-danger i {
      background: $color-danger-dot;
    }
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px 9px;
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__act {
    padding: 0;
    font-family: inherit;
    font-size: 10px;
    color: $color-primary;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      text-decoration: underline;
    }
  }
}

// ---------- 时间轴 ----------
.steps-track {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 0;
  margin: 0 0 $space-5;
  list-style: none;
}

.step {
  position: relative;
  padding-top: 22px;
  cursor: pointer;

  &__line {
    position: absolute;
    top: 5px;
    right: 0;
    left: 0;
    height: 1px;
    background: $color-border-light;
  }

  &:first-child &__line {
    left: 50%;
  }

  &:last-child &__line {
    right: 50%;
  }

  &__dot {
    position: absolute;
    top: 2px;
    left: 50%;
    width: 7px;
    height: 7px;
    background: $color-bg-surface;
    border: 1.5px solid $color-border-strong;
    border-radius: 50%;
    transform: translateX(-50%);
  }

  &.is-success &__dot {
    background: $color-success-dot;
    border-color: $color-success-dot;
  }

  &.is-primary &__dot {
    background: $color-primary;
    border-color: $color-primary;
    box-shadow: 0 0 0 4px rgba(47, 84, 235, 0.12);
  }

  &.is-warning &__dot {
    background: $color-warning-dot;
    border-color: $color-warning-dot;
  }

  &.is-danger &__dot {
    background: $color-danger-dot;
    border-color: $color-danger-dot;
  }

  &__name {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-align: center;
  }

  &__state {
    display: block;
    margin-top: 2px;
    font-size: 10px;
    color: $color-text-placeholder;
    text-align: center;
  }

  &.is-primary &__state {
    color: $color-primary;
  }

  &.is-warning &__state {
    color: $color-warning;
  }

  &.is-danger &__state {
    color: $color-danger;
  }

  &__time {
    margin: 4px 0 0;
    font-size: 10.5px;
    color: $color-text-placeholder;
    text-align: center;
  }

  &__dur {
    margin: 2px 0 0;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-regular;
    text-align: center;
  }
}

.step-table {
  width: 100%;
  font-size: $font-size-sm;
  border-collapse: collapse;

  th {
    padding: 0 0 8px;
    font-size: 11px;
    font-weight: $font-weight-medium;
    color: $color-text-placeholder;
    text-align: left;
    border-bottom: 1px solid $color-border-light;
  }

  td {
    padding: 10px 0;
    color: $color-text-regular;
    border-bottom: 1px solid $color-border-light;
  }

  tbody tr {
    cursor: pointer;

    &:hover td {
      background: $color-bg-hover;
    }
  }

  tr:last-child td {
    border-bottom: 0;
  }
}

.state-tag {
  font-size: 11px;

  &.is-idle {
    color: $color-text-placeholder;
  }

  &.is-primary {
    color: $color-primary;
  }

  &.is-success {
    color: $color-success;
  }

  &.is-warning {
    color: $color-warning;
  }

  &.is-danger {
    color: $color-danger;
  }
}

// ---------- 事件 ----------
.filters {
  display: flex;
  gap: $space-2;
  align-items: center;

  &__sel {
    width: 116px;
  }
}

.ev-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.ev-row {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 10px 0;
  cursor: pointer;
  border-top: 1px solid $color-border-light;

  &:first-child {
    border-top: 0;
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    background: $color-border-strong;
    border-radius: 50%;

    &.is-warning {
      background: $color-warning-dot;
    }

    &.is-danger {
      background: $color-danger-dot;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__flag {
    font-size: 10px;
    color: $color-danger;
  }

  &__meta {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__conf {
    flex-shrink: 0;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.ev-empty {
  padding: $space-5 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

.voice {
  padding-top: $space-4;
  margin-top: $space-4;
  border-top: 1px solid $color-border-light;

  &__main {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__slider {
    width: 140px;
    margin: 0 $space-2;
  }

  &__value {
    width: 24px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  .el-radio-group {
    margin-top: $space-3;
  }

  &__note {
    max-width: 78ch;
    margin: $space-3 0 0;
    font-size: 11px;
    line-height: 1.7;
    color: $color-text-placeholder;
  }

  // 状态行：开启 / 未解锁 / 浏览器不支持，三种情况要一眼分清，
  // 否则用户只会觉得「开关开着但没声音」
  &__state {
    font-weight: $font-weight-medium;

    &.is-ok {
      color: $color-success;
    }

    &.is-bad {
      color: $color-danger;
    }
  }

  &__unsync {
    margin-left: 6px;
    color: $color-warning;
  }
}

@media (max-width: $breakpoint-md) {
  .cam-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .steps-track {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $space-3 0;
  }

  .step__line {
    display: none;
  }

  .step__dot {
    left: 0;
    transform: none;
  }

  .step__name,
  .step__state,
  .step__time,
  .step__dur {
    text-align: left;
  }

  .step-table {
    display: none;
  }
}
</style>
