<script setup lang="ts">
/**
 * 单人实训报告（/modules/summary/report/:studentId）
 * ----------------------------------------------------------------------------
 * 这是一个「打印页」而不是后台页面：没有侧栏、没有浮空助手，只有一张 A4。
 * 教师导出班级报告、学生导出自己的报告，走的都是这里。
 *
 * 为什么不直接在前端拼 PDF：中文字体嵌进 canvas 拼 PDF 只有两种结果——
 * 要么包体里塞进几 MB 字体文件，要么用系统字体但打印出来发虚。
 * 浏览器自带的打印引擎排中文最稳，另存为 PDF 的分页、字距都可控。
 *
 * 学生只能打开自己的那份：URL 里的 id 与本人学号不一致时直接拦下，
 * 提示「无权查看」，不泄露任何分数。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { fetchSummaryReport } from '@/api/summary'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useReviewStore } from '@/stores/review'
import { printWithTitle } from '@/utils/export'
import type { SummaryReportData } from '@/types/summary'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const reviewStore = useReviewStore()
const { isStudent } = useRole()

const loading = ref(true)
const error = ref('')
const report = ref<SummaryReportData | null>(null)

const studentId = Number(route.params.studentId)

const deductions = computed(() => reviewStore.listBy(studentId))
const deductedPoints = computed(() => deductions.value.reduce((sum, d) => sum + d.points, 0))
/** 加权分之和，用于在表里显示「这一行贡献了多少分」 */
function stageContribution(score: number, weight: number): string {
  return (score * weight).toFixed(1)
}

const finalScore = computed(() => Math.max(0, (report.value?.total ?? 0) - deductedPoints.value))

const finalGrade = computed(() => {
  const score = finalScore.value
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
})

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function doPrint(): void {
  if (!report.value) return
  printWithTitle(`${report.value.student.name}-实训报告-${stamp()}`)
}

function goBack(): void {
  // 新标签页里没有历史记录时退回综合评价页，不要把人留在空白页
  if (window.history.length > 1) router.back()
  else void router.push('/modules/summary')
}

onMounted(async () => {
  if (!Number.isFinite(studentId) || studentId <= 0) {
    error.value = '报告编号不正确'
    loading.value = false
    return
  }
  try {
    const data = await fetchSummaryReport(studentId)
    if (isStudent.value && data.student.studentNo !== auth.user?.studentNo) {
      error.value = '这份报告不属于当前账号'
      return
    }
    report.value = data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '报告加载失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="report-page">
    <!-- 工具条：打印时隐藏 -->
    <div class="toolbar">
      <button type="button" class="toolbar__back" @click="goBack">返回综合评价</button>
      <span class="toolbar__hint">在打印对话框里把目标打印机选为「另存为 PDF」即可保存</span>
      <button type="button" class="toolbar__print" :disabled="!report" @click="doPrint">
        打印 / 另存为 PDF
      </button>
    </div>

    <p v-if="loading" class="report-state">正在生成报告…</p>
    <div v-else-if="error" class="report-state">
      <strong>{{ error }}</strong>
      <button type="button" class="report-state__link" @click="goBack">返回综合评价</button>
    </div>

    <article v-else-if="report" class="sheet">
      <header class="sheet__head">
        <div>
          <p class="sheet__org">烹饪工艺与营养实训中心</p>
          <h1 class="sheet__title">实训过程评价报告</h1>
        </div>
        <div class="sheet__no">
          <span>报告编号</span>
          <strong>{{ report.task.id }}-{{ report.student.studentNo }}</strong>
        </div>
      </header>

      <section class="meta">
        <dl>
          <div><dt>学生姓名</dt><dd>{{ report.student.name }}</dd></div>
          <div><dt>学号</dt><dd class="num">{{ report.student.studentNo }}</dd></div>
          <div><dt>班级</dt><dd>{{ report.student.className }}</dd></div>
          <div><dt>工位</dt><dd class="num">{{ report.student.seat }}</dd></div>
          <div><dt>实训课程</dt><dd>{{ report.task.courseTitle }}</dd></div>
          <div><dt>实训时间</dt><dd class="num">{{ report.task.lessonAt }}</dd></div>
          <div><dt>任课教师</dt><dd>{{ report.task.teacher }}</dd></div>
          <div><dt>生成时间</dt><dd class="num">{{ report.generatedAt }}</dd></div>
        </dl>
      </section>

      <section class="result">
        <div class="result__score">
          <span class="result__label">综合成绩</span>
          <strong class="num">{{ finalScore }}</strong>
        </div>
        <div class="result__grade">
          <span class="result__label">等级</span>
          <strong>{{ finalGrade }}</strong>
        </div>
        <div class="result__deduct">
          <span class="result__label">教师现场扣分</span>
          <strong class="num">{{ deductedPoints > 0 ? `−${deductedPoints}` : '0' }}</strong>
        </div>
      </section>

      <section class="block">
        <h2 class="block__title">分环节得分</h2>
        <table class="table">
          <thead>
            <tr>
              <th>评价环节</th>
              <th class="is-num">权重</th>
              <th class="is-num">记录数</th>
              <th class="is-num">环节得分</th>
              <th class="is-num">加权得分</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stage in report.student.stages" :key="stage.key">
              <td>{{ stage.label }}</td>
              <td class="is-num num">{{ Math.round(stage.weight * 100) }}%</td>
              <td class="is-num num">{{ stage.records }}</td>
              <td class="is-num num">{{ stage.score }}</td>
              <td class="is-num num">{{ stageContribution(stage.score, stage.weight) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">加权合计（四舍五入）</td>
              <td class="is-num num">{{ report.total }}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section v-if="deductions.length" class="block">
        <h2 class="block__title">教师现场扣分明细</h2>
        <table class="table">
          <thead>
            <tr>
              <th>环节</th>
              <th>扣分项</th>
              <th>说明</th>
              <th class="is-num">时间</th>
              <th class="is-num">扣分</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in deductions" :key="d.id">
              <td>{{ d.moduleLabel }}</td>
              <td>{{ d.item }}</td>
              <td class="is-soft">{{ d.reason }}</td>
              <td class="is-num num">{{ d.at }}</td>
              <td class="is-num num">−{{ d.points }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="block block--note">
        <h2 class="block__title">计分说明</h2>
        <p>综合成绩 = Σ（环节得分 × 权重）− 教师现场扣分，保留整数。</p>
        <p>环节得分由各评价模块生成，教师现场扣分单独记录，两者不合并计算，便于追溯。</p>
        <p>本报告不含视频文件；视频按数据保留周期在服务器清理，需要复核请在系统内查看。</p>
      </section>

      <footer class="sign">
        <div class="sign__item">任课教师<span /></div>
        <div class="sign__item">教研组长<span /></div>
        <div class="sign__item">日期<span /></div>
      </footer>

      <p class="sheet__foot">本报告由烹饪实训过程评价系统生成，加盖公章后可作为实训成绩凭证。</p>
    </article>
  </div>
</template>

<style scoped lang="scss">
.report-page {
  min-height: 100vh;
  padding: 24px 24px 64px;
  background: $color-bg-page;
}

.toolbar {
  display: flex;
  gap: $space-3;
  align-items: center;
  max-width: 820px;
  padding: 0 2px;
  margin: 0 auto $space-4;

  &__back,
  &__print {
    font-family: inherit;
    font-size: $font-size-sm;
    cursor: pointer;
    border-radius: $radius-md;
    transition: background-color $duration-fast $ease-standard,
      border-color $duration-fast $ease-standard;
  }

  &__back {
    padding: 7px 12px;
    color: $color-text-regular;
    background: transparent;
    border: 1px solid $color-border;

    &:hover {
      background: $color-bg-surface;
      border-color: $color-border-strong;
    }
  }

  &__hint {
    flex: 1;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-align: right;
  }

  &__print {
    padding: 7px 16px;
    font-weight: $font-weight-medium;
    color: #fff;
    background: $color-primary;
    border: 1px solid $color-primary;

    &:hover {
      background: $color-primary-hover;
      border-color: $color-primary-hover;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}

.report-state {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  align-items: center;
  max-width: 820px;
  padding: 64px 24px;
  margin: 0 auto;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__link {
    font-family: inherit;
    font-size: $font-size-sm;
    color: $color-primary;
    cursor: pointer;
    background: none;
    border: none;
  }
}

/* ---------------- A4 纸张 ---------------- */

.sheet {
  max-width: 820px;
  padding: 48px 52px 40px;
  margin: 0 auto;
  color: #18181b;
  background: #fff;
  border: 1px solid $color-border-light;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 2px solid #18181b;
  }

  &__org {
    margin: 0 0 6px;
    font-size: 12px;
    color: #52525b;
    letter-spacing: 0.04em;
  }

  &__title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &__no {
    text-align: right;

    span {
      display: block;
      font-size: 11px;
      color: #71717a;
    }

    strong {
      font-family: $font-family-mono;
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  }

  &__foot {
    margin: 20px 0 0;
    font-size: 11px;
    color: #71717a;
    text-align: center;
  }
}

.meta {
  margin-top: 20px;

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 32px;
    margin: 0;
  }

  div {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding-bottom: 6px;
    border-bottom: 1px solid #e4e4e7;
  }

  dt {
    flex: 0 0 68px;
    font-size: 12px;
    color: #71717a;
  }

  dd {
    margin: 0;
    font-size: 13px;
    color: #18181b;
  }
}

.result {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 1px;
  margin-top: 24px;
  overflow: hidden;
  background: #e4e4e7;
  border: 1px solid #e4e4e7;

  & > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 18px;
    background: #fff;
  }

  &__label {
    font-size: 11px;
    color: #71717a;
  }

  strong {
    font-size: 20px;
    font-weight: 600;
    line-height: 1;
  }

  &__score strong {
    font-size: 34px;
    letter-spacing: -0.02em;
  }

  &__deduct strong {
    color: #b91c1c;
  }
}

.block {
  margin-top: 26px;

  &__title {
    padding-left: 9px;
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    border-left: 3px solid #18181b;
  }

  &--note p {
    margin: 0 0 4px;
    font-size: 11.5px;
    line-height: 1.75;
    color: #52525b;
  }
}

.table {
  width: 100%;
  font-size: 12.5px;
  border-collapse: collapse;

  th,
  td {
    padding: 8px 10px;
    text-align: left;
    border: 1px solid #e4e4e7;
  }

  th {
    font-weight: 500;
    color: #52525b;
    background: #f4f4f5;
  }

  tfoot td {
    font-weight: 600;
    background: #fafafa;
  }

  .is-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .is-soft {
    color: #71717a;
  }
}

.sign {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  margin-top: 40px;

  &__item {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    font-size: 12px;
    color: #52525b;

    span {
      flex: 1;
      height: 22px;
      border-bottom: 1px solid #a1a1aa;
    }
  }
}

/* ---------------- 打印 ---------------- */

@page {
  size: A4;
  // 16mm 上下会在内容超 1px 时挤到第二页；14mm 留出约 1.5cm 余量，
  // 激光打印机本身的不可打印边距也吞得下
  margin: 14mm;
}

@media print {
  .toolbar {
    display: none !important;
  }

  .report-page {
    // 屏幕上的 100vh 在打印时等于整页高度，加上 @page 边距必然溢出到第二页
    min-height: 0;
    padding: 0;
    background: #fff;
  }

  .sheet {
    max-width: none;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  // 打印时纵向节奏收紧一档，和屏幕上的呼吸感分开处理
  .block {
    margin-top: 20px;
  }

  .result {
    margin-top: 18px;
  }

  .sign {
    margin-top: 26px;
  }

  .block,
  .result,
  .sign {
    break-inside: avoid;
  }

  .table tr {
    break-inside: avoid;
  }
}

@media (max-width: 720px) {
  .report-page {
    padding: 16px 12px 48px;
  }

  .toolbar {
    &__hint {
      display: none;
    }
  }

  .sheet {
    padding: 28px 20px 24px;
  }

  .meta dl {
    grid-template-columns: minmax(0, 1fr);
  }

  .result {
    grid-template-columns: minmax(0, 1fr);
  }

  .sign {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
}
</style>
