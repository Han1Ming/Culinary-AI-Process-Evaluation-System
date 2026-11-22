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
import StateView from '@/components/StateView.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { askReason } from '@/utils/confirm'
import { downloadCsv, safeFilename } from '@/utils/export'
import { formatDateTime } from '@/utils/format'
import uniformShot from '@/assets/images/uniform-students.jpg'

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
  /** ok 合格 / fail 不合格 / review 待复核 / pending 未检测 */
  status: 'ok' | 'fail' | 'review' | 'pending'
  /** 模型置信度 0~1 */
  confidence?: number
  /** 不合格原因，给教师看的判定依据 */
  reason?: string
  /** 不合格截图 */
  snapshot?: string
  /** 教师是否已人工确认 / 驳回 */
  reviewedBy?: string
}

interface UniformRecord {
  id: string
  studentName: string
  className: string
  compliant: boolean
  failedItems: string[]
  /** 待复核项数量（置信度低，机器不敢定） */
  reviewItems: number
  at: string
}

const { videoRef, active, error, start, stop } = useCamera({ facingMode: 'environment' })

const scanning = ref(false)
const verifying = ref(false)
const lastCheckedAt = ref<number | null>(null)
const records = ref<UniformRecord[]>([])

const items = ref<CheckItem[]>([
  { key: 'jacket', label: '厨师服', basis: '上身白色双排扣，覆盖至袖口', status: 'pending' },
  { key: 'hat', label: '厨师帽', basis: '头部白色高帽，完整佩戴', status: 'pending' },
  { key: 'apron', label: '围裙', basis: '腰前围裙系带完整', status: 'pending' },
  { key: 'hair', label: '头发', basis: '发丝不外露，帽内收拢', status: 'pending' },
  { key: 'jewelry', label: '饰物', basis: '手部无戒指、手链、手表', status: 'pending' },
])

const failed = computed(() => items.value.filter((i) => i.status === 'fail'))
const reviews = computed(() => items.value.filter((i) => i.status === 'review'))
const compliant = computed(
  () => items.value.length > 0 && items.value.every((i) => i.status === 'ok'),
)
/** 是否已经判过：没判过就别显示 100 分，那会让人以为是结果 */
const hasResult = computed(() => lastCheckedAt.value !== null)
const score = computed(() =>
  Math.round(
    (items.value.filter((i) => i.status === 'ok').length / items.value.length) * 100,
  ),
)

const statusText = computed(() => {
  if (isReviewing.value) {
    if (verifying.value) return '正在判定…'
    return lastCheckedAt.value ? '已判定该生画面' : '待判定'
  }
  if (error.value) return '摄像头异常'
  if (verifying.value) return '正在判定…'
  if (!scanning.value) return '待机中'
  if (failed.value.length) return `${failed.value.length} 项不合规`
  if (reviews.value.length) return `${reviews.value.length} 项待复核`
  return '着装合规'
})

const ITEM_STATUS: Record<CheckItem['status'], { label: string; tone: string }> = {
  ok: { label: '合格', tone: 'ok' },
  fail: { label: '不合格', tone: 'fail' },
  review: { label: '待复核', tone: 'review' },
  pending: { label: '未检测', tone: 'pending' },
}

/** 违规统计：按检查项统计次数，导出时一并写进 CSV 的第二段 */
const violationStats = computed(() => {
  const map = new Map<string, number>()
  records.value.forEach((record) => {
    record.failedItems.forEach((item) => map.set(item, (map.get(item) ?? 0) + 1))
  })
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
})

/** 历史筛选 */
const filterClass = ref('')
const filterDate = ref('')
const classOptions = computed(() => [...new Set(records.value.map((r) => r.className))])
const filteredRecords = computed(() =>
  records.value.filter((record) => {
    if (filterClass.value && record.className !== filterClass.value) return false
    if (filterDate.value && record.at.slice(0, 10) !== filterDate.value) return false
    return true
  }),
)

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function exportRecords(): void {
  if (!filteredRecords.value.length) {
    ElMessage.warning('当前筛选下没有可导出的记录')
    return
  }
  downloadCsv(
    safeFilename(`着装违规记录-${stamp()}`),
    [
      { header: '时间', value: (row: UniformRecord) => formatDateTime(row.at, 'YYYY-MM-DD HH:mm:ss') },
      { header: '学生', value: (row) => row.studentName },
      { header: '班级', value: (row) => row.className },
      { header: '结论', value: (row) => (row.compliant ? '合规' : row.failedItems.join('、')) },
      { header: '待复核项', value: (row) => row.reviewItems },
    ],
    filteredRecords.value,
  )
  ElMessage.success(`已导出 ${filteredRecords.value.length} 条记录`)
}

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

const FAIL_REASONS: Record<string, string> = {
  jacket: '上衣为非纯白或袖口卷起，判定为未规范穿着',
  hat: '头部未检测到白色高帽，或帽体明显偏斜',
  apron: '腰前未检测到围裙系带，判定为未系围裙',
  hair: '帽檐外侧检测到发丝，判定为头发外露',
  jewelry: '手部检测到环状高反光物体，疑似戒指或手表',
}

async function verify(): Promise<void> {
  if (verifying.value) return
  verifying.value = true

  await new Promise((resolve) => setTimeout(resolve, 900))

  // 逐项独立判定：大部分合格，少量不合格，置信度低的标「待复核」而不是硬判
  items.value = items.value.map((item) => {
    const roll = Math.random()
    if (roll < 0.08) {
      return {
        ...item,
        status: 'review' as const,
        confidence: Number((0.55 + Math.random() * 0.13).toFixed(2)),
        reason: '画面遮挡 / 角度不足，无法给出确定结论',
        snapshot: uniformShot,
        reviewedBy: undefined,
      }
    }
    if (roll < 0.18) {
      return {
        ...item,
        status: 'fail' as const,
        confidence: Number((0.78 + Math.random() * 0.15).toFixed(2)),
        reason: FAIL_REASONS[item.key],
        snapshot: uniformShot,
        reviewedBy: undefined,
      }
    }
    return {
      ...item,
      status: 'ok' as const,
      confidence: Number((0.9 + Math.random() * 0.09).toFixed(2)),
      reason: undefined,
      snapshot: undefined,
      reviewedBy: undefined,
    }
  })

  lastCheckedAt.value = Date.now()

  const record: UniformRecord = {
    id: `uni_${Date.now()}`,
    studentName: recordOwner.value?.name ?? '本人',
    className: recordOwner.value?.department ?? '',
    compliant: compliant.value,
    failedItems: failed.value.map((f) => f.label),
    reviewItems: reviews.value.length,
    at: new Date().toISOString(),
  }
  records.value = [record, ...records.value].slice(0, 24)

  verifying.value = false
  if (failed.value.length) {
    ElMessage.warning(`请注意：${failed.value.map((f) => f.label).join('、')} 不合规`)
  } else if (reviews.value.length) {
    ElMessage.info(`${reviews.value.map((r) => r.label).join('、')} 置信度不足，需教师复核`)
  }
}

/**
 * 复核留痕：写清「谁、什么时候、做了什么」。
 * 只写「教师确认」这种角色名，事后追责时无法定位到人——
 * 一个班两名教师同时复核时更是分不清。
 */
function auditStamp(action: string): string {
  return `${action} · ${auth.displayName} · ${formatDateTime(Date.now(), 'MM-DD HH:mm')}`
}

/** 教师确认某判定项合格 */
function confirmItem(item: CheckItem): void {
  item.status = 'ok'
  item.reviewedBy = auditStamp('教师确认')
  ElMessage.success(`${item.label} 已确认为合格`)
}

/** 教师驳回：机器判合格、现场看出问题的，直接改判不合格并留原因 */
async function rejectItem(item: CheckItem): Promise<void> {
  const reason = await askReason({
    title: `判定「${item.label}」不合格`,
    message: '改判会记为教师复核结果，AI 原始判定保留备查。',
    placeholder: '例如：袖口有明显油渍，画面未拍到',
  })
  if (!reason) return
  item.status = 'fail'
  item.reason = reason
  item.reviewedBy = auditStamp('教师驳回')
  item.snapshot = uniformShot
  ElMessage.success(`${item.label} 已改判为不合格`)
}

/** 教师把低置信项挂起，课后复核 */
async function markReview(item: CheckItem): Promise<void> {
  const reason = await askReason({
    title: `将「${item.label}」标记为待复核`,
    placeholder: '例如：学生转身取物，画面未能确认围裙',
  })
  if (!reason) return
  item.status = 'review'
  item.reason = reason
  item.reviewedBy = auditStamp('教师挂起')
  ElMessage.info(`${item.label} 已标记为待复核`)
}

/** 换人时清空上一个学生的判定结果：留着会让人以为新学生就是这个结论 */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    items.value = items.value.map((item) => ({
      ...item,
      status: 'pending',
      confidence: undefined,
      reason: undefined,
      snapshot: undefined,
      reviewedBy: undefined,
    }))
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
            :class="[`is-${ITEM_STATUS[item.status].tone}`]"
          >
            <span class="check-row__dot" aria-hidden="true" />
            <div class="check-row__body">
              <p class="check-row__label">
                {{ item.label }}
                <span class="check-row__state">{{ ITEM_STATUS[item.status].label }}</span>
              </p>
              <span class="check-row__basis">{{ item.basis }}</span>
              <p v-if="item.reason && item.status !== 'ok'" class="check-row__reason">{{ item.reason }}</p>
              <div v-if="hasResult" class="check-row__meta num">
                <span v-if="item.confidence">置信度 {{ (item.confidence * 100).toFixed(0) }}%</span>
                <span>识别于 {{ formatDateTime(lastCheckedAt ?? Date.now(), 'HH:mm:ss') }}</span>
                <span v-if="item.reviewedBy">{{ item.reviewedBy }}</span>
              </div>
              <el-image
                v-if="item.snapshot && item.status !== 'ok'"
                :src="item.snapshot"
                :preview-src-list="[item.snapshot]"
                fit="cover"
                preview-teleported
                class="check-row__shot"
              />
            </div>

            <div v-if="can('module.review') && hasResult" class="check-row__actions">
              <el-button v-if="item.status !== 'ok'" text size="small" @click="confirmItem(item)">
                确认合格
              </el-button>
              <el-button v-if="item.status !== 'fail'" text size="small" type="danger" @click="rejectItem(item)">
                驳回
              </el-button>
              <el-button v-if="item.status === 'review'" text size="small" @click="markReview(item)">
                继续挂起
              </el-button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- 记录与违规统计 -->
    <section class="app-card">
      <header class="card-head">
        <h2>检测记录</h2>
        <div class="head-tools">
          <el-select v-model="filterClass" size="small" placeholder="全部班级" clearable class="head-tools__sel">
            <el-option v-for="name in classOptions" :key="name" :label="name" :value="name" />
          </el-select>
          <el-date-picker
            v-model="filterDate"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            placeholder="按日期"
            class="head-tools__date"
          />
          <el-button size="small" :disabled="!filteredRecords.length" @click="exportRecords">
            导出违规记录
          </el-button>
        </div>
      </header>

      <div v-if="violationStats.length" class="stats-line">
        <span class="stats-line__label">违规项统计</span>
        <span v-for="stat in violationStats" :key="stat.label" class="stats-line__item">
          {{ stat.label }} <strong class="num">{{ stat.count }}</strong> 次
        </span>
      </div>

      <StateView
        v-if="!filteredRecords.length"
        state="empty"
        compact
        description="开始检测后，结果会逐条记录在这里；可按班级与日期筛选"
      />

      <ul v-else class="record-list">
        <li v-for="rec in filteredRecords" :key="rec.id" class="record">
          <div class="record__body">
            <p class="record__name">{{ rec.studentName }}</p>
            <span class="record__meta">{{ rec.className }}</span>
          </div>
          <span class="record__flag" :class="rec.compliant ? 'is-ok' : 'is-fail'">
            {{ rec.compliant ? '合规' : rec.failedItems.join('、') }}
          </span>
          <span v-if="rec.reviewItems" class="record__review num">{{ rec.reviewItems }} 项待复核</span>
          <span class="record__time num">{{ formatDateTime(rec.at, 'HH:mm:ss') }}</span>
        </li>
      </ul>
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
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-top: 6px;
    background: $color-success-dot;
    border-radius: 50%;
  }

  &.is-fail &__dot {
    background: $color-danger-dot;
  }

  &.is-review &__dot {
    background: $color-warning-dot;
  }

  // 未判定：三项都灰着，别用绿色假装已经合规
  &.is-pending &__dot {
    background: $color-border-strong;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    font-size: $font-size-base;
    color: $color-text-primary;
  }

  &__state {
    font-size: 10px;
    color: $color-text-placeholder;

    .is-fail & {
      color: $color-danger;
    }

    .is-review & {
      color: $color-warning;
    }

    .is-ok & {
      color: $color-success;
    }
  }

  &__basis {
    display: block;
    margin-top: 2px;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__reason {
    margin: 4px 0 0;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-regular;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    margin-top: 4px;
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &__shot {
    width: 96px;
    height: 72px;
    margin-top: 6px;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-xs;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 2px;
    align-items: flex-end;

    :deep(.el-button) {
      margin-left: 0;
    }
  }
}

.head-tools {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  align-items: center;

  &__sel {
    width: 150px;
  }

  &__date {
    width: 130px;
  }
}

.stats-line {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2 $space-4;
  align-items: baseline;
  padding: 8px 10px;
  margin-bottom: $space-2;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-sm;

  &__label {
    color: $color-text-placeholder;
  }

  &__item strong {
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }
}

.record__review {
  flex-shrink: 0;
  font-size: 10px;
  color: $color-warning;
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
