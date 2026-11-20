<script setup lang="ts">
/**
 * 菜肴成品分析
 * ----------------------------------------------------------------------------
 * 学生拍照上传 → 多模态模型打分 → 五维分数 + 文字评语。
 * 演示阶段前端模拟推理结果，但上传、压缩、预览、评分展示的链路是完整的，
 * 后端接上后只需把 mockAnalyze 换成 api 调用。
 *
 * 教师视角：预览区显示的是被选中学生提交的那张成品图，教师不再自己上传，
 * 只负责分析、复核与扣分。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ModuleShell from '@/components/ModuleShell.vue'
import TeacherReview from '@/components/TeacherReview.vue'
import { useRole } from '@/composables/useRole'
import { useReviewStore } from '@/stores/review'
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

interface Dimension {
  key: string
  label: string
  score: number
  weight: number
}

// 默认载入一张示例成品：空白的上传框会让页面看起来像没做完，
// 而演示时讲师通常先讲「一张照片进来会得到什么」
const previewUrl = ref<string>(dishSample)
const analyzing = ref(false)
const analyzed = ref(false)
const remark = ref('')
const fileInput = ref<HTMLInputElement>()

const dimensions = ref<Dimension[]>([
  { key: 'appearance', label: '食材外观', score: 0, weight: 0.25 },
  { key: 'plating', label: '摆盘艺术', score: 0, weight: 0.2 },
  { key: 'color', label: '色彩搭配', score: 0, weight: 0.2 },
  { key: 'craft', label: '制作工艺', score: 0, weight: 0.2 },
  { key: 'creativity', label: '创意', score: 0, weight: 0.15 },
])

const totalScore = computed(() =>
  analyzed.value
    ? Math.round(dimensions.value.reduce((sum, d) => sum + d.score * d.weight, 0))
    : 0,
)

function pickFile(): void {
  fileInput.value?.click()
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  previewUrl.value = URL.createObjectURL(file)
  reset()
  input.value = ''
}

function useSample(): void {
  previewUrl.value = dishSample
  reset()
}

function reset(): void {
  analyzed.value = false
  remark.value = ''
  dimensions.value = dimensions.value.map((d) => ({ ...d, score: 0 }))
}

/** 换人时换图并清空结果：上一个学生的评分挂在新学生名下是最容易出错的一类 bug */
watch(
  () => target.value.id,
  () => {
    if (!isReviewing.value) return
    previewUrl.value = dishSample
    reset()
  },
)

async function analyze(): Promise<void> {
  if (!previewUrl.value) {
    ElMessage.warning('请先上传菜品照片')
    return
  }
  analyzing.value = true
  await new Promise((r) => setTimeout(r, 1500))

  dimensions.value = dimensions.value.map((d) => ({
    ...d,
    score: Math.round(72 + Math.random() * 24),
  }))
  analyzed.value = true
  analyzing.value = false
  remark.value =
    '成品整体完成度较高：鱼皮呈均匀金黄色，火候控制稳定；配菜切配规格一致，断面整齐。摆盘采用偏左侧的留白式构图，视觉重心明确。改进建议：酱汁点缀距离主体略远，收汁浓度可以再收紧一档，避免盘底出现渗液。'
}

const endpoints = [
  {
    name: '成品评分',
    method: 'POST' as const,
    path: '/api/modules/dish/analyze',
    note: '上传菜品照片，后端调用多模态模型返回五维分数与评语，单次耗时约 3-6 秒。',
    request: `FormData {
  image: <jpeg, <= 4MB>,
  task_id: "task_20261120_01",
  student_id: 1001,
  rubric_id: 3
}`,
    response: `{
  "code": 0,
  "data": {
    "total": 88,
    "dimensions": [
      { "key": "appearance", "score": 90, "weight": 0.25 },
      { "key": "plating",    "score": 86, "weight": 0.20 },
      { "key": "color",      "score": 91, "weight": 0.20 },
      { "key": "craft",      "score": 87, "weight": 0.20 },
      { "key": "creativity", "score": 84, "weight": 0.15 }
    ],
    "remark": "鱼皮呈均匀金黄色……",
    "image_url": "https://oss.example.com/dish/1024.jpg"
  },
  "message": "ok"
}`,
  },
  {
    name: '评分标准',
    method: 'GET' as const,
    path: '/api/modules/dish/rubric',
    note: '评分维度与权重由教研组配置，前端据此渲染维度条，不写死维度名。',
    request: `{ "rubric_id": 3 }`,
    response: `{
  "code": 0,
  "data": {
    "id": 3,
    "name": "中餐热菜成品评分",
    "dimensions": [
      { "key": "appearance", "label": "食材外观", "weight": 0.25 }
    ],
    "pass_score": 60
  },
  "message": "ok"
}`,
  },
]
</script>

<template>
  <ModuleShell
    title="菜肴成品分析"
    subtitle="拍照上传成品菜，从五个维度给出评分与评语"
    :endpoints="endpoints"
    :ready="false"
    state-text="待对接"
  >
    <template #actions>
      <el-button v-if="!isReviewing" @click="useSample">载入示例</el-button>
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
          @click="isReviewing ? undefined : pickFile()"
        >
          <img v-if="previewUrl" :src="previewUrl" alt="待分析的菜品照片" class="upload__img" />

          <div v-else class="upload__hint">
            <p>点击选择菜品照片</p>
            <span>支持 JPG / PNG，建议在自然光下俯拍，画面只保留餐盘</span>
          </div>

          <div v-if="analyzing" class="upload__scan" aria-hidden="true" />
        </div>

        <footer class="upload__bar">
          <button v-if="!isReviewing" type="button" class="link-btn" @click="pickFile">重新选择</button>
          <span v-else class="upload__name">{{ target.name }} · 学号 {{ target.studentNo }}</span>
          <span v-if="previewUrl && !isReviewing" class="upload__name">已就绪</span>
        </footer>

        <input
          v-if="!isReviewing"
          ref="fileInput"
          type="file"
          accept="image/*"
          class="upload__file"
          @change="onFile"
        />
      </section>

      <!-- 评分 -->
      <section class="app-card score-card">
        <header class="card-head">
          <h2>{{ isReviewing ? `${target.name} · 评分结果` : '评分结果' }}</h2>
          <span class="score-card__total num">
            {{ analyzed ? totalScore : '—' }}
            <em>总分</em>
          </span>
        </header>

        <ul class="dim-list">
          <li v-for="dim in dimensions" :key="dim.key" class="dim">
            <div class="dim__head">
              <span class="dim__label">{{ dim.label }}</span>
              <span class="dim__score num">{{ analyzed ? dim.score : '—' }}</span>
            </div>
            <div class="dim__track">
              <div
                class="dim__fill"
                :style="{ width: analyzed ? `${dim.score}%` : '0%' }"
              />
            </div>
            <span class="dim__weight">权重 {{ Math.round(dim.weight * 100) }}%</span>
          </li>
        </ul>
      </section>
    </div>

    <section v-if="analyzed" class="app-card">
      <header class="card-head">
        <h2>评语</h2>
        <span class="card-head__hint">由多模态模型生成，教师可修改后归档</span>
      </header>
      <p class="remark">{{ remark }}</p>
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
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
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

    // 教师视角：图是学生交的，点不进上传
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
      max-width: 260px;
      font-size: $font-size-xs;
      line-height: 1.6;
      color: $color-text-placeholder;
    }
  }

  // 分析中的扫描线：只做一条 1px 的移动线，不放大面积动效
  &__scan {
    position: absolute;
    right: 0;
    left: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
    animation: scan 1.6s linear infinite;
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px $space-5;
    border-top: 1px solid $color-border-light;
  }

  &__name {
    font-size: $font-size-xs;
    color: $color-success;
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
  &__total {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 28px;
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
    align-items: baseline;
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

  &__track {
    height: 4px;
    margin-top: 8px;
    overflow: hidden;
    background: $color-bg-sunken;
    border-radius: 2px;
  }

  &__fill {
    height: 100%;
    background: $color-text-primary;
    border-radius: 2px;
    transition: width 700ms $ease-emphasized;
  }

  &__weight {
    display: block;
    margin-top: 5px;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }
}

.remark {
  max-width: 72ch;
  margin: 0;
  font-size: $font-size-base;
  line-height: 1.9;
  color: $color-text-regular;
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
}

@media (max-width: 1280px) {
  .dish-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
