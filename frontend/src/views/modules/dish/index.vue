<script setup lang="ts">
/**
 * 菜肴成品分析
 * ----------------------------------------------------------------------------
 * 学生拍照 → 上传（带进度）→ 多模态评分 → 五维分数 + 理由 + 改进建议。
 * 三条硬规则：
 *   1. 上传前校验格式 / 大小，失败给出原因，不静默丢弃；
 *   2. 教师可改分，但必须写原因，AI 原始分一直保留在页面上；
 *   3. 明确写出「照片判不了口味、内部熟度与食品安全」，不越界。
 *
 * 教师视角：预览区是学生提交的那张图，教师只负责复核与改分。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import ReviewActions from '@/components/ReviewActions.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { analyzeDish, fetchDishHistory, overrideDish, reviewDish } from '@/api/dish'
import type { DishReviewAction } from '@/api/dish'
import { uploadFile } from '@/api/file'
import { useRole } from '@/composables/useRole'
import { useReviewStore } from '@/stores/review'
import { askReason } from '@/utils/confirm'
import { formatDateTime } from '@/utils/format'
import { IMAGE_RULE, compressImageBlob, formatFileSize, validateFile } from '@/utils/upload'
import { dishGrade } from '@/types/dish'
import type { DishAnalysis, DishDimension, DishRecord } from '@/types/dish'
import type { ReviewState } from '@/types/summary'
import dishSample from '@/assets/images/dish-plated.jpg'

const { can } = useRole()
const reviewStore = useReviewStore()

const isReviewing = computed(() => can('module.review'))
const target = computed(() => reviewStore.activeStudent)

/** 成品类扣分项：摆盘、卫生、与标准菜不符，模型给分之后由教师校正 */
const reviewItems = [
  { label: '餐具边缘有汤汁 / 指印', points: 3 },
  { label: '摆盘与标准图差异明显', points: 2 },
  { label: '成品温度不足（出餐超时）', points: 4 },
  { label: '与指定菜肴不符', points: 8 },
  { label: '份量明显偏离标准', points: 3 },
  { label: '灶台未清理', points: 2 },
]

const previewUrl = ref('')
const fileInput = ref<HTMLInputElement>()
const uploaded = ref<{ fileId: string; name: string; size: number } | null>(null)
const uploading = ref(false)
const uploadPercent = ref(0)

const analyzing = ref(false)
const analysis = ref<DishAnalysis | null>(null)
const recordId = ref('')

const editing = ref(false)
const draft = ref<DishDimension[]>([])
const saving = ref(false)

/* ---------------- 复核状态（确认 / 驳回 / 转复核） ---------------- */
const reviewState = ref<ReviewState>('pending')
const reviewedAt = ref('')
const reviewedBy = ref('')
const reviewNote = ref('')
const reviewingDish = ref(false)

async function doReview(action: DishReviewAction): Promise<void> {
  if (!recordId.value) {
    ElMessage.warning('还没有可复核的分析记录')
    return
  }
  let note = ''
  if (action === 'reject') {
    const reason = await askReason({
      title: '驳回这次成品分析',
      message: '驳回后学生需要重新拍摄上传，原因会显示在学生的成品页。',
      placeholder: '例如：照片反光，芡汁挂壁判断不成立，请补拍侧角度',
    })
    if (!reason) return
    note = reason
  }
  if (action === 'hold') {
    const reason = await askReason({
      title: '转复核',
      message: '转复核表示当场定不了，留给课后或教研组，不计入待归档。',
      placeholder: '例如：需要对照标准样菜再定摆盘分',
    })
    if (!reason) return
    note = reason
  }

  reviewingDish.value = true
  try {
    const result = await reviewDish(recordId.value, action, note)
    reviewState.value = result.reviewState
    reviewedAt.value = result.reviewedAt
    reviewedBy.value = result.reviewedBy
    reviewNote.value = note
    const labels: Record<DishReviewAction, string> = {
      confirm: '已确认这次分析结果',
      reject: '已驳回，学生需重新上传',
      hold: '已转复核，等待教研组',
    }
    ElMessage.success(labels[action])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '复核操作失败')
  } finally {
    reviewingDish.value = false
  }
}

const history = ref<DishRecord[]>([])
const historyLoading = ref(false)

const dims = computed<DishDimension[]>(() => (editing.value ? draft.value : analysis.value?.dimensions ?? []))
const total = computed(() =>
  editing.value
    ? Math.round(draft.value.reduce((sum, item) => sum + item.score * item.weight, 0))
    : analysis.value?.total ?? 0,
)
const grade = computed(() => (total.value ? dishGrade(total.value) : '—'))

function pickFile(): void {
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const invalid = validateFile(file, IMAGE_RULE)
  if (invalid) {
    ElMessage.warning(invalid)
    return
  }

  uploading.value = true
  uploadPercent.value = 0
  try {
    const compressed = await compressImageBlob(file, 1600, 0.82)
    if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(compressed)

    const form = new File([compressed], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
    uploaded.value = await uploadFile(form, {
      onProgress: (percent) => {
        uploadPercent.value = percent
      },
    })
    resetAnalysis()
    ElMessage.success(`已上传 ${formatFileSize(form.size)}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败，请重试')
    previewUrl.value = ''
    uploaded.value = null
  } finally {
    uploading.value = false
  }
}

function useSample(): void {
  previewUrl.value = dishSample
  uploaded.value = { fileId: 'file_sample', name: 'dish-plated.jpg', size: 0 }
  resetAnalysis()
}

function removeImage(): void {
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  uploaded.value = null
  resetAnalysis()
}

function resetAnalysis(): void {
  analysis.value = null
  editing.value = false
  draft.value = []
  recordId.value = ''
}

/** 换人时换图并清空结果：上一个学生的评分挂在新学生名下是最容易出错的一类 bug */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
    uploaded.value = null
    resetAnalysis()
    void loadHistory()
  },
)

async function analyze(): Promise<void> {
  if (!uploaded.value) {
    ElMessage.warning('请先上传菜品照片')
    return
  }
  analyzing.value = true
  try {
    const result = await analyzeDish(
      {
        fileId: uploaded.value.fileId,
        taskId: 'task_20261121_01',
        studentId: target.value.id,
      },
      target.value.id,
    )
    analysis.value = result
    recordId.value = `dish_${target.value.id}_${Date.now()}`
    editing.value = false
    // 新的一次分析 = 新的复核对象，上一份的确认/驳回不能带过来
    reviewState.value = 'pending'
    reviewedAt.value = ''
    reviewedBy.value = ''
    reviewNote.value = ''
    ElMessage.success(`分析完成：${result.total} 分（${result.grade}）`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '分析失败，请稍后重试')
  } finally {
    analyzing.value = false
  }
}

function startEdit(): void {
  if (!analysis.value) return
  draft.value = analysis.value.dimensions.map((item) => ({ ...item }))
  editing.value = true
}

function cancelEdit(): void {
  editing.value = false
  draft.value = []
}

async function saveOverride(): Promise<void> {
  if (!analysis.value) return
  const reason = await askReason({
    title: '修改评分原因',
    message: 'AI 原始分数会保留，教师复核结果单独记录，归档以复核结果为准。',
    placeholder: '例如：盘边有指印，摆盘扣 3 分',
  })
  if (!reason) return

  saving.value = true
  try {
    await overrideDish(recordId.value, {
      dimensions: draft.value.map((item) => ({ key: item.key, score: item.score })),
      remark: analysis.value.remark,
      reason,
    })
    analysis.value = {
      ...analysis.value,
      dimensions: draft.value.map((item) => ({ ...item })),
      total: total.value,
      grade: dishGrade(total.value),
      remark: `${analysis.value.remark}\n\n教师复核（${reason}）：复核后总分 ${total.value} 分。`,
    }
    editing.value = false
    ElMessage.success('复核结果已保存，AI 原始分已保留')
    await loadHistory()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadHistory(): Promise<void> {
  historyLoading.value = true
  try {
    history.value = await fetchDishHistory(target.value.id)
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

onMounted(loadHistory)

const endpoints = [
  {
    name: '文件上传',
    method: 'POST' as const,
    path: '/api/v1/files',
    note: '先传图拿 fileId，再调分析接口；multipart 上传，前端显示百分比进度。校验：JPG / PNG / WebP，≤ 4MB，一次 1 张。',
    request: `FormData { file: <jpeg, 长边已压到 1600px> }`,
    response: `{ "code": 0, "data": { "fileId": "file_20261121_01", "url": "https://oss.example.com/dish/01.jpg", "name": "dish.jpg", "size": 286720 } }`,
  },
  {
    name: '成品评分',
    method: 'POST' as const,
    path: '/api/v1/dish/analyze',
    note: '五维分数必须带 reason 与 advice，前端直接展示；不准只返回总分。',
    request: `{
  "fileId": "file_20261121_01",
  "taskId": "task_20261121_01",
  "studentId": 1001,
  "rubricId": 3
}`,
    response: `{
  "code": 0,
  "data": {
    "total": 88,
    "grade": "良好",
    "generatedAt": "2026-11-21 11:32",
    "modelVersion": "vision-dish-v2.4",
    "dimensions": [
      { "key": "appearance", "label": "食材外观", "weight": 0.25, "score": 90, "reason": "挂糊均匀……", "advice": "复炸火候降一档" }
    ],
    "remark": "成品整体完成度较高……"
  }
}`,
  },
  {
    name: '教师改分',
    method: 'PUT' as const,
    path: '/api/v1/dish/{id}/override',
    note: 'AI 原始结果不覆盖；复核结果、原因、操作人单独入库。',
    request: `{ "dimensions": [{ "key": "plating", "score": 82 }], "remark": "……", "reason": "盘边有指印，摆盘扣 3 分" }`,
    response: `{ "code": 0, "data": { "id": "dish_...", "total": 85, "reviewed": true } }`,
  },
  {
    name: '教师复核',
    method: 'POST' as const,
    path: '/api/v1/dish/{id}/review',
    note: '确认 / 驳回 / 转复核三动作；驳回与转复核必须带 note，原因回传给学生会看到。',
    request: `{ "action": "reject", "note": "照片反光，芡汁挂壁判断不成立，请补拍侧角度" }`,
    response: `{ "code": 0, "data": { "reviewState": "rejected", "reviewedAt": "2026-11-22 15:10", "reviewedBy": "陈立群" } }`,
  },
  {
    name: '历史查询',
    method: 'GET' as const,
    path: '/api/v1/dish/history',
    note: '按学生 + 任务查询；学生只能查本人，教师按授权范围。',
    request: `GET /api/v1/dish/history?studentId=1001&page=1&pageSize=10`,
    response: `{ "code": 0, "data": [{ "id": "dish_01", "dish": "糖醋里脊", "total": 88, "grade": "良好", "at": "2026-11-21 11:32", "reviewed": true }] }`,
  },
]
</script>

<template>
  <ModuleShell
    title="菜肴成品分析"
    subtitle="拍照上传成品菜，从五个维度给出评分、理由与改进建议"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button v-if="!isReviewing" :disabled="uploading" @click="useSample">载入示例</el-button>
      <el-button
        v-if="!isReviewing"
        :disabled="uploading || analyzing"
        @click="pickFile"
      >
        选择照片
      </el-button>
      <el-button type="primary" :loading="analyzing" @click="analyze">
        {{ analyzing ? '分析中…' : '开始分析' }}
      </el-button>
    </template>

    <div class="dish-grid">
      <!-- 上传与预览 -->
      <section class="app-card upload">
        <div
          class="upload__stage"
          :class="{ 'is-empty': !previewUrl, 'is-locked': isReviewing }"
          @click="isReviewing || uploading ? undefined : pickFile()"
        >
          <img v-if="previewUrl" :src="previewUrl" alt="待分析的菜品照片" class="upload__img" />

          <div v-else class="upload__hint">
            <p>{{ isReviewing ? `${target.name} 尚未提交成品照片` : '点击选择菜品照片' }}</p>
            <span>
              支持 {{ IMAGE_RULE.typeLabel }}，单张 ≤ {{ IMAGE_RULE.maxSizeMB }}MB；
              建议自然光下俯拍，画面只保留餐盘
            </span>
            <span v-if="!isReviewing" class="upload__mobile">手机端可直接调起相机拍摄</span>
          </div>

          <div v-if="analyzing" class="upload__scan" aria-hidden="true" />
        </div>

        <!-- 上传进度 -->
        <div v-if="uploading" class="upload__progress">
          <el-progress :percentage="uploadPercent" :stroke-width="4" :show-text="false" />
          <span class="num">上传中 {{ uploadPercent }}%</span>
        </div>

        <footer class="upload__bar">
          <template v-if="isReviewing">
            <span class="upload__name">{{ target.name }} · 学号 {{ target.studentNo }}</span>
          </template>
          <template v-else>
            <button type="button" class="link-btn" :disabled="uploading" @click="pickFile">重新选择</button>
            <button
              v-if="previewUrl"
              type="button"
              class="link-btn is-danger"
              :disabled="uploading"
              @click="removeImage"
            >
              删除
            </button>
            <span v-if="uploaded" class="upload__name num">
              {{ uploaded.name }}<template v-if="uploaded.size"> · {{ formatFileSize(uploaded.size) }}</template>
            </span>
          </template>
        </footer>

        <input
          v-if="!isReviewing"
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          class="upload__file"
          @change="onFile"
        />
      </section>

      <!-- 评分 -->
      <section class="app-card score-card">
        <header class="card-head">
          <h2>{{ isReviewing ? `${target.name} · 评分结果` : '评分结果' }}</h2>
          <div class="score-card__right">
            <span class="score-card__total num">
              {{ analysis || editing ? total : '—' }}
              <em>总分</em>
            </span>
            <span v-if="analysis || editing" class="score-card__grade">{{ grade }}</span>
          </div>
        </header>

        <ReviewActions
          v-if="analysis"
          :state="reviewState"
          :reviewed-by="reviewedBy"
          :reviewed-at="reviewedAt"
          :note="reviewNote"
          :can-review="can('module.review')"
          :loading="reviewingDish"
          @confirm="doReview('confirm')"
          @reject="doReview('reject')"
          @hold="doReview('hold')"
        />

        <ul v-if="dims.length" class="dim-list">
          <li v-for="dim in dims" :key="dim.key" class="dim">
            <div class="dim__head">
              <span class="dim__label">{{ dim.label }}</span>
              <span v-if="editing" class="dim__edit">
                <el-input-number v-model="dim.score" :min="0" :max="100" size="small" controls-position="right" />
              </span>
              <span v-else class="dim__score num">{{ dim.score }}</span>
            </div>
            <div class="dim__track">
              <div class="dim__fill" :style="{ width: `${dim.score}%` }" />
            </div>
            <p class="dim__reason">{{ dim.reason }}</p>
            <p class="dim__advice">改进：{{ dim.advice }}</p>
            <span class="dim__weight">权重 {{ Math.round(dim.weight * 100) }}%</span>
          </li>
        </ul>
        <p v-else class="score-empty">上传照片后点击「开始分析」，五个维度的分数与理由会显示在这里</p>

        <footer v-if="analysis" class="score-foot">
          <span class="num">
            生成于 {{ formatDateTime(analysis.generatedAt, 'YYYY-MM-DD HH:mm') }} · 模型
            {{ analysis.modelVersion }}
          </span>
          <div v-if="can('module.review')" class="score-foot__actions">
            <template v-if="editing">
              <el-button size="small" :disabled="saving" @click="cancelEdit">取消</el-button>
              <el-button size="small" type="primary" :loading="saving" @click="saveOverride">
                保存复核
              </el-button>
            </template>
            <el-button v-else size="small" @click="startEdit">修改分数</el-button>
          </div>
        </footer>
      </section>
    </div>

    <section v-if="analysis" class="app-card">
      <header class="card-head">
        <h2>评语</h2>
        <span class="card-head__hint">
          由多模态模型生成<template v-if="can('module.review')">，教师可改分并保留 AI 原始结果</template>
        </span>
      </header>
      <p class="remark">{{ analysis.remark }}</p>
      <p class="disclaimer">
        说明：照片分析只能评价外观与呈现，<strong>不能</strong>判断真实口味、内部熟度与食品安全；
        相关结论以现场品评与教师复核为准。
      </p>
    </section>

    <!-- 历史 -->
    <section class="app-card">
      <header class="card-head">
        <h2>历史成品评价</h2>
        <span class="card-head__hint">共 {{ history.length }} 次</span>
      </header>

      <p v-if="historyLoading" class="history-empty">正在加载…</p>
      <p v-else-if="!history.length" class="history-empty">还没有历史记录</p>
      <ul v-else class="history">
        <li v-for="item in history" :key="item.id" class="history-row">
          <el-image :src="item.image" fit="cover" class="history-row__img" />
          <div class="history-row__body">
            <p class="history-row__dish">
              {{ item.dish }}
              <span v-if="item.reviewed" class="history-row__flag">已复核</span>
            </p>
            <span class="history-row__meta num">{{ item.at }} · {{ item.id }}</span>
          </div>
          <div class="history-row__score">
            <strong class="num">{{ item.total }}</strong>
            <span>{{ item.grade }}</span>
          </div>
        </li>
      </ul>
    </section>

    <TeacherReview
      v-if="can('module.review')"
      module="dish"
      module-label="菜肴成品"
      :items="reviewItems"
    />
  </ModuleShell>
</template>

<style scoped lang="scss">
.dish-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: $space-4;
}

.upload {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;

  &__stage {
    position: relative;
    overflow: hidden;
    cursor: pointer;
    background: $color-bg-subtle;
    aspect-ratio: 4 / 3;

    &.is-locked {
      cursor: default;
    }

    &.is-empty {
      background: repeating-linear-gradient(
        45deg,
        $color-bg-subtle,
        $color-bg-subtle 8px,
        #f0f0f2 8px,
        #f0f0f2 16px
      );
    }
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__hint {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 $space-6;
    text-align: center;

    p {
      margin: 0;
      font-size: $font-size-sm;
      color: $color-text-regular;
    }

    span {
      max-width: 280px;
      font-size: $font-size-xs;
      line-height: 1.6;
      color: $color-text-placeholder;
    }
  }

  &__mobile {
    color: $color-text-secondary !important;
  }

  &__scan {
    position: absolute;
    right: 0;
    left: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
    animation: scan 1.6s linear infinite;
  }

  &__progress {
    display: flex;
    gap: $space-2;
    align-items: center;
    padding: 8px 16px;
    border-top: 1px solid $color-border-light;

    .el-progress {
      flex: 1;
    }

    span {
      font-size: 11px;
      color: $color-text-secondary;
    }
  }

  &__bar {
    display: flex;
    gap: $space-3;
    align-items: center;
    padding: 10px $space-5;
    border-top: 1px solid $color-border-light;
  }

  &__name {
    margin-left: auto;
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__file {
    display: none;
  }
}

@keyframes scan {
  0% {
    top: 0;
  }

  100% {
    top: 100%;
  }
}

.score-card {
  display: flex;
  flex-direction: column;

  &__right {
    display: flex;
    gap: $space-2;
    align-items: baseline;
  }

  &__total {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 26px;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;

    em {
      font-family: $font-family-base;
      font-size: 10px;
      font-style: normal;
      font-weight: $font-weight-regular;
      color: $color-text-placeholder;
    }
  }

  &__grade {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.dim-list {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: 0;
  margin: 0;
  list-style: none;
}

.dim {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-regular;
  }

  &__score {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__edit :deep(.el-input-number) {
    width: 92px;
  }

  &__track {
    height: 4px;
    margin-top: 6px;
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

  &__reason {
    margin: 6px 0 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-secondary;
  }

  &__advice {
    margin: 3px 0 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-placeholder;
  }

  &__weight {
    display: block;
    margin-top: 4px;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }
}

.score-empty {
  padding: $space-6 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

.score-foot {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3;
  align-items: center;
  justify-content: space-between;
  padding-top: $space-3;
  margin-top: auto;
  font-size: 11px;
  color: $color-text-placeholder;
  border-top: 1px solid $color-border-light;

  &__actions {
    display: flex;
    gap: $space-2;
  }
}

.remark {
  max-width: 76ch;
  margin: 0;
  font-size: $font-size-base;
  line-height: 1.9;
  color: $color-text-regular;
  white-space: pre-line;
}

.disclaimer {
  padding-top: $space-3;
  margin: $space-3 0 0;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $color-text-placeholder;
  border-top: 1px solid $color-border-light;

  strong {
    color: $color-text-regular;
  }
}

.history {
  padding: 0;
  margin: 0;
  list-style: none;
}

.history-row {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid $color-border-light;

  &:first-child {
    border-top: 0;
  }

  &__img {
    flex: 0 0 48px;
    width: 48px;
    height: 36px;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-xs;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__dish {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__flag {
    font-size: 10px;
    color: $color-success;
  }

  &__meta {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;

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

.history-empty {
  padding: $space-5 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

.link-btn {
  padding: 0;
  font-family: inherit;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  cursor: pointer;
  background: none;
  border: 0;

  &:hover {
    color: $color-primary;
  }

  &.is-danger:hover {
    color: $color-danger;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

@media (max-width: 1280px) {
  .dish-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
