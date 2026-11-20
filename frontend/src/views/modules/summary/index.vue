<script setup lang="ts">
/**
 * AI 综合评价
 * ----------------------------------------------------------------------------
 * 把前五个模块的结果按权重合成总分。左侧是班级名单，右侧是选中学生的
 * 分环节拆分——教师复核时关心的不是总分，而是「这一分是怎么来的」。
 *
 * 角色差异：学生只看到自己的报告（看不到班级名单，也看不到别人的分数），
 * 教师与管理员才有名单、复核、归档与导出。教师的现场扣分单独一段展示，
 * 不和 AI 分数混在一起，避免「这一分谁给的」说不清。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'

interface StageScore {
  key: string
  label: string
  weight: number
  score: number
  /** 该环节的原始记录数，用于说明数据来源 */
  records: number
}

interface StudentReport {
  id: number
  name: string
  studentNo: string
  className: string
  stages: StageScore[]
  confirmed: boolean
}

function build(
  id: number,
  name: string,
  studentNo: string,
  className: string,
  scores: number[],
  confirmed = false,
): StudentReport {
  const labels = ['签到与着装', '食材预处理', '烹饪过程', '菜肴成品', '课堂问答']
  const weights = [0.15, 0.2, 0.3, 0.3, 0.05]
  return {
    id,
    name,
    studentNo,
    className,
    confirmed,
    stages: labels.map((label, i) => ({
      key: `s${i}`,
      label,
      weight: weights[i],
      score: scores[i],
      records: [1, 12, 6, 1, 4][i],
    })),
  }
}

const students = ref<StudentReport[]>([
  build(1001, '陈子豪', '2023010101', '烹饪工艺与营养 2301', [100, 91, 88, 90, 95], true),
  build(1002, '李思影', '2023010102', '烹饪工艺与营养 2301', [100, 86, 92, 87, 80]),
  build(1003, '王皓然', '2023010128', '西餐工艺 2302', [92, 78, 74, 82, 70]),
  build(1004, '赵一诺', '2023010133', '烹饪工艺与营养 2301', [100, 95, 90, 93, 88], true),
  build(1005, '周与同', '2023010140', '西餐工艺 2302', [85, 70, 66, 74, 60]),
  build(1006, '吴思远', '2023010142', '烹饪工艺与营养 2301', [100, 88, 84, 86, 92]),
])

const activeId = ref(1001)
const active = computed(() => students.value.find((s) => s.id === activeId.value) ?? students.value[0])

const auth = useAuthStore()
const reviewStore = useReviewStore()
const { can, isStudent } = useRole()

/** 班级名单与他人成绩只对教师 / 管理员开放 */
const canSeeClass = computed(() => can('summary.class'))

/** 学生本人：按学号对上号，对不上就取第一条，避免空白页 */
const selfStudent = computed(
  () => students.value.find((s) => s.studentNo === auth.user?.studentNo) ?? students.value[0],
)

onMounted(() => {
  if (!canSeeClass.value) activeId.value = selfStudent.value.id
})

/** 教师的现场扣分（本项目里由各评价模块的「教师复核」写入） */
const deductions = computed(() => reviewStore.listBy(active.value?.id ?? 0))
const deductedPoints = computed(() => deductions.value.reduce((sum, d) => sum + d.points, 0))

function total(s: StudentReport): number {
  return Math.round(s.stages.reduce((sum, st) => sum + st.score * st.weight, 0))
}

/** 扣分后的最终分，最低 0 */
function finalScore(s: StudentReport): number {
  return Math.max(0, total(s) - reviewStore.sumBy(s.id))
}

function grade(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}

function confirmScore(): void {
  if (!active.value) return
  active.value.confirmed = true
  ElMessage.success(`已归档 ${active.value.name} 的实训成绩`)
}

const endpoints = [
  {
    name: '生成报告',
    method: 'POST' as const,
    path: '/api/modules/summary/report',
    note: '汇总各模块结果并按权重计算总分，同时生成可下载的报告文件。',
    request: `{
  "task_id": "task_20261120_01",
  "student_id": 1001,
  "rubric_id": 3
}`,
    response: `{
  "code": 0,
  "data": {
    "total": 91,
    "grade": "优秀",
    "stages": [
      { "key": "face",       "score": 100, "weight": 0.15 },
      { "key": "ingredient", "score": 91,  "weight": 0.20 }
    ],
    "report_url": "https://oss.example.com/report/1001.pdf"
  },
  "message": "ok"
}`,
  },
  {
    name: '班级统计',
    method: 'GET' as const,
    path: '/api/modules/summary/class',
    note: '按班级查平均分、分布与异常学生，用于教研复盘。',
    request: `{
  "class_id": 12,
  "task_id": "task_20261120_01"
}`,
    response: `{
  "code": 0,
  "data": {
    "avg": 82.4,
    "pass_rate": 0.94,
    "distribution": { "excellent": 6, "good": 18, "medium": 9, "fail": 2 },
    "low_score_students": [1005]
  },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="AI 综合评价"
    subtitle="汇总各环节结果，按权重生成个人实训成绩"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
    :reviewable="false"
  >
    <template #actions>
      <template v-if="canSeeClass">
        <el-button @click="confirmScore">归档当前成绩</el-button>
        <el-button type="primary">导出班级成绩</el-button>
      </template>
      <el-button v-else>导出我的报告</el-button>
    </template>

    <!-- 学生视角：只说明能看到什么，避免让人误以为名单加载失败 -->
    <p v-if="isStudent" class="scope-line">
      <span class="status-dot" />
      这里是你的实训成绩，只含本人数据；班级排名与同学成绩不对学生开放。
    </p>

    <div class="summary-grid" :class="{ 'is-solo': !canSeeClass }">
      <!-- 名单（仅教师 / 管理员） -->
      <section v-if="canSeeClass" class="app-card list-card">
        <header class="card-head">
          <h2>班级名单</h2>
          <span class="card-head__hint">{{ students.length }} 人 · 烹饪工艺与营养 2301</span>
        </header>

        <ul class="stu-list">
          <li
            v-for="stu in students"
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
              <span class="stu__meta num">{{ stu.studentNo }} · {{ stu.className }}</span>
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
            <p class="num">{{ active.studentNo }} · {{ active.className }}</p>
          </div>
          <div class="detail-total">
            <strong class="num">{{ finalScore(active) }}</strong>
            <span>
              {{ grade(finalScore(active)) }}
              <template v-if="deductedPoints > 0"> · 教师扣 {{ deductedPoints }} 分</template>
            </span>
          </div>
        </header>

        <ul class="stage-list">
          <li v-for="stage in active.stages" :key="stage.key" class="stage">
            <div class="stage__row">
              <span class="stage__label">{{ stage.label }}</span>
              <span class="stage__meta num">权重 {{ Math.round(stage.weight * 100) }}%</span>
              <span class="stage__score num">{{ stage.score }}</span>
            </div>
            <div class="stage__track">
              <div class="stage__fill" :style="{ width: `${stage.score}%` }" />
            </div>
          </li>
        </ul>

        <!-- 教师裁量：与 AI 分数分开展示，谁扣的分、为什么扣都写清楚 -->
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
          <p>综合分 = Σ（环节得分 × 权重）− 教师现场扣分，保留整数；低于 60 分需教师复核后归档。</p>
        </footer>
      </section>
    </div>
  </ModuleShell>
</template>

<style scoped lang="scss">
.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: $space-4;
  align-items: start;
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
