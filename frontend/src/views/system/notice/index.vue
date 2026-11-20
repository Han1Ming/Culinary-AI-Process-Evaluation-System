<script setup lang="ts">
/**
 * 通知发布（系统管理）
 * ----------------------------------------------------------------------------
 * 管理员在这里写公告，发布后进入顶栏铃铛与学生/教师的工作台公告位。
 *
 * 两个细节是刻意的：
 * 1. 草稿与已发布分开显示状态，撤回等于回到草稿，学生端立即不可见；
 * 2. 接收对象可以只发给教师（比如教研调整），不用所有公告都全站广播。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import AppSkeleton from '@/components/AppSkeleton.vue'
import {
  createNotice,
  deleteNotice,
  fetchAllNotices,
  publishNotice,
  revokeNotice,
  updateNotice,
} from '@/api/notice'
import { formatDateTime } from '@/utils/format'
import { NOTICE_TYPE_LABELS } from '@/types'
import type { Notice, NoticeForm, NoticeType, UserRole } from '@/types'

const loading = ref(true)
const notices = ref<Notice[]>([])

const stats = computed(() => {
  const published = notices.value.filter((n) => n.status === 'published')
  const readRate = published.length
    ? Math.round(
        (published.reduce((sum, n) => sum + n.readCount, 0) /
          Math.max(
            1,
            published.reduce((sum, n) => sum + n.totalCount, 0),
          )) *
          100,
      )
    : 0
  return {
    published: published.length,
    draft: notices.value.filter((n) => n.status === 'draft').length,
    readRate,
  }
})

async function load(): Promise<void> {
  loading.value = true
  try {
    notices.value = await fetchAllNotices()
  } catch {
    ElMessage.error('通知列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------------- 编辑弹窗 ---------------- */

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)

const form = reactive<NoticeForm>({
  title: '',
  body: '',
  type: 'system',
  audience: 'all',
  pinned: false,
})

const typeOptions: Array<{ value: NoticeType; label: string }> = [
  { value: 'system', label: '系统公告' },
  { value: 'feature', label: '功能更新' },
  { value: 'maintenance', label: '维护通知' },
]

const audienceOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'student', label: '学生' },
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
]

/** 全站 / 指定角色 两态，用 radio 表达，避免多选控件带来「都不选」的空集 */
const audienceMode = ref<'all' | 'roles'>('all')
const audienceRoles = ref<UserRole[]>(['teacher'])

const dialogTitle = computed(() => (editingId.value ? '编辑通知' : '新建通知'))

function openCreate(): void {
  editingId.value = null
  form.title = ''
  form.body = ''
  form.type = 'system'
  form.pinned = false
  audienceMode.value = 'all'
  audienceRoles.value = ['teacher']
  dialogVisible.value = true
}

function openEdit(row: Notice): void {
  editingId.value = row.id
  form.title = row.title
  form.body = row.body
  form.type = row.type
  form.pinned = row.pinned
  if (row.audience === 'all') {
    audienceMode.value = 'all'
  } else {
    audienceMode.value = 'roles'
    audienceRoles.value = [...row.audience]
  }
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  if (!form.title.trim()) {
    ElMessage.warning('请填写通知标题')
    return
  }
  if (!form.body.trim()) {
    ElMessage.warning('请填写正文')
    return
  }
  if (audienceMode.value === 'roles' && !audienceRoles.value.length) {
    ElMessage.warning('至少选择一个接收对象')
    return
  }

  const payload: NoticeForm = {
    ...form,
    audience: audienceMode.value === 'all' ? 'all' : [...audienceRoles.value],
  }

  submitting.value = true
  try {
    if (editingId.value) {
      await updateNotice(editingId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createNotice(payload)
      ElMessage.success('已创建为草稿，确认无误后点「发布」')
    }
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handlePublish(row: Notice): Promise<void> {
  try {
    await ElMessageBox.confirm(`发布后「${audienceText(row)}」立即可见，确认发布？`, '发布通知', {
      confirmButtonText: '发布',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await publishNotice(row.id)
  ElMessage.success('已发布')
  await load()
}

async function handleRevoke(row: Notice): Promise<void> {
  try {
    await ElMessageBox.confirm('撤回后回到草稿状态，学生端立即不可见。', '撤回通知', {
      confirmButtonText: '撤回',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await revokeNotice(row.id)
  ElMessage.success('已撤回为草稿')
  await load()
}

async function handleDelete(row: Notice): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除后不可恢复：${row.title}`, '删除通知', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteNotice(row.id)
  ElMessage.success('已删除')
  await load()
}

function audienceText(row: Notice): string {
  if (row.audience === 'all') return '全站用户'
  return row.audience
    .map((r) => ({ student: '学生', teacher: '教师', admin: '管理员' })[r])
    .join(' / ')
}

/**
 * 列表摘要：正文带空行（段间分隔），直接塞进 line-clamp 会让第二行是空行、
 * 末尾只剩一个省略号。折成单段之后再截，读起来才是一句话。
 */
function excerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}
</script>

<template>
  <div class="notice-page">
    <PageHeader title="通知发布" subtitle="公告、功能更新与维护通知，发布后全站可见">
      <template #actions>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新建通知
        </el-button>
      </template>
    </PageHeader>

    <div class="notice-stats">
      <div class="notice-stat">
        <span>已发布</span>
        <strong class="num">{{ stats.published }}</strong>
      </div>
      <div class="notice-stat">
        <span>草稿</span>
        <strong class="num">{{ stats.draft }}</strong>
      </div>
      <div class="notice-stat">
        <span>平均阅读率</span>
        <strong class="num">{{ stats.readRate }}%</strong>
      </div>
      <p class="notice-stats__hint">置顶通知会排在学生工作台第一位</p>
    </div>

    <AppSkeleton v-if="loading" variant="list" :count="4" />

    <ul v-else-if="notices.length" class="notice-list">
      <li v-for="row in notices" :key="row.id" class="notice">
        <div class="notice__head">
          <span v-if="row.pinned" class="notice__pin">置顶</span>
          <span class="notice__type">{{ NOTICE_TYPE_LABELS[row.type] }}</span>
          <h2 class="notice__title">{{ row.title }}</h2>
          <span class="notice__state" :class="row.status === 'published' ? 'is-on' : 'is-draft'">
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </span>
        </div>

        <p class="notice__body">{{ excerpt(row.body) }}</p>

        <footer class="notice__foot">
          <span>{{ audienceText(row) }}</span>
          <span class="notice__sep">·</span>
          <span class="num">
            {{ row.status === 'published' ? `${row.readCount}/${row.totalCount} 已读` : '未发布' }}
          </span>
          <span class="notice__sep">·</span>
          <span class="num">
            {{ formatDateTime(row.publishedAt ?? row.createdAt, 'YYYY-MM-DD HH:mm') }}
          </span>

          <div class="notice__actions">
            <el-button link @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'draft'" link type="primary" @click="handlePublish(row)">
              发布
            </el-button>
            <el-button v-else link @click="handleRevoke(row)">撤回</el-button>
            <el-button link class="notice__danger" @click="handleDelete(row)">删除</el-button>
          </div>
        </footer>
      </li>
    </ul>

    <p v-else class="notice-empty">还没有通知，点右上角「新建通知」写第一条。</p>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" append-to-body>
      <div class="notice-form">
        <label class="field">
          <span class="field__label">标题</span>
          <el-input v-model="form.title" placeholder="如：新增课程管理，教师可上传菜谱" maxlength="50" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field__label">类型</span>
            <el-select v-model="form.type">
              <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </label>

          <div class="field">
            <span class="field__label">接收对象</span>
            <div class="audience">
              <el-radio-group v-model="audienceMode">
                <el-radio value="all">全站</el-radio>
                <el-radio value="roles">指定角色</el-radio>
              </el-radio-group>
              <el-checkbox-group
                v-if="audienceMode === 'roles'"
                v-model="audienceRoles"
                class="audience__roles"
              >
                <el-checkbox v-for="a in audienceOptions" :key="a.value" :value="a.value">
                  {{ a.label }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </div>

        <label class="field">
          <span class="field__label">正文</span>
          <el-input
            v-model="form.body"
            type="textarea"
            :rows="7"
            maxlength="600"
            show-word-limit
            placeholder="写清楚：什么时候、影响谁、需要做什么。空行分段。"
          />
        </label>

        <label class="field field--inline">
          <el-switch v-model="form.pinned" />
          <span>置顶到工作台首位</span>
        </label>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ editingId ? '保存' : '创建草稿' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.notice-stats {
  display: flex;
  flex-wrap: wrap;
  gap: $space-5;
  align-items: baseline;
  padding: 14px $space-5;
  margin-bottom: $space-4;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__hint {
    margin: 0 0 0 auto;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.notice-stat {
  display: flex;
  gap: 8px;
  align-items: baseline;

  span {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  strong {
    font-size: 22px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    color: $color-text-primary;
    letter-spacing: -0.02em;
  }
}

.notice-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

.notice {
  padding: 18px $space-5;
  border-top: 1px solid $color-border-light;

  &:first-child {
    border-top: none;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__pin {
    padding: 1px 6px;
    font-size: 10px;
    color: $color-primary;
    background: $color-primary-soft;
    border-radius: 3px;
  }

  &__type {
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  &__title {
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__state {
    padding: 1px 7px;
    margin-left: auto;
    font-size: 10.5px;
    border-radius: 3px;

    &.is-on {
      color: $color-success;
      background: $color-success-soft;
    }

    &.is-draft {
      color: $color-text-secondary;
      background: $color-bg-subtle;
    }
  }

  &__body {
    display: -webkit-box;
    margin: 8px 0 0;
    overflow: hidden;
    font-size: $font-size-xs;
    line-height: 1.85;
    color: $color-text-secondary;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 10px;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__sep {
    color: $color-border-strong;
  }

  &__actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  &__danger {
    color: $color-danger;
  }
}

.notice-empty {
  padding: 64px 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

/* ---------- 表单 ---------- */

.notice-form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
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

  &--inline {
    flex-direction: row;
    gap: $space-2;
    align-items: center;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.field-row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: $space-4;
}

.audience {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3;
  align-items: center;
  min-height: 32px;

  &__roles {
    display: flex;
    gap: $space-3;
  }
}

@media (max-width: 900px) {
  .field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
