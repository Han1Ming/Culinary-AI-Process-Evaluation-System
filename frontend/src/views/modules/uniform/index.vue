<script setup lang="ts">
/**
 * 着装规范识别
 * ----------------------------------------------------------------------------
 * 演示闭环：打开工位摄像头 → 逐项判定着装 → 不合规给出具体项 → 记录留档。
 * 判定逻辑目前在前端模拟（后端 /api/modules/uniform/analyze 就绪后替换），
 * 但交互、状态机、记录结构都按真实形态实现，接后端时只换数据来源。
 *
 * 两种视角共用一套判定逻辑，只有画面来源不同：
 *   学生 —— 本机摄像头，自己对着拍；
 *   教师 —— 左上角选中的那个学生的录像回放（ReviewStage），
 *           判定与扣分都记在这个人名下。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import ReviewStage from '@/components/ReviewStage.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { formatDateTime } from '@/utils/format'

const { can } = useRole()
const auth = useAuthStore()
const reviewStore = useReviewStore()

/** 教师 / 管理员：看的是别人的录像；学生：看自己的摄像头 */
const isReviewing = computed(() => can('module.review'))
const target = computed(() => reviewStore.activeStudent)
/** 记录归到谁名下 */
const recordOwner = computed(() => (isReviewing.value ? target.value : auth.user))

/** 教师可直接扣分的违规项（AI 判不出、但现场一眼能看出来的） */
const reviewItems = [
  { label: '未戴厨师帽', points: 5 },
  { label: '未穿厨师服', points: 5 },
  { label: '未系围裙', points: 3 },
  { label: '头发外露', points: 3 },
  { label: '佩戴饰物', points: 2 },
  { label: '手部不洁', points: 4 },
]

interface CheckItem {
  key: string
  label: string
  /** 该项的判定依据，说明为什么能判出来 */
  basis: string
  ok: boolean
}

interface UniformRecord {
  id: string
  studentName: string
  className: string
  compliant: boolean
  failedItems: string[]
  at: string
}

const { videoRef, active, error, start, stop } = useCamera({ facingMode: 'environment' })

const scanning = ref(false)
const verifying = ref(false)
const lastCheckedAt = ref<number | null>(null)
const records = ref<UniformRecord[]>([])

const items = ref<CheckItem[]>([
  { key: 'jacket', label: '厨师服', basis: '上身白色双排扣，覆盖至袖口', ok: true },
  { key: 'hat', label: '厨师帽', basis: '头部白色高帽，完整佩戴', ok: true },
  { key: 'apron', label: '围裙', basis: '腰前围裙系带完整', ok: true },
  { key: 'hair', label: '头发', basis: '发丝不外露，帽内收拢', ok: true },
  { key: 'jewelry', label: '饰物', basis: '手部无戒指、手链、手表', ok: true },
])

const failed = computed(() => items.value.filter((i) => !i.ok))
const compliant = computed(() => failed.value.length === 0)
/** 是否已经判过：没判过就别显示 100 分，那会让人以为是结果 */
const hasResult = computed(() => lastCheckedAt.value !== null)
const score = computed(() => Math.round(((items.value.length - failed.value.length) / items.value.length) * 100))

const statusText = computed(() => {
  if (isReviewing.value) {
    if (verifying.value) return '正在判定…'
    return lastCheckedAt.value ? '已判定该生画面' : '待判定'
  }
  if (error.value) return '摄像头异常'
  if (verifying.value) return '正在判定…'
  if (!scanning.value) return '待机中'
  return compliant.value ? '着装合规' : `${failed.value.length} 项不合规`
})

let timer: number | undefined

/** 教师视角：直接对当前回放的这一场判定，不开本机摄像头 */
async function runReview(): Promise<void> {
  await verify()
}

async function toggleScan(): Promise<void> {
  if (scanning.value) {
    scanning.value = false
    window.clearInterval(timer)
    stop()
    return
  }

  const ok = await start()
  if (!ok) return
  scanning.value = true
  void verify()
  // 真实环境这里应是后端持续推流；演示阶段按固定间隔重新判定
  timer = window.setInterval(() => void verify(), 8000)
}

async function verify(): Promise<void> {
  if (verifying.value) return
  verifying.value = true

  // 80% 概率合规，其余随机挑一项不合格，让演示能看到两种状态
  const pass = Math.random() > 0.2
  const failIndex = pass ? -1 : Math.floor(Math.random() * items.value.length)
  items.value = items.value.map((item, i) => ({ ...item, ok: i !== failIndex }))

  await new Promise((r) => setTimeout(r, 900))
  lastCheckedAt.value = Date.now()

  const record: UniformRecord = {
    id: `uni_${Date.now()}`,
    studentName: recordOwner.value?.name ?? '本人',
    className: recordOwner.value?.department ?? '',
    compliant: compliant.value,
    failedItems: failed.value.map((f) => f.label),
    at: new Date().toISOString(),
  }
  records.value = [record, ...records.value].slice(0, 6)

  verifying.value = false
  if (!compliant.value) {
    ElMessage.warning(`请注意：${failed.value.map((f) => f.label).join('、')} 不合规`)
  }
}

/** 换人时清空上一个学生的判定结果：留着会让人以为新学生就是这个结论 */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    items.value = items.value.map((item) => ({ ...item, ok: true }))
    lastCheckedAt.value = null
  },
)

onBeforeUnmount(() => window.clearInterval(timer))

const endpoints = [
  {
    name: '单帧检测',
    method: 'POST' as const,
    path: '/api/modules/uniform/analyze',
    note: '工位摄像头每秒抽 2 帧送入该接口，返回逐项合规结果。',
    request: `FormData {
  file: <jpeg 帧, 640x480>,
  task_id: "task_20261120_01"
}`,
    response: `{
  "code": 0,
  "data": {
    "compliant": true,
    "score": 100,
    "items": [
      { "key": "jacket", "ok": true,  "confidence": 0.97 },
      { "key": "hat",    "ok": true,  "confidence": 0.95 },
      { "key": "apron",  "ok": false, "confidence": 0.88 }
    ]
  },
  "message": "ok"
}`,
  },
  {
    name: '检测记录',
    method: 'GET' as const,
    path: '/api/modules/uniform/records',
    note: '按班级与日期分页查询，用于课后复核与导出。',
    request: `{
  "class_id": 12,
  "date": "2026-11-20",
  "page": 1,
  "page_size": 20
}`,
    response: `{
  "code": 0,
  "data": {
    "total": 38,
    "list": [
      {
        "id": "uni_1024",
        "student_id": 1001,
        "compliant": false,
        "failed_items": ["apron"],
        "created_at": "2026-11-20T08:06:12"
      }
    ]
  },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="着装规范识别"
    subtitle="工位摄像头逐项判定厨师服、厨师帽、围裙与饰物"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button
        :type="scanning || verifying ? 'default' : 'primary'"
        @click="isReviewing ? runReview() : toggleScan()"
      >
        {{ isReviewing ? '重新判定该生画面' : scanning ? '停止检测' : '开始检测' }}
      </el-button>
    </template>

    <div class="uniform-grid">
      <!-- 取景区 -->
      <section class="app-card video-card">
        <ReviewStage
          v-if="isReviewing"
          :student="target"
          :channel="`工位 ${target.seat} · 正前方`"
          :duration="86"
        />

        <div v-else class="video-card__stage">
          <video ref="videoRef" class="video-card__video" muted playsinline />

          <div v-if="!active" class="video-card__idle">
            <p>{{ error || '摄像头未开启' }}</p>
            <span>点击右上角「开始检测」接入工位画面</span>
          </div>

          <div v-if="active" class="video-card__box" :class="{ 'is-fail': !compliant }" aria-hidden="true" />
        </div>

        <footer v-if="!isReviewing" class="video-card__bar">
          <span class="video-card__status">
            <i :class="compliant && scanning ? 'ok' : scanning ? 'warn' : ''" aria-hidden="true" />
            {{ statusText }}
          </span>
          <span v-if="lastCheckedAt" class="video-card__time num">
            {{ formatDateTime(new Date(lastCheckedAt).toISOString(), 'HH:mm:ss') }}
          </span>
        </footer>
      </section>

      <!-- 判定结果 -->
      <section class="app-card check-card">
        <header class="card-head">
          <h2>{{ isReviewing ? `${target.name} · 判定项` : '判定项' }}</h2>
          <span class="check-card__score num">
            <template v-if="hasResult">{{ score }}<em>分</em></template>
            <template v-else>—</template>
          </span>
        </header>

        <p v-if="isReviewing" class="check-card__note">
          {{ lastCheckedAt ? `上次判定 ${formatDateTime(new Date(lastCheckedAt).toISOString(), 'HH:mm:ss')}` : '尚未判定，点右上角按钮开始' }}
        </p>

        <ul class="check-list">
          <li
            v-for="item in items"
            :key="item.key"
            class="check-row"
            :class="{ 'is-fail': hasResult && !item.ok, 'is-pending': !hasResult }"
          >
            <span class="check-row__dot" aria-hidden="true" />
            <div class="check-row__body">
              <p class="check-row__label">{{ item.label }}</p>
              <span class="check-row__basis">{{ item.basis }}</span>
            </div>
            <span class="check-row__state">
              {{ !hasResult ? '待判定' : item.ok ? '合规' : '不合规' }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <!-- 记录 -->
    <section class="app-card">
      <header class="card-head">
        <h2>最近检测</h2>
        <span class="card-head__hint">共 {{ records.length }} 条</span>
      </header>

      <ul v-if="records.length" class="record-list">
        <li v-for="rec in records" :key="rec.id" class="record">
          <div class="record__body">
            <p class="record__name">{{ rec.studentName }}</p>
            <span class="record__meta">{{ rec.className }}</span>
          </div>
          <span class="record__flag" :class="rec.compliant ? 'is-ok' : 'is-fail'">
            {{ rec.compliant ? '合规' : rec.failedItems.join('、') }}
          </span>
          <span class="record__time num">{{ formatDateTime(rec.at, 'HH:mm:ss') }}</span>
        </li>
      </ul>

      <p v-else class="empty-line">开始检测后，结果会逐条记录在这里</p>
    </section>

    <!-- 教师复核：机器判不出的现场问题由教师当场扣分 -->
    <TeacherReview
      v-if="can('module.review')"
      module="uniform"
      module-label="着装规范"
      :items="reviewItems"
    />
  </ModuleShell>
</template>

<style scoped lang="scss">
.uniform-grid {
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
      font-size: $font-size-xs;
      color: rgba(255, 255, 255, 0.34);
    }
  }

  // 人物框：只画四角，比整框更少遮挡画面
  &__box {
    position: absolute;
    top: 12%;
    left: 22%;
    width: 56%;
    height: 76%;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 10px;
    transition: border-color $duration-base $ease-standard;

    &.is-fail {
      border-color: rgba(239, 68, 68, 0.55);
    }
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

      &.ok {
        background: $color-success-dot;
      }

      &.warn {
        background: $color-warning-dot;
      }
    }
  }

  &__time {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.check-card {
  &__note {
    // 只有教师视角出现：说明这一栏的判定属于谁、什么时候判的
    padding: 7px 10px;
    margin: 0 0 $space-2;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-sm;
  }

  &__score {
    font-size: 22px;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;

    em {
      margin-left: 2px;
      font-size: 11px;
      font-style: normal;
      font-weight: $font-weight-regular;
      color: $color-text-placeholder;
    }
  }
}

.check-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

.check-row {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    background: $color-success-dot;
    border-radius: 50%;
  }

  &.is-fail &__dot {
    background: $color-danger-dot;
  }

  // 未判定：三项都灰着，别用绿色假装已经合规
  &.is-pending &__dot {
    background: $color-border-strong;
  }

  &__body {
    min-width: 0;
  }

  &__label {
    margin: 0;
    font-size: $font-size-base;
    color: $color-text-primary;
  }

  &__basis {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    flex-shrink: 0;
    margin-left: auto;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &.is-fail &__state {
    color: $color-danger;
  }
}

.record-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

.record {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
  }

  &__body {
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
    color: $color-text-primary;
  }

  &__meta {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__flag {
    margin-left: auto;
    font-size: $font-size-xs;

    &.is-ok {
      color: $color-success;
    }

    &.is-fail {
      color: $color-danger;
    }
  }

  &__time {
    flex-shrink: 0;
    width: 64px;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-align: right;
  }
}

.empty-line {
  padding: $space-6 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

@media (max-width: 1280px) {
  .uniform-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
