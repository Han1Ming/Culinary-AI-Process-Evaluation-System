<script setup lang="ts">
/**
 * 食材预处理评价
 * ----------------------------------------------------------------------------
 * 演示重点：把「切配动作」变成一条可读的频率曲线。
 * 每 1.5 秒产生一个采样点，同时更新当前频率、平均频率与切配总数，
 * 后端接上后这些点改由 WS 推送，曲线与指标的计算方式不变。
 *
 * 教师视角下画面换成该生的录像回放，采样点改由「该生这一场的录像」推算，
 * 不再需要本机摄像头——教师不可能同时站在 40 个工位上。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import ReviewStage from '@/components/ReviewStage.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useReviewStore } from '@/stores/review'
import { downloadCsv, safeFilename } from '@/utils/export'
import { formatDateTime } from '@/utils/format'
import prepShot from '@/assets/images/prep-cutting.jpg'

const { can } = useRole()
const reviewStore = useReviewStore()

const isReviewing = computed(() => can('module.review'))
const target = computed(() => reviewStore.activeStudent)
/** 指标归到谁名下 */
const ownerName = computed(() => (isReviewing.value ? target.value.name : '本人'))

/** 规格类违规：机器量得出数字，是否扣分由教师按课程标准定 */
const reviewItems = [
  { label: '成丝粗细不匀（目测超差）', points: 4 },
  { label: '规格不符：非 2mm 见方', points: 3 },
  { label: '未去净筋膜 / 老根', points: 3 },
  { label: '砧板未分生熟', points: 6 },
  { label: '切割时手指未成猫爪状', points: 5 },
  { label: '切配后未及时泡水', points: 2 },
]

const { videoRef, active, error, start, stop } = useCamera({ facingMode: 'environment' })

const running = ref(false)
/** 每秒切丝次数，最近 40 个采样点 */
const samples = ref<number[]>([])
const cuts = ref(0)
const elapsed = ref(0)
let timer: number | undefined

/** 关键帧：每 4 个采样点留一张，点开能对到具体时间 */
interface Keyframe {
  id: string
  /** 相对开始时间的秒数 */
  at: number
  label: string
  image: string
}
const keyframes = ref<Keyframe[]>([])

const current = computed(() => samples.value.at(-1) ?? 0)
const average = computed(() => {
  if (!samples.value.length) return 0
  return samples.value.reduce((a, b) => a + b, 0) / samples.value.length
})
/** 均匀度：用标准差反推，越稳分越高 */
const uniformity = computed(() => {
  if (samples.value.length < 3) return 0
  const avg = average.value
  const variance = samples.value.reduce((sum, v) => sum + (v - avg) ** 2, 0) / samples.value.length
  const cv = Math.sqrt(variance) / (avg || 1)
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)))
})

/**
 * 操作连续性：采样窗口里低于 0.8 次/秒（几乎停手）的比例越低越连续。
 * 这是可观测指标，不是模型臆测——停手就是停手。
 */
const continuity = computed(() => {
  if (samples.value.length < 4) return 0
  const idle = samples.value.filter((value) => value < 0.8).length
  return Math.round((1 - idle / samples.value.length) * 100)
})

/** 成丝规格：抽帧测量的截面尺寸（真实环境由后端返回，前端只展示） */
const spec = computed(() => {
  if (samples.value.length < 3) return null
  const drift = (100 - uniformity.value) / 100
  return {
    thickness: Number((2.6 + drift * 1.6).toFixed(1)),
    length: Math.round(58 + drift * 22),
    standard: 3,
  }
})

/** 等级：与教研组口径一致，三项都写「依据」，不出现无来源的分数 */
const indicators = computed(() => {
  const freq = average.value
  const specDrift = spec.value ? Math.abs(spec.value.thickness - spec.value.standard) / spec.value.standard : 0
  return [
    {
      key: 'freq',
      label: '切配频率',
      value: freq ? `${freq.toFixed(1)} 次/秒` : '—',
      level: !freq ? 'pending' : freq >= 1.8 ? 'good' : freq >= 1.2 ? 'fair' : 'poor',
      basis: '单位时间内的有效切割次数；低于 1.2 次/秒视为节奏过慢',
    },
    {
      key: 'uniform',
      label: '节奏均匀度',
      value: samples.value.length >= 3 ? `${uniformity.value}%` : '—',
      level: !samples.value.length ? 'pending' : uniformity.value >= 80 ? 'good' : uniformity.value >= 65 ? 'fair' : 'poor',
      basis: '窗口内频率的离散程度（变异系数），越稳分越高',
    },
    {
      key: 'spec',
      label: '成丝规格',
      value: spec.value ? `${spec.value.thickness}mm × ${spec.value.length}mm` : '—',
      level: !spec.value ? 'pending' : specDrift <= 0.1 ? 'good' : specDrift <= 0.2 ? 'fair' : 'poor',
      basis: `抽帧测量截面尺寸，课程标准为 ${spec.value?.standard ?? 3}mm 见方`,
    },
    {
      key: 'continuity',
      label: '操作连续性',
      value: samples.value.length >= 4 ? `${continuity.value}%` : '—',
      level: !samples.value.length ? 'pending' : continuity.value >= 85 ? 'good' : continuity.value >= 70 ? 'fair' : 'poor',
      basis: '窗口内出现明显停手（<0.8 次/秒）的比例，反映操作是否连贯',
    },
  ]
})

const LEVEL_LABEL: Record<string, string> = {
  good: '良好',
  fair: '一般',
  poor: '偏弱',
  pending: '未采集',
}

function exportResult(): void {
  if (!samples.value.length) {
    ElMessage.warning('还没有采集到数据，先开始分析')
    return
  }
  downloadCsv(
    safeFilename(`食材预处理-${ownerName.value}`),
    [
      { header: '学生', value: () => ownerName.value },
      { header: '工位', value: () => target.value.seat },
      { header: '累计刀数', value: () => cuts.value },
      { header: '平均频率(次/秒)', value: () => average.value.toFixed(2) },
      { header: '节奏均匀度(%)', value: () => uniformity.value },
      { header: '操作连续性(%)', value: () => continuity.value },
      { header: '成丝厚度(mm)', value: () => spec.value?.thickness ?? '' },
      { header: '成丝长度(mm)', value: () => spec.value?.length ?? '' },
      { header: '采集时长(s)', value: () => Math.round(elapsed.value) },
      { header: '导出时间', value: () => formatDateTime(Date.now(), 'YYYY-MM-DD HH:mm:ss') },
    ],
    [{}],
  )
  ElMessage.success('已导出本次预处理指标')
}

/** 折线坐标：把采样点映射到 320x96 的视口里 */
const polyline = computed(() => {
  const data = samples.value
  if (data.length < 2) return ''
  const max = Math.max(...data, 4)
  const stepX = 320 / (data.length - 1)
  return data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(96 - (v / max) * 84).toFixed(1)}`)
    .join(' ')
})

async function toggle(): Promise<void> {
  if (running.value) {
    running.value = false
    window.clearInterval(timer)
    if (!isReviewing.value) stop()
    return
  }

  // 教师视角不开摄像头：数据来自被选中学生的录像
  if (!isReviewing.value) {
    const ok = await start()
    if (!ok) return
  }

  running.value = true
  samples.value = []
  cuts.value = 0
  elapsed.value = 0
  keyframes.value = []

  timer = window.setInterval(() => {
    // 以 0.6 为基准做小幅波动，模拟刀刃起落节奏
    const v = Number((2.2 + Math.sin(elapsed.value / 6) * 0.5 + (Math.random() - 0.5) * 0.8).toFixed(2))
    samples.value = [...samples.value.slice(-39), Math.max(0, v)]
    cuts.value += Math.round(v * 1.5)
    elapsed.value += 1.5

    // 每 6 秒留一张关键帧，点击可看「这个数字对应的画面」
    if (samples.value.length % 4 === 0) {
      const frame: Keyframe = {
        id: `kf_${Date.now()}`,
        at: Math.round(elapsed.value),
        label: `第 ${cuts.value} 刀 · ${v.toFixed(1)} 次/秒`,
        image: prepShot,
      }
      keyframes.value = [frame, ...keyframes.value].slice(0, 6)
    }
  }, 1500)
}

/** 换人时清空曲线：上一个学生的节奏留在图上会读成新学生的成绩 */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    running.value = false
    window.clearInterval(timer)
    samples.value = []
    cuts.value = 0
    elapsed.value = 0
    keyframes.value = []
  },
)

onBeforeUnmount(() => window.clearInterval(timer))

const endpoints = [
  {
    name: '视频分析',
    method: 'POST' as const,
    path: '/api/modules/ingredient/analyze',
    note: '上传一段切配视频或帧序列，后端逐帧检测刀与食材，回传频率曲线。',
    request: `FormData {
  file: <mp4, <= 30s>,
  task_id: "task_20261120_01",
  student_id: 1001
}`,
    response: `{
  "code": 0,
  "data": {
    "cuts": 186,
    "avg_frequency": 2.4,
    "uniformity": 87,
    "score": 91,
    "curve": [2.1, 2.6, 2.3, 2.8],
    "duration": 78
  },
  "message": "ok"
}`,
  },
  {
    name: '实时帧流',
    method: 'POST' as const,
    path: '/api/modules/ingredient/frame',
    note: '低延迟模式：前端每 500ms 送一帧，后端只回当前窗口的计数。',
    request: `FormData {
  file: <jpeg 帧>,
  window_ms: 3000
}`,
    response: `{
  "code": 0,
  "data": { "count": 7, "frequency": 2.33 },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="食材预处理评价"
    subtitle="分析切配动作与节奏，统计单位时间内的切丝次数"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button v-if="samples.length" @click="exportResult">导出结果</el-button>
      <el-button :type="running ? 'default' : 'primary'" @click="toggle">
        {{ running ? '停止分析' : isReviewing ? '分析该生录像' : '开始分析' }}
      </el-button>
    </template>

    <div class="prep-grid">
      <section class="app-card video-card">
        <ReviewStage
          v-if="isReviewing"
          :student="target"
          :channel="`工位 ${target.seat} · 俯拍砧板`"
          :duration="78"
        />

        <div v-else class="video-card__stage">
          <video ref="videoRef" class="video-card__video" muted playsinline />

          <div v-if="!active" class="video-card__idle">
            <p>{{ error || '摄像头未开启' }}</p>
            <span>对准砧板与双手，画面内保留完整刀具行程</span>
          </div>

          <div v-if="active" class="video-card__roi" aria-hidden="true">
            <span class="video-card__roi-label">刀具区域</span>
          </div>
        </div>

        <footer v-if="!isReviewing" class="video-card__bar">
          <span class="video-card__status">
            <i :class="running ? 'is-live' : ''" aria-hidden="true" />
            {{ running ? '采集中' : '待机中' }}
          </span>
          <span class="num video-card__dur">{{ elapsed.toFixed(1) }} s</span>
        </footer>
      </section>

      <section class="app-card freq-card">
        <header class="card-head">
          <h2>{{ isReviewing ? `${target.name} · 切丝频率` : '切丝频率' }}</h2>
          <span class="freq-card__unit">次 / 秒</span>
        </header>

        <div class="freq-card__value num">
          {{ current.toFixed(1) }}
          <span>当前</span>
        </div>

        <svg class="spark" viewBox="0 0 320 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="96" x2="320" y2="96" stroke="#e4e4e7" stroke-width="1" />
          <polyline
            v-if="polyline"
            :points="polyline"
            fill="none"
            stroke="#2f54eb"
            stroke-width="1.6"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>

        <dl class="freq-facts">
          <div>
            <dt>平均频率</dt>
            <dd class="num">{{ average.toFixed(1) }}</dd>
          </div>
          <div>
            <dt>累计刀数</dt>
            <dd class="num">{{ cuts }}</dd>
          </div>
          <div>
            <dt>节奏均匀度</dt>
            <dd class="num">{{ uniformity }}<em>%</em></dd>
          </div>
        </dl>
      </section>
    </div>

    <!-- 指标：每项都写数值、等级与依据，不出现无来源的分数 -->
    <section class="app-card">
      <header class="card-head">
        <h2>可观测指标</h2>
        <span class="card-head__hint">{{ ownerName }} · 采集 {{ Math.round(elapsed) }} s</span>
      </header>

      <ul class="indicator-list">
        <li v-for="item in indicators" :key="item.key" class="indicator">
          <div class="indicator__head">
            <span class="indicator__label">{{ item.label }}</span>
            <span class="indicator__level" :class="`is-${item.level}`">
              {{ LEVEL_LABEL[item.level] }}
            </span>
            <strong class="indicator__value num">{{ item.value }}</strong>
          </div>
          <p class="indicator__basis">{{ item.basis }}</p>
        </li>
      </ul>

      <!-- 关键帧 -->
      <div v-if="keyframes.length" class="frames">
        <header class="frames__head">
          <h3>关键帧</h3>
          <span>点击放大，时间点为相对开始时刻</span>
        </header>
        <ul class="frames__list">
          <li v-for="frame in keyframes" :key="frame.id" class="frame">
            <el-image
              :src="frame.image"
              :preview-src-list="[frame.image]"
              fit="cover"
              preview-teleported
              class="frame__img"
            />
            <span class="frame__at num">{{ frame.at }}s</span>
            <span class="frame__label">{{ frame.label }}</span>
          </li>
        </ul>
      </div>
      <p v-else class="frames__empty">开始分析后，每 6 秒留一张关键帧，用于核对频率曲线的峰值与停手点。</p>
    </section>

    <section class="app-card">
      <header class="card-head">
        <h2>判定口径</h2>
        <span class="card-head__hint">与后端保持一致的评分依据</span>
      </header>

      <ul class="basis-list">
        <li>
          <span class="basis-list__key">频率</span>
          单位时间内的有效切割次数，低于 1.2 次/秒视为节奏过慢。
        </li>
        <li>
          <span class="basis-list__key">均匀度</span>
          窗口内频率的离散程度，方差越大扣分越多。
        </li>
        <li>
          <span class="basis-list__key">刀具轨迹</span>
          刀刃是否在砧板范围内稳定起落，越界与抬刀过高单独计次。
        </li>
        <li>
          <span class="basis-list__key">成丝规格</span>
          抽帧测量截面尺寸，与课程标准（如 3mm×3mm）比对。
        </li>
      </ul>
    </section>

    <TeacherReview
      v-if="can('module.review')"
      module="ingredient"
      module-label="食材预处理"
      :items="reviewItems"
    />
  </ModuleShell>
</template>

<style scoped lang="scss">
.prep-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: $space-4;
}

.video-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;

  &__stage {
    position: relative;
    flex: 1;
    min-height: 300px;
    background: radial-gradient(circle at 50% 42%, #1a1b1f 0%, #0c0d0f 72%);
  }

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__idle {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 0 $space-6;
    text-align: center;

    p {
      margin: 0;
      font-size: $font-size-sm;
      color: rgba(255, 255, 255, 0.72);
    }

    span {
      max-width: 280px;
      font-size: $font-size-xs;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.34);
    }
  }

  &__roi {
    position: absolute;
    right: 12%;
    bottom: 16%;
    left: 12%;
    height: 38%;
    border: 1px dashed rgba(255, 255, 255, 0.4);
    border-radius: 8px;
  }

  &__roi-label {
    position: absolute;
    top: -20px;
    left: 0;
    font-family: $font-family-mono;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.45);
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px $space-5;
    border-top: 1px solid $color-border-light;
  }

  &__status {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    font-size: $font-size-sm;
    color: $color-text-regular;

    i {
      display: block;
      width: 6px;
      height: 6px;
      background: $color-border-strong;
      border-radius: 50%;

      &.is-live {
        background: $color-success-dot;
      }
    }
  }

  &__dur {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.freq-card {
  display: flex;
  flex-direction: column;

  &__unit {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__value {
    margin-top: $space-2;
    font-size: 44px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    color: $color-text-primary;
    letter-spacing: -0.03em;

    span {
      margin-left: 6px;
      font-family: $font-family-base;
      font-size: $font-size-xs;
      font-weight: $font-weight-regular;
      color: $color-text-placeholder;
      letter-spacing: 0;
    }
  }
}

.spark {
  width: 100%;
  height: 96px;
  margin-top: $space-4;
}

.freq-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
  padding-top: $space-4;
  margin: auto 0 0;
  border-top: 1px solid $color-border-light;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 4px 0 0;
    font-size: $font-size-md;
    font-weight: $font-weight-medium;
    color: $color-text-primary;

    em {
      margin-left: 1px;
      font-size: 10px;
      font-style: normal;
      color: $color-text-placeholder;
    }
  }
}

.basis-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: flex;
    gap: $space-3;
    align-items: baseline;
    font-size: $font-size-sm;
    line-height: 1.7;
    color: $color-text-secondary;
  }

  &__key {
    flex-shrink: 0;
    width: 68px;
    font-size: $font-size-xs;
    color: $color-text-primary;
  }
}

.indicator-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3 $space-5;
  padding: 0;
  margin: 0;
  list-style: none;
}

.indicator {
  padding: 10px 0;
  border-top: 1px solid $color-border-light;

  &__head {
    display: flex;
    gap: $space-2;
    align-items: baseline;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__level {
    font-size: 10px;

    &.is-good {
      color: $color-success;
    }

    &.is-fair {
      color: $color-warning;
    }

    &.is-poor {
      color: $color-danger;
    }

    &.is-pending {
      color: $color-text-placeholder;
    }
  }

  &__value {
    margin-left: auto;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__basis {
    margin: 3px 0 0;
    font-size: 11px;
    line-height: 1.6;
    color: $color-text-placeholder;
  }
}

.frames {
  padding-top: $space-4;
  margin-top: $space-4;
  border-top: 1px solid $color-border-light;

  &__head {
    display: flex;
    gap: $space-2;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: $space-2;

    h3 {
      margin: 0;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }

    span {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  &__empty {
    padding-top: $space-3;
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    border-top: 1px solid $color-border-light;
  }
}

.frame {
  position: relative;
  overflow: hidden;
  border-radius: $radius-sm;

  &__img {
    width: 100%;
    aspect-ratio: 4 / 3;
    background: $color-bg-subtle;
  }

  &__at {
    position: absolute;
    top: 4px;
    left: 4px;
    padding: 0 4px;
    font-size: 9px;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 2px;
  }

  &__label {
    display: block;
    padding: 3px 2px 0;
    overflow: hidden;
    font-size: 9.5px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 1280px) {
  .prep-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .indicator-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .frames__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
