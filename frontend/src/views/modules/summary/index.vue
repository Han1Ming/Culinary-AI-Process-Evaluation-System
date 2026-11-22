<script setup lang="ts">
/**
 * 综合评价
 * ----------------------------------------------------------------------------
 * 把前五个模块的结果按权重合成总分。左侧是班级名单，右侧是选中学生的
 * 分环节拆分——教师复核时关心的不是总分，而是「这一分是怎么来的」。
 *
 * 角色差异（三条工作流，不是一个页面的开关）：
 *   学生 —— 只看自己的报告，没有名单，也没有别人的分数；
 *   教师 —— 本节课的班，逐人复核、归档，导出全班成绩单；
 *   管理员 —— 全站范围，可切班查看，导出跨班成绩单；
 * 三者都能导出「单人报告」：A4 打印页，浏览器里可直接另存为 PDF。
 *
 * 导出为什么放在前端做：CSV 与打印都不依赖后端，且保证「导出的就是屏幕上这份」。
 * 后端若要改发 xlsx，只需替换本页的 downloadCsv 调用，见 docs/后端开发任务书.md。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import AppSkeleton from '@/components/AppSkeleton.vue'
import ReviewActions from '@/components/ReviewActions.vue'
import { archiveSummary, fetchSummaryRoster, overrideSourceScore, reviewSummaryStudent } from '@/api/summary'
import type { ReviewAction } from '@/api/summary'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { downloadCsv, safeFilename } from '@/utils/export'
import type { CsvColumn } from '@/utils/export'
import { askReason, confirmAction } from '@/utils/confirm'
import { RULE_VERSION } from '@/config/rules'
import { formatDateTime } from '@/utils/format'
import type {
  ScoreChange,
  ScoreSource,
  SummaryRoster,
  SummaryStage,
  SummaryStudent,
} from '@/types/summary'

const router = useRouter()
const auth = useAuthStore()
const reviewStore = useReviewStore()
const { can, isStudent, isAdmin } = useRole()

/** 班级名单与他人成绩只对教师 / 管理员开放 */
const canSeeClass = computed(() => can('summary.class'))

const loading = ref(true)
const roster = ref<SummaryRoster | null>(null)
const students = computed<SummaryStudent[]>(() => roster.value?.students ?? [])
const task = computed(() => roster.value?.task ?? null)

/** 页头副标题写本次实训的事实，不写功能说明——功能看按钮就懂 */
const subtitle = computed(() => {
  const info = task.value
  if (!info) return '五个环节按权重合成总分'
  return `${info.courseTitle} · ${info.lessonAt} · 任课教师 ${info.teacher}`
})

/** 'all' 只对管理员开放；教师默认锁在本节课的班 */
const classFilter = ref<number | 'all'>('all')
const activeId = ref(0)

const classOptions = computed(() => {
  const map = new Map<number, string>()
  for (const stu of students.value) map.set(stu.classId, stu.className)
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})

/** 学生本人：按学号对上号，对不上就取第一条，避免空白页 */
const selfStudents = computed<SummaryStudent[]>(() => {
  const self = students.value.find((stu) => stu.studentNo === auth.user?.studentNo)
  return self ? [self] : students.value.slice(0, 1)
})

/**
 * 导出与列表都读这里：
 * 教师 / 管理员按班级筛选；学生只有自己一行——这条边界不能只在模板里 v-if，
 * 否则「导出我的成绩」会把全班导出去。
 */
const visibleStudents = computed<SummaryStudent[]>(() => {
  if (!canSeeClass.value) return selfStudents.value
  return classFilter.value === 'all'
    ? students.value
    : students.value.filter((stu) => stu.classId === classFilter.value)
})

const active = computed(
  () => visibleStudents.value.find((s) => s.id === activeId.value) ?? visibleStudents.value[0],
)

/** 导出范围里不止一个班时才加「班级」列，单班导出不摆重复列 */
const showClassColumn = computed(
  () => new Set(visibleStudents.value.map((s) => s.classId)).size > 1,
)

const rangeLabel = computed(() => {
  if (classFilter.value === 'all') return '全部班级'
  return classOptions.value.find((opt) => opt.id === classFilter.value)?.name ?? '班级'
})

async function load(): Promise<void> {
  loading.value = true
  try {
    roster.value = await fetchSummaryRoster()
    if (canSeeClass.value) {
      // 教师的默认范围 = 本节课的班；管理员看全站
      const taskClass = roster.value.students.find(
        (s) => s.className === roster.value?.task.className,
      )
      classFilter.value = isAdmin.value || !taskClass ? 'all' : taskClass.classId
    }
    activeId.value = visibleStudents.value[0]?.id ?? 0
  } catch {
    ElMessage.error('综合评价数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 切班后如果当前选中的人不在范围内，落到该班第一人，避免右侧空白 */
watch(classFilter, () => {
  if (!visibleStudents.value.some((s) => s.id === activeId.value)) {
    activeId.value = visibleStudents.value[0]?.id ?? 0
  }
})

/* ------------------------------ 分数 ------------------------------ */

/** 教师的现场扣分（本项目里由各评价模块的「教师复核」写入） */
const deductions = computed(() => reviewStore.listBy(active.value?.id ?? 0))
const deductedPoints = computed(() => deductions.value.reduce((sum, d) => sum + d.points, 0))

function weighted(s: SummaryStudent): number {
  return Math.round(s.stages.reduce((sum, st) => sum + st.score * st.weight, 0))
}

/** AI 初评总分：与最终分并排展示，差异就是教师复核改动的部分 */
function aiTotal(s: SummaryStudent): number {
  return Math.round(s.stages.reduce((sum, st) => sum + (st.aiScore ?? st.score) * st.weight, 0))
}

/** 环节最终分：优先取教师复核分 */
function stageScore(stage: SummaryStage): number {
  return stage.reviewScore ?? stage.score
}

/** 教师复核改动超过 0 分的环节数，用于页头一句话概括 */
const reviewedDiff = computed(() => {
  const s = active.value
  if (!s) return 0
  return s.stages.filter((st) => (st.aiScore ?? st.score) !== stageScore(st)).length
})

/** 分数来源抽屉 */
const traceVisible = ref(false)
const traceStage = ref<SummaryStage | null>(null)

function openTrace(stage: SummaryStage): void {
  traceStage.value = stage
  traceVisible.value = true
}

/** 加权分扣掉教师现场分，最低 0 */
function finalScore(s: SummaryStudent): number {
  return Math.max(0, weighted(s) - reviewStore.sumBy(s.id))
}

function grade(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}

/* ------------------------------ 归档 ------------------------------ */

const archiving = ref(false)

async function confirmScore(): Promise<void> {
  const student = active.value
  if (!student) return
  if (student.confirmed) {
    ElMessage.warning(`${student.name} 的成绩已归档，归档后不再变动`)
    return
  }
  // 归档前置：必须先「确认」。没确认就归档等于替教师做决定，流程上说不通
  if ((student.reviewState ?? 'pending') !== 'confirmed') {
    ElMessage.warning(`请先点「确认」通过 ${student.name} 的成绩，再归档`)
    return
  }
  // 归档是不可逆的：冻结分数、权重版本与原始分项，必须二次确认
  const ok = await confirmAction({
    title: '归档实训成绩',
    message: `${student.name} 的最终成绩为 ${finalScore(student)} 分（${grade(finalScore(student))}）。归档后分数、权重版本与各项原始分将被冻结，后续调整权重不再追溯。`,
    confirmText: '确认归档',
    dangerous: true,
  })
  if (!ok) return

  archiving.value = true
  try {
    const at = await archiveSummary(student.id)
    student.confirmed = true
    student.archivedAt = at
    student.ruleVersion = RULE_VERSION
    student.archivedTotal = finalScore(student)
    ElMessage.success(`已归档 ${student.name} 的实训成绩 · ${at}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '归档失败，请稍后重试')
  } finally {
    archiving.value = false
  }
}

/* ------------------------------ 教师复核 ------------------------------ */

const reviewing = ref(false)

/**
 * 确认 / 驳回 / 转复核
 * ----------------------------------------------------------------------------
 * 三个动作都要落「谁、何时、为什么」，其中驳回与转复核必须写原因——
 * 学生看到「已驳回」却不知道哪里不对，只能来问老师，等于没做流程。
 */
async function doReview(action: ReviewAction): Promise<void> {
  const student = active.value
  if (!student) return
  if (student.confirmed) {
    ElMessage.warning(`${student.name} 的成绩已归档，复核状态不能再改`)
    return
  }

  let note = ''
  if (action === 'reject') {
    const reason = await askReason({
      title: `驳回 ${student.name} 的成绩`,
      message: '驳回后学生会看到这条原因，需要重新提交或补做。',
      placeholder: '例如：成品照片反光，无法判断芡汁挂壁，请重拍',
    })
    if (!reason) return
    note = reason
  }
  if (action === 'hold') {
    const reason = await askReason({
      title: `转复核：${student.name}`,
      message: '转复核表示当场定不了，留给课后或教研组；不计入「待归档」。',
      placeholder: '例如：视频时间戳对不上，需调原始录像核对',
    })
    if (!reason) return
    note = reason
  }

  reviewing.value = true
  try {
    const result = await reviewSummaryStudent(student.id, action, note)
    student.reviewState = result.reviewState
    student.reviewedAt = result.reviewedAt
    student.reviewedBy = result.reviewedBy
    student.reviewNote = note || undefined
    const labels: Record<ReviewAction, string> = {
      confirm: '已确认，可以归档',
      reject: '已驳回，原因已记录',
      hold: '已转复核，等待教研组',
    }
    ElMessage.success(`${student.name} ${labels[action]}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '复核操作失败')
  } finally {
    reviewing.value = false
  }
}

/* ------------------------------ 来源详情与改分 ------------------------------ */

const sourceVisible = ref(false)
const activeSource = ref<ScoreSource | null>(null)
const sourceScore = ref(0)
const sourceReason = ref('')
const sourceSaving = ref(false)

function openSource(source: ScoreSource): void {
  activeSource.value = source
  sourceScore.value = source.score ?? 0
  sourceReason.value = ''
  sourceVisible.value = true
}

/**
 * 改单条来源的分：改动落在最原始的一层，环节分由来源重新合成。
 * 这样「成绩修改记录」里记的永远是「某张图从 88 改成 82」，
 * 而不是「环节分莫名其妙变了 3 分」——后者无法追溯。
 */
async function saveSourceScore(): Promise<void> {
  const student = active.value
  const stage = traceStage.value
  const source = activeSource.value
  if (!student || !stage || !source) return

  if (!Number.isFinite(sourceScore.value) || sourceScore.value < 0 || sourceScore.value > 100) {
    ElMessage.warning('分数需在 0 - 100 之间')
    return
  }
  if (sourceReason.value.trim().length < 4) {
    ElMessage.warning('写清改分原因（至少 4 个字），学生申诉时要用')
    return
  }
  if ((source.score ?? 0) === sourceScore.value) {
    ElMessage.info('分数没有变化')
    return
  }

  const before = stageScore(stage)
  sourceSaving.value = true
  try {
    const result = await overrideSourceScore(
      student.id,
      stage.key,
      source.id,
      sourceScore.value,
      sourceReason.value.trim(),
    )
    source.score = sourceScore.value
    stage.score = result.stageScore
    stage.reviewScore = result.stageScore
    stage.reviewed = true

    const record: ScoreChange = {
      id: `chg_${Date.now()}`,
      at: formatDateTime(Date.now(), 'YYYY-MM-DD HH:mm'),
      by: auth.displayName,
      target: 'stage',
      stageLabel: stage.label,
      from: before,
      to: result.stageScore,
      reason: `${source.module}「${source.title}」单条改分：${sourceReason.value.trim()}`,
    }
    student.changes = [record, ...(student.changes ?? [])]

    sourceVisible.value = false
    ElMessage.success(
      `${stage.label} 由 ${before} 调整为 ${result.stageScore}，已写入成绩修改记录`,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '改分失败')
  } finally {
    sourceSaving.value = false
  }
}

/* ------------------------------ 导出 ------------------------------ */

interface ScoreRow {
  student: SummaryStudent
  weighted: number
  deduct: number
  final: number
}

/** 一行一个学生：五个环节得分 + 教师扣分 + 总分，够教务直接入库 */
const scoreColumns = computed<CsvColumn<ScoreRow>[]>(() => {
  const labels = students.value[0]?.stages.map((stage) => stage.label) ?? []
  const columns: CsvColumn<ScoreRow>[] = [
    { header: '学号', value: (row) => row.student.studentNo },
    { header: '姓名', value: (row) => row.student.name },
  ]
  if (showClassColumn.value) {
    columns.push({ header: '班级', value: (row) => row.student.className })
  }
  columns.push({ header: '工位', value: (row) => row.student.seat })
  labels.forEach((label, index) => {
    columns.push({
      header: label,
      value: (row) => row.student.stages[index]?.score ?? '',
    })
  })
  columns.push(
    { header: '加权分', value: (row) => row.weighted },
    { header: '教师扣分', value: (row) => row.deduct },
    { header: '总分', value: (row) => row.final },
    { header: '等级', value: (row) => grade(row.final) },
    { header: '状态', value: (row) => (row.student.confirmed ? '已归档' : '未归档') },
    { header: '归档时间', value: (row) => row.student.archivedAt ?? '' },
  )
  return columns
})

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

const exporting = ref(false)

async function exportScores(): Promise<void> {
  const list = visibleStudents.value
  if (!list.length) {
    ElMessage.warning('当前范围没有可导出的成绩')
    return
  }
  exporting.value = true
  try {
    const rows: ScoreRow[] = list.map((student) => {
      const deduct = reviewStore.sumBy(student.id)
      const whole = weighted(student)
      return { student, weighted: whole, deduct, final: Math.max(0, whole - deduct) }
    })
    const scope = !canSeeClass.value
      ? '我的成绩'
      : isAdmin.value && classFilter.value === 'all'
        ? '全站'
        : rangeLabel.value
    downloadCsv(safeFilename(`综合评价-${scope}-${stamp()}`), scoreColumns.value, rows)
    ElMessage.success(
      canSeeClass.value ? `已导出 ${rows.length} 名学生 · ${scope}` : '已导出你的成绩单',
    )
  } finally {
    exporting.value = false
  }
}

/** 单人报告开在新标签页：打印是整页行为，塞进当前页会把正在看的名单冲掉 */
const reportHref = computed(() => {
  const id = active.value?.id
  if (!id) return ''
  return router.resolve({ name: 'SummaryReport', params: { studentId: String(id) } }).href
})

const endpoints = [
  {
    name: '名单与得分',
    method: 'GET' as const,
    path: '/api/v1/summary/roster',
    note: '按任务返回本节课的班级与学生各环节得分；教师端据此锁定默认班级。',
    request: `GET /api/v1/summary/roster?taskId=task_20261121_01&classId=12`,
    response: `{
  "code": 0,
  "data": {
    "task": {
      "id": "task_20261121_01",
      "courseTitle": "《中式热菜制作》—— 糖醋里脊",
      "className": "烹饪工艺与营养 2301",
      "lessonAt": "2026-11-21 08:00",
      "teacher": "陈立群"
    },
    "students": [
      {
        "id": 1001,
        "name": "陈子豪",
        "studentNo": "2023010101",
        "classId": 12,
        "className": "烹饪工艺与营养 2301",
        "seat": "02",
        "confirmed": true,
        "archivedAt": "2026-11-21 09:32",
        "stages": [
          { "key": "checkin",    "label": "签到与着装", "weight": 0.15, "score": 100, "records": 1 },
          { "key": "ingredient", "label": "食材预处理", "weight": 0.20, "score": 91,  "records": 12 }
        ]
      }
    ]
  },
  "message": "ok"
}`,
  },
  {
    name: '单人报告',
    method: 'GET' as const,
    path: '/api/v1/summary/{studentId}/report',
    note: '报告页取这份数据渲染；total 为加权分，教师现场扣分由前端从复核记录合成。',
    request: `GET /api/v1/summary/1001/report?taskId=task_20261121_01`,
    response: `{
  "code": 0,
  "data": {
    "student": { "id": 1001, "name": "陈子豪", "studentNo": "2023010101" },
    "total": 91,
    "grade": "优秀",
    "task": { "id": "task_20261121_01", "courseTitle": "《中式热菜制作》—— 糖醋里脊" },
    "generatedAt": "2026-11-21 13:40"
  },
  "message": "ok"
}`,
  },
  {
    name: '归档',
    method: 'POST' as const,
    path: '/api/v1/summary/{studentId}/archive',
    note: '锁定分数并生成快照，之后调整权重不追溯；低于 60 分应先复核。',
    request: `{ "taskId": "task_20261121_01" }`,
    response: `{
  "code": 0,
  "data": { "archivedAt": "2026-11-21 09:32", "snapshotId": 88012 },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="综合评价"
    :subtitle="subtitle"
    :endpoints="endpoints"
    :ready="false"
    state-text="导出可用 · 评分待接"
    :reviewable="false"
  >
    <template #actions>
      <template v-if="canSeeClass">
        <el-button :loading="exporting" @click="exportScores">
          {{ isAdmin && classFilter === 'all' ? '导出全站成绩' : '导出班级成绩' }}
        </el-button>
        <!-- 用真链接而不是 window.open：带 noopener 的 window.open 会被拦截，
             返回 null 且没有任何提示，点了像没反应 -->
        <el-button tag="a" :href="reportHref || undefined" target="_blank" rel="noopener">
          导出当前报告
        </el-button>
        <el-button type="primary" :loading="archiving" @click="confirmScore">归档当前成绩</el-button>
      </template>
      <template v-else>
        <el-button :loading="exporting" @click="exportScores">导出我的成绩</el-button>
        <el-button
          tag="a"
          type="primary"
          :href="reportHref || undefined"
          target="_blank"
          rel="noopener"
        >
          导出我的报告
        </el-button>
      </template>
    </template>

    <!-- 学生视角：只说明能看到什么，避免让人误以为名单加载失败 -->
    <p v-if="isStudent" class="scope-line">
      <span class="status-dot" />
      这里是你的实训成绩，只含本人数据；班级排名与同学成绩不对学生开放。
    </p>

    <AppSkeleton v-if="loading" variant="list" :count="5" />

    <div v-else class="summary-grid" :class="{ 'is-solo': !canSeeClass }">
      <!-- 名单（仅教师 / 管理员） -->
      <section v-if="canSeeClass" class="app-card list-card">
        <header class="card-head">
          <div>
            <h2 class="card-head__title">班级名单</h2>
            <p class="card-head__desc">
              {{ visibleStudents.length }} 人 · {{ rangeLabel }}
            </p>
          </div>
          <el-select v-model="classFilter" size="small" class="class-filter">
            <el-option v-if="isAdmin" label="全部班级" value="all" />
            <el-option
              v-for="opt in classOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </header>

        <ul class="stu-list">
          <li
            v-for="stu in visibleStudents"
            :key="stu.id"
            class="stu"
            :class="{ 'is-active': stu.id === activeId }"
            @click="activeId = stu.id"
          >
            <div class="stu__body">
              <p class="stu__name">
                {{ stu.name }}
                <span v-if="stu.confirmed" class="stu__flag">已归档</span>
              </p>
              <span class="stu__meta num">{{ stu.studentNo }} · 工位 {{ stu.seat }}</span>
            </div>
            <div class="stu__score">
              <strong class="num">{{ finalScore(stu) }}</strong>
              <span>{{ grade(finalScore(stu)) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <!-- 详情 -->
      <section v-if="active" class="app-card detail-card">
        <header class="detail-head">
          <div>
            <h2>{{ active.name }}</h2>
            <p class="num">
              {{ active.studentNo }} · {{ active.className }} · 工位 {{ active.seat }}
            </p>
          </div>
          <div class="detail-total">
            <strong class="num">{{ finalScore(active) }}</strong>
            <span>
              {{ grade(finalScore(active)) }}
              <template v-if="active.confirmed"> · 已归档</template>
            </span>
          </div>
        </header>

        <!-- 复核状态 + 三个动作：确认 / 驳回 / 转复核（与成品页共用同一个组件） -->
        <ReviewActions
          :state="active.reviewState ?? 'pending'"
          :reviewed-by="active.reviewedBy"
          :reviewed-at="active.reviewedAt"
          :note="active.reviewNote"
          :disabled="active.confirmed"
          :can-review="can('module.review')"
          :loading="reviewing"
          @confirm="doReview('confirm')"
          @reject="doReview('reject')"
          @hold="doReview('hold')"
        />

        <!-- AI 初评 / 教师复核 / 现场扣分 / 最终：三段分开，谁改的都看得见 -->
        <dl class="score-split">
          <div>
            <dt>AI 初评</dt>
            <dd class="num">{{ aiTotal(active) }}</dd>
          </div>
          <div>
            <dt>教师复核</dt>
            <dd class="num">{{ weighted(active) }}</dd>
          </div>
          <div>
            <dt>现场扣分</dt>
            <dd class="num" :class="{ 'is-deduct': deductedPoints > 0 }">
              {{ deductedPoints > 0 ? `−${deductedPoints}` : '0' }}
            </dd>
          </div>
          <div>
            <dt>最终成绩</dt>
            <dd class="num is-strong">{{ finalScore(active) }}</dd>
          </div>
        </dl>

        <p v-if="reviewedDiff" class="review-note">
          教师复核改动了 {{ reviewedDiff }} 个环节的分数，点击环节可查看该分的来源记录。
        </p>
        <p v-else class="review-note">各环节分数与 AI 初评一致，点击环节可查看来源记录。</p>

        <ul class="stage-list">
          <li
            v-for="stage in active.stages"
            :key="stage.key"
            class="stage is-clickable"
            @click="openTrace(stage)"
          >
            <div class="stage__row">
              <span class="stage__label">{{ stage.label }}</span>
              <span class="stage__meta num">
                {{ stage.records }} 条记录 · 权重 {{ Math.round(stage.weight * 100) }}%
                <template v-if="stage.reviewed"> · 已复核</template>
              </span>
              <span class="stage__ai num" v-if="stage.aiScore !== undefined && stage.aiScore !== stageScore(stage)">
                AI {{ stage.aiScore }}
              </span>
              <span class="stage__score num">{{ stageScore(stage) }}</span>
            </div>
            <div class="stage__track">
              <div class="stage__fill" :style="{ width: `${stageScore(stage)}%` }" />
            </div>
          </li>
        </ul>

        <!-- 成绩修改记录：谁在什么时候把多少分改成了多少分 -->
        <div v-if="active.changes?.length" class="change-block">
          <header class="change-block__head">
            <h3>成绩修改记录</h3>
            <span class="num">{{ active.changes.length }} 次</span>
          </header>
          <ul class="change-block__list">
            <li v-for="change in active.changes" :key="change.id">
              <span class="change-block__time num">{{ change.at }}</span>
              <span class="change-block__who">{{ change.by }}</span>
              <span class="change-block__what">
                {{ change.stageLabel ?? '总分' }} {{ change.from }} → {{ change.to }}
              </span>
              <span class="change-block__reason">{{ change.reason }}</span>
            </li>
          </ul>
        </div>

        <!-- 教师裁量：与系统分分开展示，谁扣的分、为什么扣都写清楚 -->
        <div v-if="deductions.length" class="deduct-block">
          <header class="deduct-block__head">
            <h3>教师现场扣分</h3>
            <span class="num">合计 −{{ deductedPoints }} 分</span>
          </header>
          <ul class="deduct-block__list">
            <li v-for="d in deductions" :key="d.id">
              <span class="deduct-block__module">{{ d.moduleLabel }}</span>
              <span class="deduct-block__item">{{ d.item }}</span>
              <span class="deduct-block__reason">{{ d.reason }}</span>
              <span class="deduct-block__points num">−{{ d.points }}</span>
            </li>
          </ul>
        </div>

        <footer class="detail-foot">
          <p v-if="active.confirmed">
            已归档于 {{ active.archivedAt }}，冻结总分
            <strong class="num">{{ active.archivedTotal ?? finalScore(active) }}</strong> 分，
            规则版本 {{ active.ruleVersion ?? RULE_VERSION }}；后续调整权重不再追溯。
          </p>
          <p>
            综合分 = Σ（环节得分 × 权重）− 教师现场扣分，保留整数；当前规则版本
            {{ RULE_VERSION }}。低于 60 分需教师复核后归档。
          </p>
          <p>
            导出成绩单为 CSV（Excel 直接打开）；导出报告是 A4 打印页，在打印对话框里选「另存为 PDF」即可发给学生。
          </p>
        </footer>
      </section>
    </div>

    <!-- 分数来源：每个环节的分都能点回到具体记录 / 截图 / 事件 -->
    <el-drawer v-model="traceVisible" title="分数来源" size="440px">
      <div v-if="traceStage" class="trace">
        <header class="trace__head">
          <div>
            <h3>{{ traceStage.label }}</h3>
            <p class="num">
              权重 {{ Math.round(traceStage.weight * 100) }}% · 共 {{ traceStage.records }} 条记录
            </p>
          </div>
          <div class="trace__score">
            <span v-if="traceStage.aiScore !== undefined" class="num">AI {{ traceStage.aiScore }}</span>
            <strong class="num">{{ stageScore(traceStage) }}</strong>
          </div>
        </header>

        <ul v-if="traceStage.sources?.length" class="trace__list">
          <li v-for="source in traceStage.sources" :key="source.id" class="trace-item">
            <button type="button" class="trace-item__btn" @click="openSource(source)">
              <el-image
                v-if="source.snapshot"
                :src="source.snapshot"
                fit="cover"
                class="trace-item__shot"
              />
              <div class="trace-item__body">
                <p class="trace-item__title">
                  <span class="trace-item__module">{{ source.module }}</span>
                  {{ source.title }}
                </p>
                <p class="trace-item__detail">{{ source.detail }}</p>
                <span class="trace-item__time num">
                  {{ source.at }} · {{ source.id }}
                  <template v-if="source.score !== undefined"> · 本条第 {{ source.score }} 分</template>
                </span>
              </div>
              <el-icon class="trace-item__more"><ArrowRight /></el-icon>
            </button>
          </li>
        </ul>
        <p v-else class="trace__empty">该环节尚未回传原始记录，只有汇总分。</p>

        <p class="trace__note">
          追溯口径：环节分由这些原始记录按规则合成。点任意一条看详情；
          教师可在详情里改这一条的分，改动会写进下方「成绩修改记录」。
        </p>
      </div>
    </el-drawer>

    <!-- 来源详情：单条记录的完整信息 + 教师改分入口 -->
    <el-dialog v-model="sourceVisible" title="来源记录详情" width="620px" append-to-body>
      <div v-if="activeSource" class="source">
        <header class="source__head">
          <div>
            <p class="source__module">{{ activeSource.module }}</p>
            <h3>{{ activeSource.title }}</h3>
            <span class="source__time num">
              {{ activeSource.at }} · {{ activeSource.id }}
              <template v-if="traceStage"> · {{ traceStage.label }}</template>
            </span>
          </div>
          <div class="source__score">
            <span>本条得分</span>
            <strong class="num">{{ activeSource.score ?? '—' }}</strong>
          </div>
        </header>

        <div v-if="activeSource.snapshot" class="source__shot">
          <el-image
            :src="activeSource.snapshot"
            :preview-src-list="[activeSource.snapshot]"
            fit="cover"
            preview-teleported
          />
          <span>点击图片放大核对</span>
        </div>

        <p class="source__detail">{{ activeSource.detail }}</p>

        <dl v-if="activeSource.dimensions?.length" class="source__facts">
          <div v-for="item in activeSource.dimensions" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd class="num">{{ item.value }}</dd>
          </div>
        </dl>

        <dl v-if="activeSource.meta?.length" class="source__facts is-muted">
          <div v-for="item in activeSource.meta" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>

        <!-- 教师改分：改的是这一条，不是环节分 -->
        <section v-if="can('module.review') && !active.confirmed" class="source__edit">
          <h4>教师改分</h4>
          <p class="source__edit-hint">
            改的是这一条原始记录的分；环节分由本环节所有来源重新合成，AI 原始分保留备查。
          </p>
          <div class="source__edit-row">
            <el-input-number v-model="sourceScore" :min="0" :max="100" controls-position="right" />
            <el-input
              v-model="sourceReason"
              placeholder="改分原因（至少 4 字）"
              maxlength="60"
              class="source__reason"
            />
            <el-button type="primary" :loading="sourceSaving" @click="saveSourceScore">
              保存改分
            </el-button>
          </div>
        </section>
        <p v-else class="source__readonly">
          成绩已归档或当前账号无复核权限，此处只读。
        </p>
      </div>
    </el-dialog>
  </ModuleShell>
</template>

<style scoped lang="scss">
.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: $space-4;
  align-items: start;
}

.class-filter {
  width: 168px;
}

.list-card {
  min-width: 0;
}

.stu-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stu {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 12px 10px;
  cursor: pointer;
  border-radius: $radius-md;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-subtle;
  }

  &.is-active {
    background: $color-primary-soft;
  }

  &__body {
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
    color: $color-text-primary;
  }

  &__flag {
    padding: 1px 5px;
    margin-left: 6px;
    font-size: 10px;
    color: $color-success;
    background: $color-success-soft;
    border-radius: 3px;
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

  &__score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-left: auto;

    strong {
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    span {
      font-size: 10px;
      color: $color-text-placeholder;
    }
  }
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: $space-4;
  margin-bottom: $space-4;
  border-bottom: 1px solid $color-border-light;

  h2 {
    margin: 0;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  p {
    margin: 3px 0 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.detail-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  strong {
    font-size: 32px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    color: $color-text-primary;
    letter-spacing: -0.03em;
  }

  span {
    margin-top: 4px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stage {
  &__row {
    display: flex;
    align-items: baseline;
    gap: $space-2;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__meta {
    margin-left: auto;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__score {
    width: 28px;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    text-align: right;
  }

  &__track {
    height: 4px;
    margin-top: 7px;
    overflow: hidden;
    background: $color-bg-sunken;
    border-radius: 2px;
  }

  &__fill {
    height: 100%;
    background: $color-text-primary;
    border-radius: 2px;
    transition: width 600ms $ease-emphasized;
  }
}

.detail-foot {
  padding-top: $space-4;
  margin-top: $space-5;
  border-top: 1px solid $color-border-light;

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.7;
    color: $color-text-placeholder;

    & + p {
      margin-top: 3px;
    }
  }
}

.score-split {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-2;
  padding: $space-3 0;
  margin: 0 0 $space-3;
  border-bottom: 1px solid $color-border-light;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 3px 0 0;
    font-size: $font-size-md;
    color: $color-text-regular;

    &.is-strong {
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    &.is-deduct {
      color: $color-danger;
    }
  }
}

.review-note {
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  color: $color-text-placeholder;
}

.stage__ai {
  margin-left: auto;
  font-size: 10.5px;
  color: $color-text-placeholder;
}

.stage.is-clickable {
  padding: 6px 8px;
  margin: 0 -8px;
  cursor: pointer;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-subtle;
  }
}

.change-block {
  padding-top: $space-4;
  margin-top: $space-5;
  border-top: 1px solid $color-border-light;

  &__head {
    display: flex;
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
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }

  &__list {
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px $space-2;
      align-items: baseline;
      padding: 7px 0;
      font-size: $font-size-xs;
      border-top: 1px solid $color-border-light;
    }
  }

  &__time {
    flex-shrink: 0;
    color: $color-text-placeholder;
  }

  &__who {
    flex-shrink: 0;
    color: $color-text-regular;
  }

  &__what {
    flex-shrink: 0;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__reason {
    flex: 1;
    min-width: 160px;
    color: $color-text-placeholder;
  }
}

.trace {
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: $space-4;
    border-bottom: 1px solid $color-border-light;

    h3 {
      margin: 0;
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }

  &__score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;

    span {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    strong {
      font-size: $font-size-xl;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__list {
    padding: 0;
    margin: $space-3 0 0;
    list-style: none;
  }

  &__empty {
    padding: $space-6 0;
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-placeholder;
    text-align: center;
  }

  &__note {
    padding-top: $space-4;
    margin: $space-4 0 0;
    font-size: 11px;
    line-height: 1.7;
    color: $color-text-placeholder;
    border-top: 1px solid $color-border-light;
  }
}

.trace-item {
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
  }

  /* 整行可点：进详情弹窗。button 包一层是为了键盘可达与正确的点击区域 */
  &__btn {
    display: flex;
    gap: $space-3;
    width: 100%;
    padding: $space-3 4px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: $radius-sm;
    transition: background-color $duration-fast $ease-standard;

    &:hover {
      background: $color-bg-subtle;
    }

    &:focus-visible {
      outline: 2px solid $color-primary;
      outline-offset: -2px;
    }
  }

  &__shot {
    flex: 0 0 88px;
    width: 88px;
    height: 66px;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-sm;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__module {
    margin-right: 6px;
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &__detail {
    margin: 3px 0 0;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-regular;
  }

  &__time {
    display: block;
    margin-top: 3px;
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &__more {
    flex: 0 0 auto;
    align-self: center;
    font-size: 12px;
    color: $color-text-placeholder;
  }
}

/* ------------------------------ 来源详情弹窗 ------------------------------ */

.source {
  &__head {
    display: flex;
    gap: $space-4;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: $space-3;
    border-bottom: 1px solid $color-border-light;

    h3 {
      margin: 2px 0 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__module {
    margin: 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__time {
    display: block;
    margin-top: 3px;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;

    span {
      font-size: 10.5px;
      color: $color-text-placeholder;
    }

    strong {
      font-size: 26px;
      font-weight: $font-weight-semibold;
      line-height: 1.1;
      color: $color-text-primary;
    }
  }

  &__shot {
    margin-top: $space-3;

    :deep(.el-image) {
      width: 100%;
      max-height: 240px;
      border-radius: $radius-sm;
    }

    span {
      display: block;
      margin-top: 4px;
      font-size: 10.5px;
      color: $color-text-placeholder;
    }
  }

  &__detail {
    margin: $space-3 0 0;
    font-size: $font-size-sm;
    line-height: 1.7;
    color: $color-text-regular;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: $space-3;
    padding: $space-3;
    margin: $space-3 0 0;
    background: $color-bg-subtle;
    border-radius: $radius-sm;

    dt {
      font-size: 10.5px;
      color: $color-text-placeholder;
    }

    dd {
      margin: 2px 0 0;
      font-size: $font-size-sm;
      color: $color-text-primary;
    }

    &.is-muted dd {
      color: $color-text-secondary;
    }
  }

  &__edit {
    padding-top: $space-3;
    margin-top: $space-3;
    border-top: 1px solid $color-border-light;

    h4 {
      margin: 0;
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__edit-hint {
    margin: 3px 0 $space-2;
    font-size: 11px;
    line-height: 1.6;
    color: $color-text-placeholder;
  }

  &__edit-row {
    display: flex;
    gap: $space-2;
    align-items: center;
  }

  &__reason {
    flex: 1;
  }

  &__readonly {
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ---------- 角色差异 ---------- */

.scope-line {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 9px 12px;
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-md;
}

.summary-grid.is-solo {
  grid-template-columns: minmax(0, 1fr);
}

/* ---------- 教师扣分 ---------- */

.deduct-block {
  padding-top: $space-4;
  margin-top: $space-5;
  border-top: 1px solid $color-border-light;

  &__head {
    display: flex;
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
      font-size: $font-size-xs;
      color: $color-danger;
    }
  }

  &__list {
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      gap: $space-2;
      align-items: baseline;
      padding: 7px 0;
      border-top: 1px solid $color-border-light;
      font-size: $font-size-xs;
    }
  }

  &__module {
    flex-shrink: 0;
    width: 76px;
    color: $color-text-placeholder;
  }

  &__item {
    flex-shrink: 0;
    color: $color-text-regular;
  }

  &__reason {
    flex: 1;
    overflow: hidden;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__points {
    flex-shrink: 0;
    font-weight: $font-weight-medium;
    color: $color-danger;
  }
}
</style>
