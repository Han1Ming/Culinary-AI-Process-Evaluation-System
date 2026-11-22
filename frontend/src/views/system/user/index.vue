<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import FaceCaptureDialog from '@/components/FaceCaptureDialog.vue'
import { createUser, deleteUser, fetchUsers, updateUser, updateUserFace } from '@/api/user'
import { formatDateTime } from '@/utils/format'
import { ROLE_LABELS } from '@/types'
import type { DataTableColumn, User, UserForm, UserQuery, UserRole, UserStatus } from '@/types'

/**
 * 用户管理：搜索筛选 + 分页 + 增删改查弹窗
 * ----------------------------------------------------------------------------
 * 布局：工具条与表格同处一张卡片，用一条分隔线切分，避免「筛选一张卡 + 表格一张卡」
 * 造成的碎片感；筛选条件变化即查询，不再设独立的「查询」按钮。
 */

const loading = ref(false)
const rows = ref<User[]>([])
const total = ref(0)

const query = reactive<UserQuery>({
  page: 1,
  pageSize: 10,
  keyword: '',
  role: '',
  status: '',
})

const columns: DataTableColumn<User>[] = [
  { prop: 'name', label: '用户', minWidth: 200 },
  { prop: 'role', label: '角色', width: 104 },
  { prop: 'department', label: '部门 / 班级', minWidth: 170 },
  { prop: 'phone', label: '联系方式', minWidth: 180 },
  { prop: 'status', label: '状态', width: 88 },
  { prop: 'lastLoginAt', label: '最近登录', width: 140 },
  {
    prop: 'actions',
    label: '操作',
    // 只有「编辑 / 删除」两个链接按钮，112 够用；
    // 原来 148 是为「补录照片」留的位，按钮移除后列会空出一块，看起来像对齐错位
    width: 112,
    align: 'right',
  },
]

const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '任课教师', value: 'teacher' },
  { label: '学生', value: 'student' },
]

const subtitle = computed(() => (loading.value ? '正在读取账号数据' : `共 ${total.value} 个账号`))

/* ---------------- 列表 ---------------- */

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchUsers({ ...query })
    rows.value = result.list
    total.value = result.total
  } catch {
    ElMessage.error('用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  query.page = 1
  void loadData()
}

function handleReset(): void {
  query.keyword = ''
  query.role = ''
  query.status = ''
  query.page = 1
  void loadData()
}

function handlePageChange(page: number): void {
  query.page = page
  void loadData()
}

function handleSizeChange(size: number): void {
  query.pageSize = size
  query.page = 1
  void loadData()
}

/* ---------------- 弹窗表单 ---------------- */

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

/**
 * 档案抽屉
 * 管理员的实际工作流是「拿名字对照片」：注册时采集的人脸照片、学号、
 * 班级要在同一屏里看到，才能判断这张脸是不是这个人。所以单独做一个抽屉，
 * 而不是塞进编辑弹窗里（编辑是改数据，核验是看数据，两个动作不该混）。
 */
const profileVisible = ref(false)
const profileUser = ref<User | null>(null)

function openProfile(row: User): void {
  profileUser.value = row
  profileVisible.value = true
}

/* ---------------- 人脸照片补录 ---------------- */

const faceDialogVisible = ref(false)
const faceTarget = ref<User | null>(null)

function openFaceCapture(row: User): void {
  faceTarget.value = row
  faceDialogVisible.value = true
}

async function handleFaceSaved(dataUrl: string): Promise<void> {
  const target = faceTarget.value
  if (!target) return
  try {
    await updateUserFace(target.id, dataUrl)
    // 列表与抽屉同源刷新：抽屉开着时也要立刻看到新照片
    const patch = { facePhoto: dataUrl, faceRegistered: true }
    const row = rows.value.find((item) => item.id === target.id)
    if (row) Object.assign(row, patch)
    if (profileUser.value?.id === target.id) Object.assign(profileUser.value, patch)
    ElMessage.success(`已更新 ${target.name} 的人脸底库照片，次日可用于签到`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '照片保存失败')
  }
}

const form = reactive<UserForm>({
  username: '',
  name: '',
  password: '',
  role: 'teacher',
  phone: '',
  email: '',
  department: '',
  status: 1,
})

const dialogTitle = computed(() => (editingId.value ? '编辑用户' : '新增用户'))

const rules = computed<FormRules<UserForm>>(() => ({
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { min: 3, max: 20, message: '账号长度 3 - 20 位', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: editingId.value
    ? []
    : [
        { required: true, message: '请输入初始密码', trigger: 'blur' },
        { min: 6, message: '密码至少 6 位', trigger: 'blur' },
      ],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}))

function resetForm(): void {
  form.username = ''
  form.name = ''
  form.password = ''
  form.role = 'teacher'
  form.phone = ''
  form.email = ''
  form.department = ''
  form.status = 1
}

function openCreate(): void {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: User): void {
  editingId.value = row.id
  form.username = row.username
  form.name = row.name
  form.password = ''
  form.role = row.role
  form.phone = row.phone ?? ''
  form.email = row.email ?? ''
  form.department = row.department ?? ''
  form.status = row.status
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (editingId.value) {
      await updateUser(editingId.value, { ...form })
      ElMessage.success('用户信息已更新')
    } else {
      await createUser({ ...form })
      ElMessage.success('用户创建成功')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: User): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.name}」吗？删除后不可恢复。`, '删除用户', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteUser(row.id)
  ElMessage.success('用户已删除')
  await loadData()
}

async function handleToggleStatus(row: User): Promise<void> {
  const next: UserStatus = row.status === 1 ? 0 : 1
  try {
    await updateUser(row.id, {
      username: row.username,
      name: row.name,
      role: row.role,
      phone: row.phone ?? '',
      email: row.email ?? '',
      department: row.department ?? '',
      status: next,
    })
    row.status = next
    ElMessage.success(next === 1 ? '账号已启用' : '账号已停用')
  } catch {
    ElMessage.error('状态更新失败')
  }
}

onMounted(loadData)
</script>

<template>
  <div class="user-page">
    <PageHeader title="用户管理" :subtitle="subtitle">
      <template #actions>
        <el-button @click="loadData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增用户
        </el-button>
      </template>
    </PageHeader>

    <section class="app-card app-card--flush">
      <!-- 工具条：筛选条件变化即查询，只保留「重置」作为显式出口 -->
      <div class="toolbar">
        <div class="toolbar__filters">
          <el-input
            v-model="query.keyword"
            placeholder="搜索姓名、账号或学号"
            clearable
            class="toolbar__search"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select
            v-model="query.role"
            placeholder="全部角色"
            clearable
            class="toolbar__select"
            @change="handleSearch"
          >
            <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>

          <el-select
            v-model="query.status"
            placeholder="全部状态"
            clearable
            class="toolbar__select"
            @change="handleSearch"
          >
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>

          <el-button link class="toolbar__reset" @click="handleReset">重置</el-button>
        </div>
      </div>

      <div class="table-wrap">
        <DataTable
          :data="rows"
          :columns="columns"
          :loading="loading"
          :total="total"
          :page="query.page"
          :page-size="query.pageSize"
          empty-text="没有匹配的账号，试试调整筛选条件"
          @update:page="handlePageChange"
          @update:page-size="handleSizeChange"
        >
          <template #name="{ row }">
            <button type="button" class="cell-user" @click="openProfile(row)">
              <img
                v-if="row.facePhoto"
                :src="row.facePhoto"
                :alt="`${row.name}的人脸照片`"
                class="cell-user__photo"
              />
              <span v-else class="cell-user__avatar">{{ row.name.slice(0, 1) }}</span>
              <div class="cell-user__meta">
                <span class="cell-user__name">{{ row.name }}</span>
                <span class="cell-user__account">{{ row.username }}</span>
              </div>
            </button>
          </template>

          <template #role="{ row }">
            <span class="cell-role" :class="{ 'is-admin': row.role === 'admin' }">
              {{ ROLE_LABELS[row.role as UserRole] }}
            </span>
          </template>

          <template #department="{ row }">
            <span class="cell-dept">{{ row.department || '—' }}</span>
          </template>

          <template #phone="{ row }">
            <div class="cell-contact">
              <span>{{ row.phone || '—' }}</span>
              <span v-if="row.email" class="cell-contact__email">{{ row.email }}</span>
            </div>
          </template>

          <!-- 状态：圆点 + 文字，点击切换。不用彩色标签，避免表格右侧形成色块带 -->
          <template #status="{ row }">
            <button
              type="button"
              class="cell-status"
              :class="row.status === 1 ? 'is-active' : 'is-inactive'"
              :title="row.status === 1 ? '点击停用该账号' : '点击启用该账号'"
              @click="handleToggleStatus(row)"
            >
              <span class="status-dot" :class="row.status === 1 ? 'status-dot--success' : ''" />
              {{ row.status === 1 ? '启用' : '停用' }}
            </button>
          </template>

          <template #lastLoginAt="{ row }">
            <span class="cell-time">{{ formatDateTime(row.lastLoginAt) }}</span>
          </template>

          <template #actions="{ row }">
            <div class="cell-actions">
              <el-button link @click="openEdit(row)">编辑</el-button>
              <el-button link class="cell-actions__danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="540px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="user-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="登录账号" prop="username">
              <el-input v-model="form.username" placeholder="工号 / 学号" :disabled="Boolean(editingId)" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="真实姓名" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-select v-model="form.role" placeholder="请选择角色" class="user-form__full">
                <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item v-if="!editingId" label="初始密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="至少 6 位，首次登录后建议修改"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="11 位手机号" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="name@culinary.edu.cn" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="部门 / 班级" prop="department">
          <el-input v-model="form.department" placeholder="如：烹饪工艺教研室 / 烹饪工艺与营养 2301" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 学生档案：核验人脸照片与身份信息是否对得上 -->
    <el-drawer
      v-model="profileVisible"
      title="学生档案"
      size="380px"
      class="profile-drawer"
      :destroy-on-close="true"
    >
      <template v-if="profileUser">
        <div class="profile">
          <!-- 管理员不参与人脸签到，档案里不摆一张空照片框 -->
          <template v-if="profileUser.role !== 'admin'">
            <div class="profile__photo">
              <img
                v-if="profileUser.facePhoto"
                :src="profileUser.facePhoto"
                :alt="`${profileUser.name}的人脸照片`"
              />
              <div v-else class="profile__photo-empty">
                <span>{{ profileUser.name.slice(0, 1) }}</span>
                <p>尚未采集人脸照片</p>
              </div>
            </div>

            <div class="profile__status">
              <span class="status-dot" :class="profileUser.faceRegistered ? 'status-dot--success' : ''" />
              {{ profileUser.faceRegistered ? '人脸已录入，可用于签到' : '未录入人脸，无法走人脸签到' }}
            </div>
          </template>

          <p v-else class="profile__note">管理员账号不参与人脸签到，无需采集照片。</p>

          <dl class="profile__facts">
            <div>
              <dt>姓名</dt>
              <dd>{{ profileUser.name }}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{{ ROLE_LABELS[profileUser.role as UserRole] }}</dd>
            </div>
            <div>
              <dt>学号</dt>
              <dd class="num">{{ profileUser.studentNo || '—' }}</dd>
            </div>
            <div>
              <dt>班级</dt>
              <dd>{{ profileUser.department || '—' }}</dd>
            </div>
            <div>
              <dt>手机号</dt>
              <dd class="num">{{ profileUser.phone || '—' }}</dd>
            </div>
            <div>
              <dt>账号状态</dt>
              <dd>{{ profileUser.status === 1 ? '启用' : '停用' }}</dd>
            </div>
            <div>
              <dt>建立时间</dt>
              <dd class="num">{{ profileUser.createdAt }}</dd>
            </div>
            <div>
              <dt>最近签到</dt>
              <dd class="num">{{ formatDateTime(profileUser.lastLoginAt) }}</dd>
            </div>
          </dl>

          <div v-if="profileUser.role !== 'admin'" class="profile__actions">
            <el-button type="primary" plain @click="openFaceCapture(profileUser)">
              <el-icon><Camera /></el-icon>
              {{ profileUser.faceRegistered ? '更换人脸照片' : '补录人脸照片' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- 补录 / 更换人脸照片 -->
    <FaceCaptureDialog
      v-model="faceDialogVisible"
      :name="faceTarget?.name ?? ''"
      :photo="faceTarget?.facePhoto"
      @saved="handleFaceSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid $color-border-light;

  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    align-items: center;
  }

  &__search {
    width: 236px;
  }

  &__select {
    width: 132px;
  }

  &__reset {
    margin-left: $space-1;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }
}

.table-wrap {
  padding: 0 20px 12px;
}

// ---------- 单元格 ----------
.cell-user {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: $radius-sm;

  &:hover &__name {
    color: $color-primary;
  }

  // 人脸照片用 4px 圆角而不是圆形：圆形裁切会切掉额头与下巴，不利于核对
  &__photo {
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    object-fit: cover;
    background: $color-bg-subtle;
    border: 1px solid $color-border-light;
    border-radius: $radius-sm;
  }

  &__avatar {
    display: inline-flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-pill;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  &__name {
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__account {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

// 角色只用文字：管理员加深字重，其余为常规字重
.cell-role {
  font-size: $font-size-sm;
  color: $color-text-secondary;

  &.is-admin {
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }
}

.cell-dept {
  font-size: $font-size-sm;
  color: $color-text-regular;
}

.cell-contact {
  display: flex;
  flex-direction: column;
  font-size: $font-size-sm;
  line-height: 1.35;

  &__email {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.cell-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 2px 0;
  font-size: $font-size-sm;
  cursor: pointer;
  background: none;
  border: none;
  transition: color $duration-fast $ease-standard;

  &.is-active {
    color: $color-text-regular;
  }

  &.is-inactive {
    color: $color-text-placeholder;
  }

  &:hover {
    color: $color-text-primary;
  }
}

.cell-time {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.cell-actions {
  display: flex;
  gap: $space-2;
  justify-content: flex-end;

  :deep(.el-button.is-link) {
    font-size: $font-size-sm;
    color: $color-text-secondary;

    &:hover {
      color: $color-text-primary;
    }
  }

  // 删除按钮平时保持中性，悬浮才提示风险，避免整列泛红
  &__danger:hover {
    color: $color-danger !important;
  }
}

.user-form {
  &__full {
    width: 100%;
  }

  :deep(.el-form-item) {
    margin-bottom: $space-4;
  }
}

// ---------- 档案抽屉 ----------
.profile {
  &__photo {
    max-height: 320px;
    overflow: hidden;
    background: $color-bg-subtle;
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
    aspect-ratio: 4 / 5;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__photo-empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;
    height: 100%;

    span {
      display: grid;
      width: 64px;
      height: 64px;
      font-size: 24px;
      color: $color-text-placeholder;
      background: $color-bg-sunken;
      border-radius: 50%;
      place-items: center;
    }

    p {
      margin: 0;
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }

  &__status {
    display: flex;
    gap: 7px;
    align-items: center;
    margin-top: $space-3;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__note {
    padding: 12px 14px;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-md;
  }

  &__facts {
    display: flex;
    flex-direction: column;
    padding: $space-3 0 0;
    margin: $space-4 0 0;
    border-top: 1px solid $color-border-light;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: $space-4;
      padding: 9px 0;
      border-bottom: 1px solid $color-border-light;

      &:last-child {
        border-bottom: 0;
      }
    }

    dt {
      flex-shrink: 0;
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }

    dd {
      margin: 0;
      font-size: $font-size-sm;
      color: $color-text-primary;
      text-align: right;
    }
  }

  &__actions {
    margin-top: $space-5;

    .el-button {
      width: 100%;
    }
  }
}

@media (max-width: $breakpoint-md) {
  .toolbar {
    padding: 12px 16px;

    &__search {
      width: 100%;
    }

    &__select {
      flex: 1;
      width: auto;
    }
  }

  .table-wrap {
    padding: 0 16px 12px;
  }
}
</style>
