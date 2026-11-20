<script setup lang="ts">
/**
 * 烹饪过程评价
 * ----------------------------------------------------------------------------
 * 把「六个步骤」做成一条横向时间轴：每一步有开始时间、结束时间与时长，
 * 四路工位画面并排，哪一路正在哪一步一目了然。
 *
 * 现在只有第一路接真实摄像头，其余三路显示未接入——真实部署时是四路 RTSP，
 * 这里不做假画面，避免演示时看起来像真的在跑四路。
 *
 * 教师视角：一路画面换成被选中学生的录像回放，步骤分段记在这个人名下。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ModuleShell from '@/components/ModuleShell.vue'
import ReviewStage from '@/components/ReviewStage.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useReviewStore } from '@/stores/review'
import { formatDateTime } from '@/utils/format'

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

interface StepState {
  key: string
  name: string
  /** 标准时长（秒），用于判定过快/过慢 */
  standard: number
  startAt: number | null
  endAt: number | null
}

const { videoRef, active, error, start, stop } = useCamera({ facingMode: 'environment' })

const running = ref(false)
const currentStep = ref(0)
const startedAt = ref<number | null>(null)
const now = ref(Date.now())

const steps = ref<StepState[]>([
  { key: 'prep', name: '备菜', standard: 300, startAt: null, endAt: null },
  { key: 'blanch', name: '焯水', standard: 90, startAt: null, endAt: null },
  { key: 'heat', name: '烧干锅', standard: 40, startAt: null, endAt: null },
  { key: 'oil', name: '加油润锅', standard: 30, startAt: null, endAt: null },
  { key: 'stir', name: '翻炒', standard: 240, startAt: null, endAt: null },
  { key: 'plate', name: '装盘', standard: 60, startAt: null, endAt: null },
])

let tick: number | undefined

const durationOf = (step: StepState): number => {
  if (!step.startAt) return 0
  const end = step.endAt ?? now.value
  return Math.round((end - step.startAt) / 1000)
}

/** 判定：与标准时长偏差超过 ±40% 记异常 */
const judge = (step: StepState): 'ok' | 'fast' | 'slow' | 'idle' => {
  const d = durationOf(step)
  if (!d) return 'idle'
  if (d < step.standard * 0.6) return 'fast'
  if (d > step.standard * 1.4) return 'slow'
  return 'ok'
}

const finished = computed(() => steps.value.filter((s) => s.endAt).length)
const totalDuration = computed(() => {
  if (!startedAt.value) return 0
  const end = steps.value.at(-1)?.endAt ?? now.value
  return Math.round((end - startedAt.value) / 1000)
})

function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function toggle(): Promise<void> {
  if (running.value) {
    running.value = false
    window.clearInterval(tick)
    if (!isReviewing.value) stop()
    return
  }

  // 教师视角不开摄像头：分段来自被选中学生的录像
  if (!isReviewing.value) {
    const ok = await start()
    if (!ok) return
  }

  running.value = true
  currentStep.value = 0
  startedAt.value = Date.now()
  steps.value = steps.value.map((s) => ({ ...s, startAt: null, endAt: null }))
  steps.value[0].startAt = Date.now()

  tick = window.setInterval(() => {
    now.value = Date.now()
    // 演示用：每 12 秒推进一个步骤；真实环境由后端推送分段结果
    const elapsed = (now.value - (steps.value[currentStep.value].startAt ?? now.value)) / 1000
    if (elapsed > 12 && currentStep.value < steps.value.length - 1) {
      steps.value[currentStep.value].endAt = now.value
      currentStep.value += 1
      steps.value[currentStep.value].startAt = now.value
    }
  }, 1000)
}

/** 换人时清空分段：上一个学生的步骤时间轴不能挂在新学生名下 */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    running.value = false
    window.clearInterval(tick)
    steps.value = steps.value.map((s) => ({ ...s, startAt: null, endAt: null }))
    startedAt.value = null
    currentStep.value = 0
  },
)

onBeforeUnmount(() => window.clearInterval(tick))

const endpoints = [
  {
    name: '实时推流',
    method: 'WS' as const,
    path: '/ws/cooking',
    note: '前端按工位建立 WebSocket，后端推送步骤变化事件；四路各自一条连接。',
    request: `{
  "action": "subscribe",
  "task_id": "task_20261120_01",
  "stations": ["cam_01", "cam_02", "cam_03", "cam_04"]
}`,
    response: `{
  "event": "step_change",
  "station": "cam_01",
  "step": "stir",
  "start_at": "2026-11-20T09:02:11",
  "prev_end_at": "2026-11-20T08:58:40",
  "confidence": 0.93
}`,
  },
  {
    name: '任务分段',
    method: 'GET' as const,
    path: '/api/modules/cooking/segments',
    note: '课后查询某一任务的完整分段，用于成绩核算与回放定位。',
    request: `{
  "task_id": "task_20261120_01",
  "student_id": 1001
}`,
    response: `{
  "code": 0,
  "data": {
    "segments": [
      {
        "step": "prep",
        "name": "备菜",
        "start_at": "2026-11-20T08:21:03",
        "end_at": "2026-11-20T08:47:12",
        "duration": 1569,
        "status": "ok"
      }
    ],
    "total": 5400
  },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="烹饪过程评价"
    subtitle="六步骤自动分段，记录每一步的起止时间与时长"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button :type="running ? 'default' : 'primary'" @click="toggle">
        {{ running ? '结束本课' : isReviewing ? '记录该生本课' : '开始记录' }}
      </el-button>
    </template>

    <!-- 四路画面 -->
    <section class="app-card cams">
      <header class="card-head">
        <h2>工位画面</h2>
        <span class="card-head__hint">
          {{ isReviewing ? `${target.name} · 工位 ${target.seat}` : '4 路 · 1080P · 15fps 抽帧' }}
        </span>
      </header>

      <div class="cam-grid">
        <div class="cam" :class="{ 'is-live': active || isReviewing }">
          <ReviewStage
            v-if="isReviewing"
            :student="target"
            compact
            :controls="false"
            :channel="`工位 ${target.seat}`"
          />
          <template v-else>
            <video ref="videoRef" class="cam__video" muted playsinline />
            <div v-if="!active" class="cam__idle">{{ error || '通道 01 未接入' }}</div>
          </template>
          <span class="cam__tag">01 · {{ isReviewing ? target.name : '工位 A3' }}</span>
          <span v-if="running" class="cam__badge">识别中</span>
        </div>

        <div v-for="n in [2, 3, 4]" :key="n" class="cam">
          <div class="cam__idle">通道 0{{ n }} 未接入</div>
          <span class="cam__tag">
            0{{ n }} · {{ isReviewing ? '同一工位其他机位' : `工位 ${['A4', 'B1', 'B2'][n - 2]}` }}
          </span>
        </div>
      </div>
    </section>

    <!-- 时间轴 -->
    <section class="app-card">
      <header class="card-head">
        <h2>步骤分段</h2>
        <span class="card-head__hint">
          {{ finished }} / {{ steps.length }} 已完成 · 总时长 {{ mmss(totalDuration) }}
        </span>
      </header>

      <ol class="steps-track">
        <li
          v-for="(step, i) in steps"
          :key="step.key"
          class="step"
          :class="{
            'is-done': !!step.endAt,
            'is-current': running && i === currentStep,
          }"
        >
          <div class="step__line" aria-hidden="true" />
          <span class="step__dot" aria-hidden="true" />
          <p class="step__name">{{ step.name }}</p>
          <p class="step__time num">
            {{ step.startAt ? formatDateTime(new Date(step.startAt).toISOString(), 'HH:mm:ss') : '—' }}
          </p>
          <p class="step__dur num">{{ durationOf(step) ? mmss(durationOf(step)) : '—' }}</p>
        </li>
      </ol>

      <table class="step-table">
        <thead>
          <tr>
            <th scope="col">步骤</th>
            <th scope="col">开始</th>
            <th scope="col">结束</th>
            <th scope="col">时长</th>
            <th scope="col">标准</th>
            <th scope="col">判定</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="step in steps" :key="step.key">
            <td>{{ step.name }}</td>
            <td class="num">
              {{ step.startAt ? formatDateTime(new Date(step.startAt).toISOString(), 'HH:mm:ss') : '—' }}
            </td>
            <td class="num">
              {{ step.endAt ? formatDateTime(new Date(step.endAt).toISOString(), 'HH:mm:ss') : '—' }}
            </td>
            <td class="num">{{ durationOf(step) ? mmss(durationOf(step)) : '—' }}</td>
            <td class="num">{{ mmss(step.standard) }}</td>
            <td>
              <span class="judge" :data-state="judge(step)">
                {{
                  { idle: '未开始', ok: '正常', fast: '偏快', slow: '偏慢' }[judge(step)]
                }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <TeacherReview
      v-if="can('module.review')"
      module="cooking"
      module-label="烹饪过程"
      :items="reviewItems"
    />
  </ModuleShell>
</template>

<style scoped lang="scss">
.cams {
  padding-bottom: $space-5;
}

.cam-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.cam {
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 50% 45%, #1a1b1f 0%, #0b0c0e 74%);
  border-radius: $radius-md;
  aspect-ratio: 16 / 9;

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__idle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: $font-size-xs;
    color: rgba(255, 255, 255, 0.34);
  }

  &__tag {
    position: absolute;
    bottom: 8px;
    left: 10px;
    font-family: $font-family-mono;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 10px;
    padding: 1px 6px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.86);
    background: rgba(34, 197, 94, 0.22);
    border-radius: 3px;
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
    background: #fff;
    border: 1.5px solid $color-border-strong;
    border-radius: 50%;
    transform: translateX(-50%);
  }

  &.is-done &__dot {
    background: $color-text-primary;
    border-color: $color-text-primary;
  }

  &.is-current &__dot {
    background: $color-primary;
    border-color: $color-primary;
    box-shadow: 0 0 0 4px rgba(47, 84, 235, 0.12);
  }

  &__name {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-secondary;
    text-align: center;
  }

  &.is-current &__name,
  &.is-done &__name {
    color: $color-text-primary;
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

  &.is-current &__dur {
    color: $color-primary;
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

  tr:last-child td {
    border-bottom: 0;
  }
}

.judge {
  font-size: $font-size-xs;
  color: $color-text-placeholder;

  &[data-state='ok'] {
    color: $color-success;
  }

  &[data-state='fast'],
  &[data-state='slow'] {
    color: $color-warning;
  }
}

@media (max-width: 1280px) {
  .cam-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .step__time,
  .step__dur {
    text-align: left;
  }

  .step-table {
    display: none;
  }
}
</style>
