<script setup lang="ts">
/**
 * 班级名单 / 白名单导入
 * ----------------------------------------------------------------------------
 * 【为什么放在「教学」而不放「系统管理」】
 * 导入名单是教师开学做的第一件事，它决定「哪些学生能登录、能不能签到」。
 * 系统管理组是管理员的账号维护（改角色、停用、重置密码），教师根本进不去；
 * 把白名单塞进那里，教师要么没权限，要么被迫承担账号管理职责。
 * 放在教学组，紧挨「课程管理」，语义是「我这一班的人」。
 *
 * 【为什么先解析再导入】
 * 粘贴 40 行必然有几行学号写错、重名、已经开通过。直接导进去再报错，
 * 教师得一条条回查；先出预览表，红行改完再提交，一次就能过。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import AppSkeleton from '@/components/AppSkeleton.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import { fetchClasses, importWhitelist, parseWhitelist } from '@/api/whitelist'
import { useRole } from '@/composables/useRole'
import { mockStudents } from '@/mock/students'
import { WHITELIST_STATUS_LABEL, type ClassBrief, type WhitelistParseResult } from '@/types/whitelist'

const { can } = useRole()

const loading = ref(true)
const loadError = ref('')
const classes = ref<ClassBrief[]>([])
const activeId = ref<number | null>(null)

const activeClass = computed(() => classes.value.find((item) => item.id === activeId.value) ?? null)

/** 本班学生来自花名册，和签到、评价用的是同一份 */
const roster = computed(() =>
  activeClass.value
    ? mockStudents.filter((stu) => stu.className === activeClass.value?.name)
    : [],
)

/* ------------------------------ 白名单导入 ------------------------------ */

const importVisible = ref(false)
const step = ref<'input' | 'review' | 'done'>('input')
const rawText = ref('')
const parsing = ref(false)
const committing = ref(false)
const parsed = ref<WhitelistParseResult | null>(null)
const result = ref<{ batchId: string; created: number; skipped: number; failed: number } | null>(null)

const canCommit = computed(() => (parsed.value?.summary.creatable ?? 0) > 0)

function openImport(): void {
  step.value = 'input'
  rawText.value = ''
  parsed.value = null
  result.value = null
  importVisible.value = true
}

async function handleParse(): Promise<void> {
  if (!activeClass.value) return
  if (!rawText.value.trim()) {
    ElMessage.warning('先粘贴名单，或下载模板填好再贴回来')
    return
  }
  parsing.value = true
  try {
    parsed.value = await parseWhitelist(rawText.value, activeClass.value.name, activeClass.value.id)
    step.value = 'review'
    if (!parsed.value.summary.creatable) {
      ElMessage.warning('没有可创建的行，检查一下学号与姓名')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '解析失败')
  } finally {
    parsing.value = false
  }
}

async function handleCommit(): Promise<void> {
  if (!activeClass.value || !parsed.value) return
  committing.value = true
  try {
    const res = await importWhitelist(parsed.value.rows, activeClass.value.id)
    result.value = res
    step.value = 'done'
    // 班级人数变了，重新取一次，避免头部还显示旧数字
    classes.value = await fetchClasses()
    ElMessage.success(`已创建 ${res.created} 个待开通账号`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    committing.value = false
  }
}

/** 读取 CSV / TXT：只取文本，解析交给同一套规则，避免两套校验 */
async function handleFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('文件超过 2MB，建议只贴本班名单')
    input.value = ''
    return
  }
  rawText.value = await file.text()
  input.value = ''
  ElMessage.success('已读取文件，点「校验名单」继续')
}

/** 模板下载：纯文本 CSV，Excel 双击可开 */
function downloadTemplate(): void {
  const header = '学号,姓名,手机号(可选)'
  const sample = '2023010111,王小明,13800000011\n2023010112,李小红,'
  const blob = new Blob([`\uFEFF${header}\r\n${sample}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '班级白名单模板.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    classes.value = await fetchClasses()
    activeId.value = classes.value[0]?.id ?? null
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '班级列表加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="classes-page">
    <PageHeader
      title="班级名单"
      subtitle="导入白名单后，学生才能用学号登录与签到；已存在的学号不会被覆盖"
    >
      <template #actions>
        <el-button :disabled="!activeClass" @click="downloadTemplate">下载模板</el-button>
        <el-button v-if="can('class.roster')" type="primary" :disabled="!activeClass" @click="openImport">
          导入白名单
        </el-button>
      </template>
    </PageHeader>

    <AppSkeleton v-if="loading" variant="stats" :count="2" />
    <StateView v-else-if="loadError" state="error" :description="loadError" retryable @retry="load" />

    <div v-else class="layout">
      <!-- 左：班级 -->
      <aside class="app-card class-list">
        <h2 class="class-list__title">我的班级</h2>
        <ul>
          <li v-for="item in classes" :key="item.id">
            <button
              type="button"
              class="class-item"
              :class="{ 'is-active': item.id === activeId }"
              @click="activeId = item.id"
            >
              <span class="class-item__name">{{ item.name }}</span>
              <span class="class-item__meta">
                {{ item.grade }} · {{ item.studentCount }} 人
              </span>
              <span v-if="item.pendingCount" class="class-item__pending num">
                {{ item.pendingCount }} 待开通
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- 右：名单 -->
      <section class="app-card">
        <header class="roster-head">
          <div>
            <h2>{{ activeClass?.name ?? '未选择班级' }}</h2>
            <p>
              {{ activeClass?.major }} · 班主任 {{ activeClass?.teacher }} ·
              在册 {{ roster.length }} 人
            </p>
          </div>
        </header>

        <el-table v-if="roster.length" :data="roster" class="roster-table" size="default">
          <el-table-column prop="studentNo" label="学号" width="140">
            <template #default="{ row }">
              <span class="num">{{ row.studentNo }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column label="工位" width="90">
            <template #default="{ row }">
              <span class="num">{{ row.seat }}</span>
            </template>
          </el-table-column>
          <el-table-column label="人脸底库" width="120">
            <template #default="{ row }">
              <span class="status-dot" :class="row.facePhoto ? 'status-dot--success' : ''" />
              {{ row.facePhoto ? '已录入' : '未录入' }}
            </template>
          </el-table-column>
          <el-table-column label="本节签到" min-width="130">
            <template #default="{ row }">
              <!-- 底库没有照片的人不可能人脸签到，只能是教师代签；不写清就会读成「未录入也能刷脸」 -->
              <template v-if="!row.checkedIn">
                <span class="status-dot" />
                未签到
              </template>
              <template v-else-if="row.facePhoto">
                <span class="status-dot status-dot--success" />
                已签到
              </template>
              <template v-else>
                <span class="status-dot status-dot--warning" />
                已签到 · 代签
              </template>
            </template>
          </el-table-column>
        </el-table>
        <p v-else class="empty-line">
          这个班还没有学生。点右上角「导入白名单」，把教务系统的名单贴进来。
        </p>

        <p class="foot-note">
          名单按「学号 + 姓名」唯一。导入只创建待开通账号，学生首次登录时完善人脸与密码；
          已存在的学号一律跳过，不会覆盖教师改过的资料。
        </p>
      </section>
    </div>

    <!-- 导入抽屉：输入 → 校验 → 完成，三步同一个面板，不做多层弹窗 -->
    <el-drawer v-model="importVisible" title="导入班级白名单" size="620px">
      <div class="import">
        <p class="import__target">
          目标班级
          <strong>{{ activeClass?.name }}</strong>
        </p>

        <!-- 第一步：粘贴 -->
        <template v-if="step === 'input'">
          <el-input
            v-model="rawText"
            type="textarea"
            :rows="12"
            resize="vertical"
            placeholder="每行一个学生，逗号或制表符分隔：&#10;2023010111,王小明,13800000011&#10;2023010112,李小红"
          />
          <div class="import__tools">
            <label class="import__file">
              从 CSV 文件读取
              <input type="file" accept=".csv,.txt,text/csv,text/plain" @change="handleFile" />
            </label>
            <span class="import__hint">支持从 Excel 直接复制两列粘贴</span>
          </div>
          <footer class="import__foot">
            <el-button @click="importVisible = false">取消</el-button>
            <el-button type="primary" :loading="parsing" @click="handleParse">校验名单</el-button>
          </footer>
        </template>

        <!-- 第二步：预览 -->
        <template v-else-if="step === 'review' && parsed">
          <ul class="summary">
            <li>
              <span>共解析</span>
              <strong class="num">{{ parsed.summary.total }}</strong>
            </li>
            <li class="is-ok">
              <span>可创建</span>
              <strong class="num">{{ parsed.summary.creatable }}</strong>
            </li>
            <li class="is-warn">
              <span>已存在（跳过）</span>
              <strong class="num">{{ parsed.summary.exists }}</strong>
            </li>
            <li class="is-bad">
              <span>不合法（不导入）</span>
              <strong class="num">{{ parsed.summary.invalid }}</strong>
            </li>
          </ul>

          <el-table :data="parsed.rows" max-height="380" size="small" class="preview-table">
            <el-table-column prop="line" label="#" width="52" />
            <el-table-column prop="studentNo" label="学号" width="130" />
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <span class="row-status" :class="`is-${row.status}`">
                  {{ WHITELIST_STATUS_LABEL[row.status as keyof typeof WHITELIST_STATUS_LABEL] }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="180">
              <template #default="{ row }">
                <span class="row-msg">{{ row.message ?? '—' }}</span>
              </template>
            </el-table-column>
          </el-table>

          <footer class="import__foot">
            <el-button @click="step = 'input'">返回修改</el-button>
            <el-button
              type="primary"
              :loading="committing"
              :disabled="!canCommit"
              @click="handleCommit"
            >
              确认导入 {{ parsed.summary.creatable }} 人
            </el-button>
          </footer>
        </template>

        <!-- 第三步：结果 -->
        <template v-else-if="step === 'done' && result">
          <div class="done">
            <p class="done__title">导入完成</p>
            <dl class="done__facts">
              <div>
                <dt>批次号</dt>
                <dd class="num">{{ result.batchId }}</dd>
              </div>
              <div>
                <dt>创建</dt>
                <dd class="num">{{ result.created }} 人</dd>
              </div>
              <div>
                <dt>跳过</dt>
                <dd class="num">{{ result.skipped }} 人</dd>
              </div>
              <div>
                <dt>未导入</dt>
                <dd class="num">{{ result.failed }} 行</dd>
              </div>
            </dl>
            <p class="done__note">
              新建账号为「待开通」状态。学生首次登录后用学号 + 初始密码激活，并完成人脸采集；
              你可以把批次号发给管理员核对。
            </p>
          </div>
          <footer class="import__foot">
            <el-button @click="openImport">再导入一批</el-button>
            <el-button type="primary" @click="importVisible = false">完成</el-button>
          </footer>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: minmax(0, 250px) minmax(0, 1fr);
  gap: $space-4;
  align-items: start;
}

.class-list {
  &__title {
    margin: 0 0 $space-3;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
}

.class-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-subtle;
  }

  &.is-active {
    background: $color-primary-soft;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__pending {
    font-size: 10.5px;
    color: $color-warning;
  }
}

.roster-head {
  display: flex;
  gap: $space-3;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: $space-3;
  margin-bottom: $space-2;
  border-bottom: 1px solid $color-border-light;

  h2 {
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  p {
    margin: 3px 0 0;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.foot-note {
  padding-top: $space-3;
  margin: $space-3 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: $color-text-placeholder;
  border-top: 1px solid $color-border-light;
}

.empty-line {
  padding: $space-6 0;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
  text-align: center;
}

/* ---------------- 导入抽屉 ---------------- */
.import {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__target {
    margin: 0 0 $space-3;
    font-size: $font-size-xs;
    color: $color-text-secondary;

    strong {
      font-size: $font-size-sm;
      color: $color-text-primary;
    }
  }

  &__tools {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    align-items: center;
    margin-top: $space-3;
  }

  &__file {
    font-size: $font-size-xs;
    color: $color-primary;
    cursor: pointer;

    input {
      display: none;
    }
  }

  &__hint {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__foot {
    display: flex;
    gap: $space-2;
    justify-content: flex-end;
    padding-top: $space-4;
    margin-top: auto;
  }
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-2;
  padding: 0;
  margin: 0 0 $space-3;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    background: $color-bg-subtle;
    border-radius: $radius-sm;

    span {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    strong {
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    &.is-ok strong {
      color: $color-success;
    }

    &.is-warn strong {
      color: $color-warning;
    }

    &.is-bad strong {
      color: $color-danger;
    }
  }
}

.row-status {
  font-size: $font-size-xs;

  &.is-new {
    color: $color-success;
  }

  &.is-exists {
    color: $color-text-secondary;
  }

  &.is-invalid {
    color: $color-danger;
  }
}

.row-msg {
  font-size: 11px;
  color: $color-text-placeholder;
}

.done {
  &__title {
    margin: 0 0 $space-3;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
    padding: $space-3;
    margin: 0;
    background: $color-bg-subtle;
    border-radius: $radius-sm;

    dt {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    dd {
      margin: 2px 0 0;
      font-size: $font-size-sm;
      color: $color-text-primary;
    }
  }

  &__note {
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-secondary;
  }
}

@media (max-width: $breakpoint-lg) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: $breakpoint-sm) {
  .summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
