<script setup lang="ts">
/**
 * 学生实训档案
 * ----------------------------------------------------------------------------
 * 一页回答四个问题：这个学生练过什么、每次怎么扣的分、有没有进步、老师说过什么。
 * 权限是硬边界：学生只能看本人（路由带别人的 id 直接给无权限态，不发请求）；
 * 教师按花名册范围查看。
 *
 * 趋势图用 SVG 手写：一条折线 + 四个刻度就够，引入图表库只为画七个点不划算。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import { fetchStudentArchive } from '@/api/archive'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { mockStudents } from '@/mock/students'
import { topIssues } from '@/mock/archive'
import { formatDateTime } from '@/utils/format'
import { PRACTICE_TYPE_LABEL } from '@/types/archive'
import type { ArchiveSession, PracticeType, StudentArchive } from '@/types/archive'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const reviewStore = useReviewStore()
const { isStudent, can } = useRole()

/** 学生本人对应的花名册 id：用学号对上号，对不上就没有档案可看 */
const selfId = computed(
  () => mockStudents.find((stu) => stu.studentNo === auth.user?.studentNo)?.id ?? 0,
)

const routeId = computed(() => {
  const raw = route.params.studentId
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
})

/** 学生只能看本人；教师未带 id 时默认看「在评学生」，与评价模块选人保持一致 */
const activeId = computed(() => {
  if (isStudent.value) return selfId.value
  return routeId.value || reviewStore.activeStudent.id
})

const forbidden = computed(() => isStudent.value && activeId.value !== selfId.value)

const loading = ref(true)
const error = ref('')
const archive = ref<StudentArchive | null>(null)

/** 筛选：学期 / 课程 / 实训类型 */
const semester = ref('')
const course = ref('')
const type = ref<PracticeType | ''>('')

const filtered = computed<ArchiveSession[]>(() => {
  const list = archive.value?.sessions ?? []
  return list.filter((item) => {
    if (semester.value && item.semester !== semester.value) return false
    if (course.value && item.courseTitle !== course.value) return false
    if (type.value && item.type !== type.value) return false
    return true
  })
})

const issues = computed(() => topIssues(filtered.value))
const latestComment = computed(() => filtered.value.at(-1)?.comment ?? '')

/* ------------------------------ 趋势图 ------------------------------ */

const CHART = { width: 620, height: 200, padX: 34, padY: 22, min: 50, max: 100 }

const chartPoints = computed(() => {
  const list = [...filtered.value].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  if (!list.length) return []
  const span = Math.max(list.length - 1, 1)
  const innerW = CHART.width - CHART.padX * 2
  const innerH = CHART.height - CHART.padY * 2
  return list.map((item, index) => {
    const x = CHART.padX + (index / span) * innerW
    const ratio = (item.total - CHART.min) / (CHART.max - CHART.min)
    const y = CHART.height - CHART.padY - Math.max(0, Math.min(1, ratio)) * innerH
    return { x, y, item }
  })
})

const chartPath = computed(() =>
  chartPoints.value.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
)

const chartArea = computed(() => {
  const points = chartPoints.value
  if (!points.length) return ''
  const base = CHART.height - CHART.padY
  return `${chartPath.value} L${points.at(-1)!.x.toFixed(1)},${base} L${points[0].x.toFixed(1)},${base} Z`
})

const gridLines = [100, 80, 60].map((value) => ({
  value,
  y: CHART.height - CHART.padY - ((value - CHART.min) / (CHART.max - CHART.min)) * (CHART.height - CHART.padY * 2),
}))

/* ------------------------------ 加载 ------------------------------ */

async function load(): Promise<void> {
  if (forbidden.value) {
    loading.value = false
    return
  }
  if (!activeId.value) {
    loading.value = false
    error.value = '没有找到与当前账号对应的学生档案'
    return
  }
  loading.value = true
  error.value = ''
  try {
    archive.value = await fetchStudentArchive(activeId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '档案加载失败'
    archive.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(activeId, () => {
  semester.value = ''
  course.value = ''
  type.value = ''
  void load()
})

/** 教师换学生：写进路由，刷新/分享链接都能回到同一个人 */
function switchStudent(id: number): void {
  void router.replace({ name: 'StudentArchive', params: { studentId: String(id) } })
}

function reportHref(id: number): string {
  return router.resolve({ name: 'SummaryReport', params: { studentId: String(id) } }).href
}

const typeOptions = Object.entries(PRACTICE_TYPE_LABEL).map(([value, label]) => ({ value, label }))
</script>

<template>
  <div>
    <PageHeader
      title="实训档案"
      :subtitle="
        archive
          ? `${archive.student.className} · ${archive.student.studentNo} · 共 ${archive.summary.count} 次实训`
          : '历次实训的分项得分、问题与教师评语'
      "
      :back-to="isStudent ? undefined : '/dashboard'"
    >
      <template #actions>
        <el-select
          v-if="!isStudent"
          :model-value="activeId"
          filterable
          class="student-select"
          placeholder="选择学生"
          @change="switchStudent"
        >
          <el-option
            v-for="stu in mockStudents"
            :key="stu.id"
            :label="`${stu.name} · ${stu.studentNo}`"
            :value="stu.id"
          />
        </el-select>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <StateView v-if="forbidden" state="forbidden" description="学生只能查看本人的实训档案" />
    <StateView v-else-if="loading" state="loading" />
    <StateView
      v-else-if="error"
      state="error"
      :description="error"
      @retry="load"
    />

    <template v-else-if="archive">
      <!-- 基本信息 + 汇总 -->
      <section class="app-card profile">
        <div class="profile__who">
          <el-avatar :size="44" :src="archive.student.facePhoto">
            {{ archive.student.name.slice(0, 1) }}
          </el-avatar>
          <div>
            <h2>{{ archive.student.name }}</h2>
            <p class="num">
              {{ archive.student.studentNo }} · {{ archive.student.className }} · 工位
              {{ archive.student.seat }}
            </p>
          </div>
        </div>

        <dl class="profile__stats">
          <div>
            <dt>实训次数</dt>
            <dd class="num">{{ archive.summary.count }}</dd>
          </div>
          <div>
            <dt>平均分</dt>
            <dd class="num">{{ archive.summary.average }}</dd>
          </div>
          <div>
            <dt>最高分</dt>
            <dd class="num">{{ archive.summary.best }}</dd>
          </div>
          <div>
            <dt>及格率</dt>
            <dd class="num">{{ Math.round(archive.summary.passRate * 100) }}%</dd>
          </div>
          <div>
            <dt>最近变化</dt>
            <dd class="num" :class="archive.summary.trend >= 0 ? 'is-up' : 'is-down'">
              {{ archive.summary.trend >= 0 ? '+' : '' }}{{ archive.summary.trend }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- 筛选 -->
      <div class="filters">
        <el-select v-model="semester" size="small" placeholder="全部学期" clearable class="filters__sel">
          <el-option v-for="item in archive.semesters" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="course" size="small" placeholder="全部课程" clearable class="filters__sel filters__sel--wide">
          <el-option v-for="item in archive.courses" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="type" size="small" placeholder="全部类型" clearable class="filters__sel">
          <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <span class="filters__count num">共 {{ filtered.length }} 次</span>
      </div>

      <div class="archive-grid">
        <!-- 趋势 -->
        <section class="app-card">
          <header class="card-head">
            <h2>成绩趋势</h2>
            <span class="card-head__hint">综合分 · 已归档与未归档同图对比</span>
          </header>

          <svg
            v-if="chartPoints.length"
            class="chart"
            :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
            role="img"
            aria-label="历次实训综合成绩趋势"
          >
            <g class="chart__grid">
              <line
                v-for="line in gridLines"
                :key="line.value"
                :x1="CHART.padX"
                :x2="CHART.width - CHART.padX"
                :y1="line.y"
                :y2="line.y"
              />
              <text
                v-for="line in gridLines"
                :key="`t-${line.value}`"
                :x="CHART.padX - 8"
                :y="line.y + 3"
                text-anchor="end"
              >
                {{ line.value }}
              </text>
            </g>

            <path :d="chartArea" class="chart__area" />
            <path :d="chartPath" class="chart__line" />

            <g v-for="(point, index) in chartPoints" :key="point.item.id">
              <circle :cx="point.x" :cy="point.y" r="3.4" class="chart__dot" />
              <text :x="point.x" :y="point.y - 9" text-anchor="middle" class="chart__value">
                {{ point.item.total }}
              </text>
              <text
                :x="point.x"
                :y="CHART.height - 4"
                text-anchor="middle"
                class="chart__label"
              >
                {{ formatDateTime(point.item.finishedAt, 'MM-DD') }}
              </text>
              <title>{{ formatDateTime(point.item.finishedAt, 'YYYY-MM-DD') }} · {{ point.item.total }} 分</title>
              <circle
                v-if="index === chartPoints.length - 1"
                :cx="point.x"
                :cy="point.y"
                r="7"
                class="chart__pulse"
              />
            </g>
          </svg>
          <StateView
            v-else
            state="empty"
            compact
            description="当前筛选条件下没有实训记录，趋势图无法生成"
          />
        </section>

        <!-- 常见问题 + 评语 -->
        <section class="app-card">
          <header class="card-head">
            <h2>常见问题</h2>
            <span class="card-head__hint">按出现次数排序</span>
          </header>

          <ul v-if="issues.length" class="issue-list">
            <li v-for="item in issues" :key="item.label">
              <span class="issue-list__label">{{ item.label }}</span>
              <span class="issue-list__count num">{{ item.count }} 次</span>
            </li>
          </ul>
          <p v-else class="empty-line">筛选范围内没有扣分记录</p>

          <div v-if="latestComment" class="comment">
            <h3>最近一次评语</h3>
            <p>{{ latestComment }}</p>
            <footer>{{ filtered.at(-1)?.teacher }} · {{ formatDateTime(filtered.at(-1)?.finishedAt, 'YYYY-MM-DD') }}</footer>
          </div>
        </section>
      </div>

      <!-- 历次实训 -->
      <section class="app-card">
        <header class="card-head">
          <h2>历次实训</h2>
          <span class="card-head__hint">展开可看五项得分、当时的问题与评语</span>
        </header>

        <StateView
          v-if="!filtered.length"
          state="empty"
          compact
          description="当前筛选条件下没有实训记录"
        />

        <el-table v-else :data="filtered" size="small" row-key="id" class="table">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand">
                <ul class="expand__stages">
                  <li v-for="stage in row.stages" :key="stage.key">
                    <span class="expand__label">{{ stage.label }}</span>
                    <span class="expand__bar">
                      <i :style="{ width: `${stage.score}%` }" />
                    </span>
                    <span class="expand__score num">{{ stage.score }}</span>
                    <span class="expand__weight num">权重 {{ Math.round(stage.weight * 100) }}%</span>
                  </li>
                </ul>

                <div class="expand__side">
                  <p v-if="row.issues.length" class="expand__issues">
                    <span>本次问题</span>
                    {{ row.issues.join('、') }}
                  </p>
                  <p v-else class="expand__issues is-ok">
                    <span>本次问题</span>
                    无扣分项
                  </p>
                  <p class="expand__comment">{{ row.comment }}</p>
                  <p class="expand__teacher">{{ row.teacher }} · 评语</p>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="实训" min-width="220">
            <template #default="{ row }">
              <p class="cell-title">{{ row.courseTitle }}</p>
              <span class="cell-sub">{{ row.dish }} · {{ row.taskId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="96">
            <template #default="{ row }">{{ PRACTICE_TYPE_LABEL[row.type as PracticeType] }}</template>
          </el-table-column>
          <el-table-column label="完成时间" width="150">
            <template #default="{ row }">
              <span class="num">{{ formatDateTime(row.finishedAt, 'YYYY-MM-DD HH:mm') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="综合分" width="110">
            <template #default="{ row }">
              <strong class="num">{{ row.total }}</strong>
              <span class="cell-sub">{{ row.grade }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <span class="cell-state" :class="row.archived ? 'is-ok' : 'is-pending'">
                {{ row.archived ? '已归档' : '待归档' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="can('archive.others') || isStudent"
                text
                size="small"
                tag="a"
                :href="reportHref(archive.student.id)"
                target="_blank"
                rel="noopener"
              >
                报告
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.student-select {
  width: 200px;
}

.profile {
  display: flex;
  flex-wrap: wrap;
  gap: $space-4;
  align-items: center;
  justify-content: space-between;

  &__who {
    display: flex;
    gap: $space-3;
    align-items: center;

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

  &__stats {
    display: flex;
    gap: $space-6;
    margin: 0;

    dt {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    dd {
      margin: 3px 0 0;
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;

      &.is-up {
        color: $color-success;
      }

      &.is-down {
        color: $color-danger;
      }
    }
  }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  align-items: center;
  margin: $space-4 0;

  &__sel {
    width: 132px;

    &--wide {
      width: 240px;
    }
  }

  &__count {
    margin-left: auto;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.archive-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: $space-4;
  margin-bottom: $space-4;
}

.chart {
  width: 100%;
  height: auto;

  &__grid line {
    stroke: $color-border-light;
    stroke-width: 1;
  }

  &__grid text {
    font-size: 9px;
    fill: $color-text-placeholder;
  }

  &__area {
    fill: rgba(47, 84, 235, 0.07);
    stroke: none;
  }

  &__line {
    fill: none;
    stroke: $color-primary;
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  &__dot {
    fill: $color-bg-surface;
    stroke: $color-primary;
    stroke-width: 1.8;
  }

  &__pulse {
    fill: none;
    stroke: rgba(47, 84, 235, 0.28);
    stroke-width: 1.4;
  }

  &__value {
    font-size: 9px;
    font-weight: 600;
    fill: $color-text-regular;
  }

  &__label {
    font-size: 8.5px;
    fill: $color-text-placeholder;
  }
}

.issue-list {
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-3;
    padding: 8px 0;
    border-top: 1px solid $color-border-light;

    &:first-child {
      border-top: 0;
    }
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__count {
    flex-shrink: 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.comment {
  padding-top: $space-4;
  margin-top: $space-4;
  border-top: 1px solid $color-border-light;

  h3 {
    margin: 0 0 4px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  p {
    margin: 0;
    font-size: $font-size-sm;
    line-height: 1.8;
    color: $color-text-regular;
  }

  footer {
    margin-top: 4px;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.table {
  width: 100%;
}

.cell-title {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-primary;
}

.cell-sub {
  display: block;
  font-size: 11px;
  color: $color-text-placeholder;
}

.cell-state {
  font-size: 11px;

  &.is-ok {
    color: $color-success;
  }

  &.is-pending {
    color: $color-warning;
  }
}

.expand {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: $space-5;
  padding: $space-3 $space-5;

  &__stages {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      gap: $space-2;
      align-items: center;
    }
  }

  &__label {
    flex-shrink: 0;
    width: 78px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__bar {
    flex: 1;
    height: 4px;
    overflow: hidden;
    background: $color-bg-sunken;
    border-radius: 2px;

    i {
      display: block;
      height: 100%;
      background: $color-text-primary;
      border-radius: 2px;
    }
  }

  &__score {
    width: 26px;
    font-size: $font-size-xs;
    text-align: right;
    color: $color-text-primary;
  }

  &__weight {
    width: 58px;
    font-size: 10px;
    text-align: right;
    color: $color-text-placeholder;
  }

  &__issues {
    margin: 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-regular;

    span {
      margin-right: 6px;
      color: $color-text-placeholder;
    }

    &.is-ok {
      color: $color-success;
    }
  }

  &__comment {
    margin: $space-2 0 0;
    font-size: $font-size-xs;
    line-height: 1.8;
    color: $color-text-secondary;
  }

  &__teacher {
    margin: 4px 0 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.empty-line {
  padding: $space-5 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

@media (max-width: 1280px) {
  .archive-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .expand {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
