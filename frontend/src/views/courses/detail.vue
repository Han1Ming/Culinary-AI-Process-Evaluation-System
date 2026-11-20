<script setup lang="ts">
/**
 * 课程详情 · 读菜谱
 * ----------------------------------------------------------------------------
 * 学生端的主线：收到菜谱 → 自己先看一遍 → 让 AI 读一遍 → 拿着难点与易错点进操作间。
 *
 * 为什么难点要「标注到步骤上」而不是给一段总结：
 * 学生站在操作台前是按步骤走的，把提示挂在步骤旁边，他走到第 3 步才会抬头看第 3 步；
 * 一段总结看完就忘，挂在步骤上才是可用的。
 *
 * 教师进同一页看到的是预览视图（没有自己给自己点评的意义），
 * 但可以看到学生将看到的完整解析结果，用于对齐讲评重点。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { analyzeRecipe, fetchCourse, fetchRecipeDoc } from '@/api/course'
import { useRole } from '@/composables/useRole'
import { formatDateTime } from '@/utils/format'
import type { Course, RecipeAnalysis, RecipeDoc, RecipeInsight } from '@/types'

const route = useRoute()
const router = useRouter()
const { isStudent } = useRole()

const courseId = computed(() => Number(route.params.id))

const course = ref<Course | null>(null)
const doc = ref<RecipeDoc | null>(null)
const loading = ref(true)
const loadError = ref('')

const analysis = ref<RecipeAnalysis | null>(null)
const analyzing = ref(false)

/** 当前聚焦的步骤，用于点击解析条目后高亮 */
const focusStep = ref<number | null>(null)
const stepRefs = ref<Record<number, HTMLElement | null>>({})

onMounted(async () => {
  try {
    const [c, d] = await Promise.all([fetchCourse(courseId.value), fetchRecipeDoc(courseId.value)])
    course.value = c
    doc.value = d
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '课程加载失败'
  } finally {
    loading.value = false
  }
})

/* ---------------- AI 解读 ---------------- */

const difficulties = computed(
  () => analysis.value?.insights.filter((i) => i.kind === 'difficulty') ?? [],
)
const pitfalls = computed(
  () => analysis.value?.insights.filter((i) => i.kind === 'pitfall') ?? [],
)

/** 每个步骤挂了哪些提示，用于正文里的小标记 */
function insightsOfStep(step: number): RecipeInsight[] {
  return analysis.value?.insights.filter((i) => i.step === step) ?? []
}

async function runAnalysis(): Promise<void> {
  if (analyzing.value) return
  analyzing.value = true
  try {
    analysis.value = await analyzeRecipe(courseId.value)
    ElMessage.success('AI 已读完这份菜谱，难点已标注到对应步骤')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '解析失败，请稍后重试')
  } finally {
    analyzing.value = false
  }
}

async function jumpTo(insight: RecipeInsight): Promise<void> {
  if (!insight.step) return
  focusStep.value = insight.step
  await nextTick()
  stepRefs.value[insight.step]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function setStepRef(step: number, el: unknown): void {
  stepRefs.value[step] = (el as HTMLElement) ?? null
}

function back(): void {
  void router.push('/courses')
}

function kindLabel(kind: RecipeInsight['kind']): string {
  return kind === 'difficulty' ? '难点' : '易错'
}
</script>

<template>
  <div class="course-detail">
    <button type="button" class="back" @click="back">
      <el-icon><ArrowLeft /></el-icon>
      课程管理
    </button>

    <p v-if="loadError" class="load-error">{{ loadError }}</p>

    <template v-else-if="course && doc">
      <!-- 课程头 -->
      <header class="course-head">
        <div class="course-head__main">
          <p class="course-head__date num">
            {{ formatDateTime(course.lessonAt, 'YYYY-MM-DD HH:mm') }} · {{ course.className }}
          </p>
          <h1 class="course-head__title">{{ course.title }}</h1>
          <p class="course-head__dishes">
            <span v-for="dish in course.dishes" :key="dish">{{ dish }}</span>
          </p>
          <p class="course-head__goal">{{ course.goal }}</p>
        </div>
        <div class="course-head__file">
          <span class="course-head__file-name">{{ course.fileName }}</span>
          <span class="course-head__file-tip">
            {{ course.fileUrl ? '教师上传的原件' : '后端解析后的结构化菜谱' }}
          </span>
        </div>
      </header>

      <div class="detail-grid">
        <!-- 菜谱正文 -->
        <article class="sheet">
          <template v-if="course.fileUrl">
            <iframe class="sheet__pdf" :src="course.fileUrl" title="菜谱 PDF" />
          </template>

          <template v-else>
            <header class="sheet__head">
              <h2>{{ doc.title }}</h2>
              <p class="sheet__std">{{ doc.standard }} · {{ doc.meta }}</p>
            </header>

            <section class="sheet__block">
              <h3 class="sheet__label">配料</h3>
              <table class="ing-table">
                <tbody>
                  <tr v-for="ing in doc.ingredients" :key="ing.name">
                    <th scope="row">{{ ing.name }}</th>
                    <td class="num">{{ ing.amount }}</td>
                    <td class="ing-table__note">{{ ing.note || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="sheet__block">
              <h3 class="sheet__label">操作步骤</h3>
              <ol class="step-list">
                <li
                  v-for="step in doc.steps"
                  :key="step.index"
                  :ref="(el) => setStepRef(step.index, el)"
                  class="step"
                  :class="{ 'is-focus': focusStep === step.index }"
                >
                  <span class="step__no num">{{ step.index }}</span>
                  <div class="step__body">
                    <p class="step__text">{{ step.text }}</p>
                    <p class="step__meta">
                      <span v-if="step.minutes" class="num">约 {{ step.minutes }} 分钟</span>
                      <span v-if="step.control">{{ step.control }}</span>
                    </p>

                    <!-- 解析结果标注在步骤旁边，走到这一步才看得到 -->
                    <div v-if="insightsOfStep(step.index).length" class="step__marks">
                      <span
                        v-for="ins in insightsOfStep(step.index)"
                        :key="ins.id"
                        class="mark"
                        :class="`is-${ins.kind}`"
                      >
                        {{ kindLabel(ins.kind) }} · {{ ins.title }}
                      </span>
                    </div>
                  </div>
                </li>
              </ol>
            </section>
          </template>
        </article>

        <!-- AI 解析 -->
        <aside class="insight-panel">
          <header class="insight-panel__head">
            <h2>AI 菜谱解读</h2>
            <p v-if="!analysis">把难点与易错点标注到对应步骤</p>
            <p v-else>生成于 {{ analysis.at }} · 共 {{ analysis.insights.length }} 条</p>
          </header>

          <!-- 未解析 -->
          <div v-if="!analysis && !analyzing" class="insight-idle">
            <p class="insight-idle__text">
              {{ isStudent
                ? '建议自己先把菜谱读一遍，再让 AI 讲——先有判断，才看得懂哪里会错。'
                : '教师视角预览：点下方按钮可以看到学生将收到的完整解析。' }}
            </p>
            <el-button type="primary" class="insight-idle__btn" @click="runAnalysis">
              让 AI 读一遍
            </el-button>
            <span class="insight-idle__tip">约 3 秒，按操作顺序逐条标注</span>
          </div>

          <!-- 解析中 -->
          <div v-else-if="analyzing" class="insight-loading">
            <span class="sk sk-line" />
            <span class="sk sk-line" style="width: 82%" />
            <span class="sk sk-line" style="width: 64%" />
            <span class="sk sk-line" style="width: 88%" />
            <span class="sk sk-line" style="width: 46%" />
            <p>正在通读配料与步骤…</p>
          </div>

          <!-- 结果 -->
          <div v-else class="insight-body">
            <p class="insight-summary">{{ analysis?.summary }}</p>

            <section v-if="difficulties.length" class="insight-group">
              <h3 class="insight-group__title">难点 <span class="num">{{ difficulties.length }}</span></h3>
              <ul class="insight-list">
                <li
                  v-for="item in difficulties"
                  :key="item.id"
                  class="insight"
                  @click="jumpTo(item)"
                >
                  <span v-if="item.step" class="insight__step num">步骤 {{ item.step }}</span>
                  <p class="insight__title">{{ item.title }}</p>
                  <p class="insight__detail">{{ item.detail }}</p>
                  <p class="insight__advice">{{ item.advice }}</p>
                </li>
              </ul>
            </section>

            <section v-if="pitfalls.length" class="insight-group">
              <h3 class="insight-group__title">易错点 <span class="num">{{ pitfalls.length }}</span></h3>
              <ul class="insight-list">
                <li
                  v-for="item in pitfalls"
                  :key="item.id"
                  class="insight"
                  @click="jumpTo(item)"
                >
                  <span v-if="item.step" class="insight__step num">步骤 {{ item.step }}</span>
                  <p class="insight__title">{{ item.title }}</p>
                  <p class="insight__detail">{{ item.detail }}</p>
                  <p class="insight__advice">{{ item.advice }}</p>
                </li>
              </ul>
            </section>

            <el-button class="insight-body__again" text @click="runAnalysis">重新解读</el-button>
          </div>
        </aside>
      </div>
    </template>

    <div v-else class="loading-wrap">
      <span class="sk sk-line" style="width: 220px" />
      <span class="sk sk-line" style="width: 320px" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.course-detail {
  // 外层 DefaultLayout 已给出 20px 24px 32px 的内容区留白，这里不再叠加
  min-width: 0;
}

.back {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 0;
  margin-bottom: $space-3;
  font-family: inherit;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  cursor: pointer;
  background: none;
  border: 0;

  &:hover {
    color: $color-text-primary;
  }
}

.load-error {
  padding: 56px 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  text-align: center;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 24px;
}

/* ---------- 课程头 ---------- */

.course-head {
  display: flex;
  flex-wrap: wrap;
  gap: $space-4;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: $space-4;
  border-bottom: 1px solid $color-border-light;

  &__date {
    margin: 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__title {
    margin: 6px 0 0;
    font-size: 24px;
    font-weight: $font-weight-semibold;
    line-height: 1.3;
    color: $color-text-primary;
    letter-spacing: -0.02em;
  }

  &__dishes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;

    span {
      padding: 2px 8px;
      font-size: 11.5px;
      color: $color-text-regular;
      background: $color-bg-subtle;
      border-radius: $radius-sm;
    }
  }

  &__goal {
    max-width: 720px;
    margin: 10px 0 0;
    font-size: $font-size-sm;
    line-height: 1.7;
    color: $color-text-secondary;
  }

  &__file {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }

  &__file-name {
    font-size: $font-size-xs;
    color: $color-text-regular;
  }

  &__file-tip {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

/* ---------- 布局 ---------- */

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: $space-5;
  align-items: start;
  padding-top: $space-5;
}

/* ---------- 文档 ---------- */

.sheet {
  padding: 36px 40px 40px;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__pdf {
    width: 100%;
    height: 720px;
    border: 0;
  }

  &__head {
    padding-bottom: $space-4;
    margin-bottom: $space-4;
    border-bottom: 1px solid $color-border-light;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
      letter-spacing: -0.01em;
    }
  }

  &__std {
    margin: 6px 0 0;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__block + &__block {
    margin-top: $space-5;
  }

  &__label {
    margin: 0 0 $space-3;
    font-size: 11px;
    font-weight: $font-weight-medium;
    color: $color-text-placeholder;
    letter-spacing: 0.06em;
  }
}

.ing-table {
  width: 100%;
  font-size: $font-size-sm;
  border-collapse: collapse;

  th,
  td {
    padding: 8px 0;
    text-align: left;
    border-bottom: 1px solid $color-border-light;
  }

  th {
    width: 110px;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  td {
    color: $color-text-regular;
  }

  &__note {
    color: $color-text-placeholder !important;
    font-size: $font-size-xs;
  }
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: 0;
  margin: 0;
  list-style: none;
}

.step {
  display: flex;
  gap: $space-3;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: $radius-md;
  transition:
    background-color $duration-base $ease-standard,
    border-color $duration-base $ease-standard;

  &__no {
    display: grid;
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    font-size: 11px;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: 50%;
    place-items: center;
  }

  &__body {
    min-width: 0;
  }

  &__text {
    margin: 0;
    font-size: $font-size-sm;
    line-height: 1.85;
    color: $color-text-primary;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 6px 0 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__marks {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 9px;
  }

  &.is-focus {
    background: $color-primary-soft;
    border-color: rgba(47, 84, 235, 0.24);
  }
}

.mark {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 11.5px;
  line-height: 1.6;
  color: $color-text-regular;

  &::before {
    width: 4px;
    height: 4px;
    content: '';
    background: $color-text-placeholder;
    border-radius: 50%;
  }

  &.is-pitfall::before {
    background: $color-danger;
  }

  &.is-difficulty::before {
    background: $color-text-secondary;
  }
}

/* ---------- 解析面板 ---------- */

.insight-panel {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - #{$header-height} - 96px);
  overflow-y: auto;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__head {
    padding: 16px 18px 12px;
    border-bottom: 1px solid $color-border-light;

    h2 {
      margin: 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }
}

.insight-idle {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  align-items: flex-start;
  padding: 18px;

  &__text {
    margin: 0;
    font-size: $font-size-xs;
    line-height: 1.8;
    color: $color-text-secondary;
  }

  &__btn {
    width: 100%;
  }

  &__tip {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.insight-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;

  p {
    margin: 6px 0 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.insight-body {
  padding: 16px 18px 20px;

  &__again {
    padding: 0;
    margin-top: $space-3;
  }
}

.insight-summary {
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  line-height: 1.85;
  color: $color-text-regular;
}

.insight-group {
  & + & {
    margin-top: $space-4;
  }

  &__title {
    display: flex;
    gap: 6px;
    align-items: baseline;
    margin: 0 0 $space-2;
    font-size: 11px;
    font-weight: $font-weight-medium;
    color: $color-text-placeholder;
    letter-spacing: 0.06em;

    span {
      color: $color-text-secondary;
    }
  }
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.insight {
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  transition:
    border-color $duration-fast $ease-standard,
    background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-subtle;
    border-color: $color-border-strong;
  }

  &__step {
    display: block;
    margin-bottom: 3px;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__title {
    margin: 0;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    line-height: 1.6;
    color: $color-text-primary;
  }

  &__detail {
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.75;
    color: $color-text-secondary;
  }

  &__advice {
    padding-top: 5px;
    margin: 6px 0 0;
    font-size: 11px;
    line-height: 1.75;
    color: $color-text-regular;
    border-top: 1px dashed $color-border-light;
  }
}

@media (max-width: 1280px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .insight-panel {
    position: static;
    max-height: none;
  }
}
</style>
