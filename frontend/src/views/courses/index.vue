<script setup lang="ts">
/**
 * 课程管理
 * ----------------------------------------------------------------------------
 * 教师：上传本节课菜肴的菜谱 PDF，发布后推送给班级学生。
 * 学生：收到课程后进入详情读菜谱，并可以让 AI 先讲一遍难点与易错点。
 *
 * 角色不该看到不该看的东西：学生列表里只有已发布的课程，草稿对他们是不可见的。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import AppSkeleton from '@/components/AppSkeleton.vue'
import { createCourse, deleteCourse, fetchCourses, publishCourse } from '@/api/course'
import { useAuthStore } from '@/stores/auth'
import { useRole } from '@/composables/useRole'
import { formatDateTime } from '@/utils/format'
import type { Course, CourseForm } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const { can, isStudent } = useRole()

const canUpload = computed(() => can('course.upload'))

const loading = ref(true)
const courses = ref<Course[]>([])

const visibleCourses = computed(() =>
  canUpload.value ? courses.value : courses.value.filter((c) => c.published),
)

const stats = computed(() => ({
  published: courses.value.filter((c) => c.published).length,
  draft: courses.value.filter((c) => !c.published).length,
  received: courses.value.reduce((sum, c) => sum + c.receiverCount, 0),
}))

async function load(): Promise<void> {
  loading.value = true
  try {
    courses.value = await fetchCourses()
  } catch {
    ElMessage.error('课程列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------------- 上传 ---------------- */

const dialogVisible = ref(false)
const submitting = ref(false)
const fileInput = ref<HTMLInputElement>()

const form = reactive<CourseForm>({
  title: '',
  dishes: '',
  className: '烹饪工艺与营养 2301',
  lessonAt: '',
  goal: '',
  fileName: '',
  fileSize: 0,
  fileUrl: undefined,
})

const formError = ref('')

function openUpload(): void {
  form.title = ''
  form.dishes = ''
  form.lessonAt = ''
  form.goal = ''
  form.fileName = ''
  form.fileSize = 0
  form.fileUrl = undefined
  formError.value = ''
  dialogVisible.value = true
}

function pickFile(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    ElMessage.warning('只支持 PDF，请先导出为 PDF 再上传')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.warning('单个文件不超过 20MB')
    return
  }

  form.fileName = file.name
  form.fileSize = file.size
  // 预览用本地 objectURL；真实环境由后端返回可访问地址
  form.fileUrl = URL.createObjectURL(file)
  input.value = ''
}

async function submit(): Promise<void> {
  if (!form.title.trim()) {
    formError.value = '请填写课程标题，如「第 7 周 · 刀工与火候训练」'
    return
  }
  if (!form.dishes.trim()) {
    formError.value = '请填写本节课要做的菜肴，多个用顿号分隔'
    return
  }
  if (!form.fileName) {
    formError.value = '请上传菜谱 PDF'
    return
  }
  formError.value = ''
  submitting.value = true
  try {
    await createCourse({ ...form })
    dialogVisible.value = false
    ElMessage.success('课程已创建，发布后班级学生即可收到菜谱')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    submitting.value = false
  }
}

async function handlePublish(course: Course): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `发布后「${course.className}」的 ${course.studentCount} 名学生会收到这份菜谱，确认发布？`,
      '发布课程',
      { confirmButtonText: '发布', cancelButtonText: '再检查一下' },
    )
  } catch {
    return
  }
  await publishCourse(course.id)
  ElMessage.success('已发布，学生端可见')
  await load()
}

async function handleDelete(course: Course): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除课程「${course.title}」吗？`, '删除课程', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteCourse(course.id)
  ElMessage.success('已删除')
  await load()
}

function openCourse(course: Course): void {
  void router.push(`/courses/${course.id}`)
}

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}
</script>

<template>
  <div class="courses-page">
    <PageHeader
      title="课程管理"
      :subtitle="
        canUpload
          ? '上传本节课的菜谱，发布后推送给班级学生'
          : '本节课的菜谱与难点解析'
      "
    >
      <template #actions>
        <el-button v-if="canUpload" type="primary" @click="openUpload">
          <el-icon><Upload /></el-icon>
          上传菜谱
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览数字：教师看到发布/草稿，学生只看到已收课程数 -->
    <div class="course-stats">
      <div class="course-stat">
        <span class="course-stat__label">已发布</span>
        <strong class="course-stat__value num">{{ stats.published }}</strong>
      </div>
      <div v-if="canUpload" class="course-stat">
        <span class="course-stat__label">草稿</span>
        <strong class="course-stat__value num">{{ stats.draft }}</strong>
      </div>
      <div class="course-stat">
        <span class="course-stat__label">{{ canUpload ? '累计送达' : '我的课程' }}</span>
        <strong class="course-stat__value num">
          {{ canUpload ? stats.received : visibleCourses.length }}
        </strong>
      </div>
      <p class="course-stats__note">
        {{ canUpload ? `当前账号：${auth.displayName}` : '菜谱由任课教师发布，发布后即时可见' }}
      </p>
    </div>

    <AppSkeleton v-if="loading" variant="list" :count="4" />

    <ul v-else-if="visibleCourses.length" class="course-list">
      <li v-for="course in visibleCourses" :key="course.id" class="course">
        <div class="course__date">
          <strong class="num">{{ formatDateTime(course.lessonAt, 'MM-DD') }}</strong>
          <span class="num">{{ formatDateTime(course.lessonAt, 'HH:mm') }}</span>
        </div>

        <div class="course__body">
          <p class="course__title">
            {{ course.title }}
            <span v-if="canUpload && !course.published" class="course__flag">草稿</span>
          </p>
          <p class="course__dishes">
            <span v-for="dish in course.dishes" :key="dish" class="course__dish">{{ dish }}</span>
          </p>
          <span class="course__meta">
            {{ course.className }} · {{ course.teacherName }} ·
            {{ course.fileName }}（{{ sizeText(course.fileSize) }}）
          </span>
        </div>

        <div class="course__nums">
          <span class="num">{{ course.receiverCount }}/{{ course.studentCount }}</span>
          <span>已接收</span>
        </div>

        <div class="course__actions">
          <el-button size="small" @click="openCourse(course)">
            {{ isStudent ? '查看菜谱' : '打开' }}
          </el-button>
          <template v-if="canUpload">
            <el-button v-if="!course.published" size="small" type="primary" @click="handlePublish(course)">
              发布
            </el-button>
            <el-button v-else size="small" text @click="handleDelete(course)">删除</el-button>
          </template>
        </div>
      </li>
    </ul>

    <p v-else class="course-empty">
      {{ canUpload ? '还没有课程，点右上角「上传菜谱」开始。' : '暂无已发布的课程。' }}
    </p>

    <!-- 上传弹窗 -->
    <el-dialog v-model="dialogVisible" title="上传菜谱" width="560px" append-to-body>
      <div class="upload-form">
        <label class="field">
          <span class="field__label">课程标题</span>
          <el-input v-model="form.title" placeholder="第 7 周 · 刀工与火候综合训练" maxlength="40" />
        </label>

        <label class="field">
          <span class="field__label">本节课菜肴</span>
          <el-input v-model="form.dishes" placeholder="青椒土豆丝、醋溜白菜" maxlength="60" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field__label">班级</span>
            <el-input v-model="form.className" placeholder="烹饪工艺与营养 2301" />
          </label>
          <label class="field">
            <span class="field__label">授课时间</span>
            <el-date-picker
              v-model="form.lessonAt"
              type="datetime"
              placeholder="选择时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm"
            />
          </label>
        </div>

        <label class="field">
          <span class="field__label">实训目标</span>
          <el-input
            v-model="form.goal"
            type="textarea"
            :rows="3"
            maxlength="120"
            placeholder="掌握 2mm 均匀切丝与大火快炒的出锅时机"
          />
        </label>

        <div class="field">
          <span class="field__label">菜谱文件</span>
          <button type="button" class="picker" @click="pickFile">
            <template v-if="form.fileName">
              <span class="picker__name">{{ form.fileName }}</span>
              <span class="picker__size num">{{ sizeText(form.fileSize) }}</span>
            </template>
            <template v-else>
              <span class="picker__hint">点击选择 PDF（不超过 20MB）</span>
            </template>
          </button>
          <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="onFileChange" />
        </div>

        <p v-if="formError" class="upload-form__error">{{ formError }}</p>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">创建课程</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.course-stats {
  display: flex;
  flex-wrap: wrap;
  gap: $space-5;
  align-items: flex-end;
  padding: 14px $space-5;
  margin-bottom: $space-4;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__note {
    margin: 0 0 2px auto;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.course-stat {
  display: flex;
  gap: 8px;
  align-items: baseline;

  &__label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__value {
    font-size: 22px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    color: $color-text-primary;
    letter-spacing: -0.02em;
  }
}

.course-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

.course {
  display: flex;
  gap: $space-4;
  align-items: center;
  padding: 16px $space-5;
  border-top: 1px solid $color-border-light;

  &:first-child {
    border-top: none;
  }

  &__date {
    display: flex;
    flex: 0 0 56px;
    flex-direction: column;
    align-items: center;
    padding-right: $space-4;
    border-right: 1px solid $color-border-light;

    strong {
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    span {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__flag {
    padding: 1px 6px;
    font-size: 10px;
    font-weight: $font-weight-regular;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border: 1px solid $color-border-light;
    border-radius: 3px;
  }

  &__dishes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0 4px;
  }

  &__dish {
    padding: 1px 7px;
    font-size: 11.5px;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-sm;
  }

  &__meta {
    display: block;
    overflow: hidden;
    font-size: 11.5px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__nums {
    display: flex;
    flex: 0 0 72px;
    flex-direction: column;
    align-items: flex-end;

    span {
      font-size: 10.5px;
      color: $color-text-placeholder;
    }

    span:first-child {
      font-size: $font-size-sm;
      color: $color-text-primary;
    }
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
  }
}

.course-empty {
  padding: 64px 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

/* ---------- 上传表单 ---------- */

.upload-form {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__error {
    margin: 0;
    font-size: $font-size-xs;
    color: $color-danger;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  &__label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: $space-4;
}

.picker {
  display: flex;
  gap: $space-3;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 72px;
  font-family: inherit;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  cursor: pointer;
  background: $color-bg-subtle;
  border: 1px dashed $color-border-strong;
  border-radius: $radius-md;
  transition: border-color $duration-fast $ease-standard;

  &:hover {
    border-color: $color-primary;
  }

  &__name {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__size {
    color: $color-text-placeholder;
  }
}

@media (max-width: 1080px) {
  .course__nums {
    display: none;
  }
}

@media (max-width: 900px) {
  .course {
    flex-wrap: wrap;
  }

  .field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
