<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import AppSkeleton from '@/components/AppSkeleton.vue'
import NoticeBoard from '@/components/NoticeBoard.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { fetchDashboardOverview, fetchMyOverview, fetchUsers } from '@/api/user'
import { fetchSummaryRoster } from '@/api/summary'
import { useRole } from '@/composables/useRole'
import { formatDateTime } from '@/utils/format'
import { TRAINING_STATUS_LABEL } from '@/types'
import type {
  ActivityType,
  DashboardOverview,
  DashboardQuery,
  MyOverview,
  StatCardData,
  User,
} from '@/types'
import type { SummaryStudent } from '@/types/summary'

/**
 * 工作台
 * ----------------------------------------------------------------------------
 * 一个路由、三套内容。三个角色进来看的东西本来就不是一回事：
 *   学生 —— 我的课、我的任务与签到状态、我的环节得分、已归档的成绩；
 *   教师 —— 当前实训、签到与实训进度、设备在线情况、模块完成度、待复核；
 *   管理员 —— 账号体系与模块交付进度，不参与评分。
 *
 * 三套内容共享同一套版式（统计卡 → 左右两列），差异只在数据与卡片，
 * 这样切换角色时不会像进了另一个系统。
 *
 * 【口径纪律】工作台上的每个数字都能追到具体名单：应到 = 花名册人数，
 * 摄像头在线 = 设备表里 online 的台数。教师这里不出现「模块对接进度」，
 * 那是交付进度，属于管理员和验收材料。
 */
const router = useRouter()
const { isStudent, isAdmin, role } = useRole()

const loading = ref(true)
// 首次加载完成后置真：之后点「刷新」保留旧数据 + 按钮转圈，不再把内容替换成骨架
const initialized = ref(false)
const showSkeleton = computed(() => loading.value && !initialized.value)

const overview = ref<DashboardOverview>({
  stats: [],
  activities: [],
  modules: [],
  checkinRate: 0,
  session: null,
  completion: [],
  filters: { courses: [], classes: [], tasks: [] },
})
const my = ref<MyOverview | null>(null)
const users = ref<User[]>([])

/** 课程 / 班级 / 任务三级筛选：任一变化都重新取数，选择权交给后端算 */
const filter = ref<Required<DashboardQuery>>({ courseId: '', classId: '', taskId: '' })

const session = computed(() => overview.value.session)
const hasFilter = computed(() => Boolean(filter.value.courseId || filter.value.classId || filter.value.taskId))

/** 空串要发成「不带这个参数」，后端才不会把空串当成一个不存在的课程 id */
function activeQuery(): DashboardQuery {
  return {
    courseId: filter.value.courseId || undefined,
    classId: filter.value.classId || undefined,
    taskId: filter.value.taskId || undefined,
  }
}

/**
 * 统计卡 → 详情页
 * 学号/签到类跳到签到记录的筛选结果，过程与异常类跳到烹饪过程模块，
 * 复核类跳到综合评价。教师没有设备管理权限，所以摄像头卡在教师端跳直播画面。
 */
const cardRoutes: Record<string, string> = {
  total: '/modules/summary',
  checkedIn: '/face-checkin',
  missing: '/face-checkin',
  inTraining: '/modules/cooking',
  completed: '/modules/summary',
  camera: '/modules/cooking',
  review: '/modules/summary',
  anomaly: '/modules/cooking',
  students: '/system/user',
  teachers: '/system/user',
  noFace: '/system/user',
  disabled: '/system/user',
  // 学生端的四张卡：待办是多项、去向不确定，故意不跳
  checkin: '/face-checkin',
  score: '/archive',
  stages: '/modules/summary',
}

function cardTo(key: string): string {
  if (key === 'camera' && isAdmin.value) return '/system/device'
  return cardRoutes[key] ?? ''
}

/**
 * 教师端的「待复核」直接取综合评价的名单，不另造一份数据。
 * 教师关心的是「今天还有谁没归档」，而不是「六个模块对接了几个」——
 * 后者是交付进度，属于管理员和验收材料，不该占教师的首屏。
 */
const roster = ref<SummaryStudent[]>([])
/**
 * 名单按当前筛选的班级裁一次：切到另一个班时，待复核列表不能还挂着上一个班的人。
 * 没取到 session 时不过滤，让教师至少能看到待办，而不是空着。
 */
const pendingAll = computed(() => {
  const className = session.value?.className
  return roster.value.filter((s) => !s.confirmed && (!className || s.className === className))
})
const pendingReviews = computed(() => pendingAll.value.slice(0, 5))

/** 环形图从 0 生长到目标值，需要先把进度置 0 再赋值 */
const ringProgress = ref(0)
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** 快捷入口按角色给：学生不需要「用户管理」，管理员不需要「AI 评价中心」以外的评分入口 */
const shortcuts = computed(() => {
  if (isStudent.value) {
    return [
      { title: '人脸签到', hint: '进工位先签到', icon: 'Camera', path: '/face-checkin' },
      { title: '本节课菜谱', hint: '含难点标注', icon: 'Notebook', path: '/courses' },
      { title: '上传成品', hint: '出锅 5 分钟内拍', icon: 'Dish', path: '/modules/dish' },
      { title: '我的评价', hint: '只看自己的分数', icon: 'DataAnalysis', path: '/modules/summary' },
    ]
  }
  if (isAdmin.value) {
    return [
      { title: '用户管理', hint: '账号 · 角色 · 人脸', icon: 'User', path: '/system/user' },
      { title: '通知发布', hint: '公告与更新日志', icon: 'Bell', path: '/system/notice' },
      { title: '评价总览', hint: '七大模块对接进度', icon: 'DataAnalysis', path: '/ai-eval' },
      { title: '课程管理', hint: '查看教师上传情况', icon: 'Notebook', path: '/courses' },
    ]
  }
  return [
    { title: '课程管理', hint: '上传菜谱、布置实训', icon: 'Notebook', path: '/courses' },
    { title: '评价中心', hint: '七大评价模块', icon: 'DataAnalysis', path: '/ai-eval' },
    { title: '综合评价', hint: '复核 · 归档 · 导出', icon: 'Document', path: '/modules/summary' },
    { title: '人脸签到', hint: '代签核验与补录', icon: 'Camera', path: '/face-checkin' },
  ]
})

/** 动态类型的语义点：只用一个 5px 圆点区分，不做彩色图标块 */
const activityTone: Record<ActivityType, string> = {
  checkin: 'success',
  evaluation: 'primary',
  chat: 'warning',
  system: 'muted',
}

/**
 * 签到三数统一从 session 取，不再从 stats 里按 key 捞：
 * 挖 key 的写法一旦后端改了 card 的 key 就会静默变成 0，且看不出是数据问题还是字段问题。
 */
const totalStudents = computed(() => session.value?.total ?? 0)
const checkedIn = computed(() => session.value?.checkedIn ?? 0)
const pendingCheckin = computed(() => Math.max(totalStudents.value - checkedIn.value, 0))

const readyCount = computed(() => overview.value.modules.filter((item) => item.ready).length)
const today = formatDateTime(Date.now(), 'YYYY 年 M 月 D 日')

const ringOffset = computed(() => CIRCUMFERENCE * (1 - ringProgress.value / 100))

/* ------------------------------ 学生侧派生 ------------------------------ */

const myTask = computed(() => my.value?.task ?? null)
const myCheckin = computed(() => my.value?.checkin ?? null)
const myArchived = computed(() => my.value?.archived ?? [])
const myCheckinText = computed(() => {
  const checkin = myCheckin.value
  if (!checkin || checkin.status === 'missing') return '尚未签到'
  if (checkin.status === 'manual') return `教师补录 · ${checkin.operator ?? '—'}`
  return `${formatDateTime(checkin.at ?? '', 'HH:mm')} 人脸核验通过 · 相似度 ${checkin.similarity?.toFixed(1)}%`
})

/** 已完成环节的加权分（成品未生成时不计入） */
const myEarned = computed(() => {
  const stages = my.value?.stages ?? []
  return stages.reduce((sum, s) => sum + s.score * s.weight, 0)
})
/** 已完成环节的权重合计，用于说明「这个分不是满分口径」 */
const myDoneWeight = computed(() =>
  (my.value?.stages ?? [])
    .filter((s) => s.state !== 'pending')
    .reduce((sum, s) => sum + s.weight, 0),
)
const myPending = computed(() => (my.value?.todos ?? []).filter((t) => !t.done).length)

/* ------------------------------ 管理员派生 ------------------------------ */

const adminStats = computed<StatCardData[]>(() => {
  const students = users.value.filter((u) => u.role === 'student').length
  const teachers = users.value.filter((u) => u.role === 'teacher').length
  const noFace = users.value.filter((u) => u.role === 'student' && !u.faceRegistered).length
  const disabled = users.value.filter((u) => u.status === 0).length
  // 四张卡全部由账号表现算：管理员看的是「账号」，不是教务系统里的在训人数，
  // 混用两个口径会出现「在训 386 人、学生账号只有 4 个」这种自相矛盾的数字。
  return [
    {
      key: 'students',
      label: '学生账号',
      value: students,
      unit: '个',
      note: '可登录的学生账号',
      icon: 'User',
      tone: 'primary',
    },
    {
      key: 'teachers',
      label: '教师账号',
      value: teachers,
      unit: '个',
      note: '含教研室与实训室',
      icon: 'Avatar',
      tone: 'primary',
    },
    {
      key: 'noFace',
      label: '未录入人脸',
      value: noFace,
      unit: '人',
      note: '未录入无法签到',
      icon: 'Camera',
      tone: noFace > 0 ? 'warning' : 'primary',
    },
    {
      key: 'disabled',
      label: '停用账号',
      value: disabled,
      unit: '个',
      note: '可随时恢复',
      icon: 'Warning',
      tone: disabled > 0 ? 'danger' : 'primary',
    },
  ]
})

/** 账号构成：只画三条横条，不做饼图——三个数看不出比例时才需要图 */
const roleBreakdown = computed(() => {
  const total = users.value.length || 1
  const rows = [
    { label: '学生', count: users.value.filter((u) => u.role === 'student').length },
    { label: '教师', count: users.value.filter((u) => u.role === 'teacher').length },
    { label: '管理员', count: users.value.filter((u) => u.role === 'admin').length },
  ]
  return rows.map((row) => ({ ...row, pct: Math.round((row.count / total) * 100) }))
})

const headerTitle = computed(() => (isStudent.value ? '我的实训' : '工作台'))
const headerSubtitle = computed(() => {
  if (!initialized.value) return '正在同步今日教学数据'
  if (isStudent.value && my.value) {
    return `${my.value.className} · 工位 ${my.value.seat} · ${my.value.studentNo}`
  }
  if (isAdmin.value) {
    return `${today} · 账号 ${users.value.length} 个 · 停用 ${users.value.filter((u) => u.status === 0).length} 个`
  }
  if (!session.value) return `${today} · 当前筛选条件下没有实训任务`
  return `${today} · ${session.value.className} · 已签到 ${session.value.checkedIn}/${session.value.total}`
})

/** 筛选变化：保留旧内容，只让下拉后面的数据换掉，避免整页闪一次骨架 */
function onFilterChange(): void {
  void loadData()
}

function resetFilter(): void {
  filter.value = { courseId: '', classId: '', taskId: '' }
  void loadData()
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    if (isStudent.value) {
      my.value = await fetchMyOverview()
    } else {
      overview.value = await fetchDashboardOverview(activeQuery())
      if (isAdmin.value) {
        const page = await fetchUsers({ page: 1, pageSize: 200, keyword: '', role: '', status: '' })
        users.value = page.list
      } else {
        // 取不到名单不该拖垮整个工作台，单独兜底
        try {
          roster.value = (await fetchSummaryRoster()).students
        } catch {
          roster.value = []
        }
      }
      await nextTick()
      // 环图增长：与卡片进场错开，形成「数据落位」的收尾动作
      window.setTimeout(() => {
        ringProgress.value = overview.value.checkinRate
      }, 180)
    }
    initialized.value = true
  } catch {
    ElMessage.error('工作台数据加载失败')
  } finally {
    loading.value = false
  }
}

function go(path: string): void {
  void router.push(path)
}

// 演示账号互相切换时路由可能不重建，这里跟着角色重新取数
watch(role, () => {
  initialized.value = false
  ringProgress.value = 0
  // 上一个角色的筛选条件对新角色没有意义（教师的课程学生看不到），一并清掉
  filter.value = { courseId: '', classId: '', taskId: '' }
  void loadData()
})

onMounted(loadData)
</script>

<template>
  <div class="dashboard">
    <PageHeader :title="headerTitle" :subtitle="headerSubtitle">
      <template #actions>
        <el-button :loading="loading" @click="loadData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-if="isStudent" type="primary" @click="go('/face-checkin')">
          <el-icon><Camera /></el-icon>
          去签到
        </el-button>
        <el-button v-else-if="isAdmin" type="primary" @click="go('/system/notice')">
          <el-icon><Bell /></el-icon>
          发布通知
        </el-button>
        <el-button v-else type="primary" @click="go('/courses')">
          <el-icon><Plus /></el-icon>
          上传课程
        </el-button>
      </template>
    </PageHeader>

    <!-- 筛选条只给教师：学生的数据没有「别的班」，管理员这一页全是账号口径，筛选不影响它 -->
    <section v-if="!isStudent && !isAdmin" class="filter-bar">
      <div class="filter-bar__group">
        <label class="filter-bar__label" for="filter-course">课程</label>
        <el-select
          id="filter-course"
          v-model="filter.courseId"
          class="filter-bar__select"
          placeholder="全部课程"
          clearable
          @change="onFilterChange"
        >
          <el-option
            v-for="item in overview.filters.courses"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="filter-bar__group">
        <label class="filter-bar__label" for="filter-class">班级</label>
        <el-select
          id="filter-class"
          v-model="filter.classId"
          class="filter-bar__select"
          placeholder="全部班级"
          clearable
          @change="onFilterChange"
        >
          <el-option
            v-for="item in overview.filters.classes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="filter-bar__group">
        <label class="filter-bar__label" for="filter-task">实训任务</label>
        <el-select
          id="filter-task"
          v-model="filter.taskId"
          class="filter-bar__select filter-bar__select--wide"
          placeholder="全部任务"
          clearable
          @change="onFilterChange"
        >
          <el-option
            v-for="item in overview.filters.tasks"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <el-button v-if="hasFilter" link type="primary" class="filter-bar__reset" @click="resetFilter">
        清除筛选
      </el-button>
      <span class="filter-bar__hint">统计范围随筛选变化，全部数据来自接口</span>
    </section>

    <!-- ==================== 学生：只有自己的数据 ==================== -->
    <template v-if="isStudent">
      <AppSkeleton v-if="showSkeleton" variant="stats" :count="4" />
      <div v-else-if="my" v-stagger class="dashboard__stats">
        <StatCard
          v-for="(item, index) in my.stats"
          :key="item.key"
          class="animate-in"
          :data="item"
          :index="index"
          :to="cardTo(item.key)"
          @select="go"
        />
      </div>

      <div class="dashboard__grid">
        <div class="dashboard__col">
          <!-- 本节课：学生进来第一件事是「今天做什么」 -->
          <section class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">本节课</h2>
                <p v-if="my?.course" class="card-head__desc">
                  {{ formatDateTime(my.course.lessonAt, 'M 月 D 日 HH:mm') }} · {{ my.stages.length }} 个评价环节
                </p>
              </div>
              <el-button link type="primary" @click="go('/courses')">全部课程</el-button>
            </div>

            <div v-if="my?.course" class="lesson">
              <div class="lesson__main">
                <h3 class="lesson__title">{{ my.course.title }}</h3>
                <p class="lesson__goal">{{ my.course.goal }}</p>
                <ul class="lesson__dishes">
                  <li v-for="dish in my.course.dishes" :key="dish">{{ dish }}</li>
                </ul>
              </div>
              <div class="lesson__actions">
                <el-button @click="go(`/courses/${my.course.id}`)">查看菜谱</el-button>
                <el-button type="primary" @click="go(`/courses/${my.course.id}`)">解析难点</el-button>
              </div>
            </div>
            <p v-else class="empty-line">还没有安排课程，等教师上传菜谱后这里会出现</p>

            <!-- 任务与签到：学生进页面第二件要知道的事，就写在这张卡里，不再单开一张 -->
            <dl v-if="myTask" class="task-state">
              <div>
                <dt>实训任务</dt>
                <dd>
                  {{ myTask.title }}
                  <span class="tag" :class="`is-${myTask.status}`">
                    {{ TRAINING_STATUS_LABEL[myTask.status] }}
                  </span>
                </dd>
              </div>
              <div>
                <dt>实训时间</dt>
                <dd class="num">
                  {{ formatDateTime(myTask.startedAt, 'M 月 D 日 HH:mm') }} –
                  {{ formatDateTime(myTask.endedAt, 'HH:mm') }}
                </dd>
              </div>
              <div>
                <dt>当前环节</dt>
                <dd>{{ myTask.step || '尚未开始' }}</dd>
              </div>
              <div>
                <dt>签到状态</dt>
                <dd :class="{ 'is-missing': myCheckin?.status === 'missing' }">
                  {{ myCheckinText }}
                  <el-button
                    v-if="myCheckin?.status === 'missing'"
                    link
                    type="primary"
                    @click="go('/face-checkin')"
                  >
                    去签到
                  </el-button>
                </dd>
              </div>
            </dl>
            <p v-else class="empty-line">今天没有安排实训任务</p>
          </section>

          <!-- 我的环节得分 -->
          <section class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">我的环节得分</h2>
                <p class="card-head__desc">
                  已完成 {{ Math.round(myDoneWeight * 100) }}% 权重，折算
                  <span class="num">{{ myEarned.toFixed(1) }}</span> 分
                </p>
              </div>
              <el-button link type="primary" @click="go('/modules/summary')">查看报告</el-button>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="5" />
            <ul v-else-if="my" class="stages animate-fade">
              <li v-for="stage in my.stages" :key="stage.key" class="stage">
                <div class="stage__row">
                  <span class="stage__label">{{ stage.label }}</span>
                  <span class="stage__weight num">占 {{ Math.round(stage.weight * 100) }}%</span>
                  <span class="stage__state" :class="`is-${stage.state}`">
                    {{ stage.state === 'pending' ? '待生成' : stage.state === 'running' ? '进行中' : '已完成' }}
                  </span>
                  <span class="stage__score num">{{ stage.state === 'pending' ? '—' : stage.score }}</span>
                </div>
                <div class="meter">
                  <div
                    class="meter__fill"
                    :class="stage.state === 'pending' ? 'meter__fill--muted' : ''"
                    :style="{ '--value': `${stage.score}%` }"
                  />
                </div>
              </li>
            </ul>
          </section>

          <!-- 已归档的成绩：冻结过的东西与「本轮进行中」分开放，不混成一个数 -->
          <section class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">已归档的成绩</h2>
                <p class="card-head__desc">归档后分数冻结，日后调整权重不影响这一份</p>
              </div>
              <el-button link type="primary" @click="go('/archive')">实训档案</el-button>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="2" />
            <ul v-else-if="myArchived.length" class="archived animate-fade">
              <li v-for="item in myArchived" :key="item.id" class="archived__row">
                <div class="archived__main">
                  <span class="archived__title">{{ item.taskTitle }}</span>
                  <span class="archived__meta">
                    {{ item.archivedAt }} · 规则 {{ item.ruleVersion }}
                  </span>
                </div>
                <span class="archived__total num">{{ item.total }}</span>
                <span class="archived__grade">{{ item.grade }}</span>
              </li>
            </ul>
            <p v-else class="empty-line">
              还没有归档成绩。本节实训结束、教师完成复核归档后出现在这里
            </p>
          </section>
        </div>

        <div class="dashboard__col">
          <!-- 公告：学生的日程由公告驱动（停课、维护、口径调整），所以放在右栏第一位 -->
          <NoticeBoard :limit="3" />

          <!-- 待办 -->
          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">待完成</h2>
              <span v-if="my" class="card-head__desc num">{{ myPending }} 项</span>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="3" />
            <ul v-else-if="my" class="todos animate-fade">
              <li v-for="todo in my.todos" :key="todo.id">
                <button
                  type="button"
                  class="todo"
                  :class="{ 'is-done': todo.done }"
                  @click="go(todo.to)"
                >
                  <span class="todo__mark" aria-hidden="true" />
                  <span class="todo__body">
                    <span class="todo__title">{{ todo.title }}</span>
                    <span class="todo__hint">{{ todo.hint }}</span>
                  </span>
                  <el-icon class="todo__arrow"><ArrowRight /></el-icon>
                </button>
              </li>
            </ul>
          </section>

          <!-- 我的动态 -->
          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">最近记录</h2>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="3" />
            <ul v-else-if="my" class="feed animate-fade">
              <li v-for="item in my.activities" :key="item.id" class="feed__item">
                <span
                  class="status-dot"
                  :class="`status-dot--${activityTone[item.type] ?? 'muted'}`"
                  aria-hidden="true"
                />
                <div class="feed__body">
                  <p class="feed__title">{{ item.title }}</p>
                  <p class="feed__desc">{{ item.description }}</p>
                </div>
                <time class="feed__time">{{ formatDateTime(item.time, 'MM-DD HH:mm') }}</time>
              </li>
            </ul>
          </section>

          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">快捷入口</h2>
            </div>
            <ul class="shortcuts">
              <li v-for="link in shortcuts" :key="link.path">
                <button type="button" class="shortcut" @click="go(link.path)">
                  <el-icon class="shortcut__icon"><component :is="link.icon" /></el-icon>
                  <span class="shortcut__title">{{ link.title }}</span>
                  <span class="shortcut__hint">{{ link.hint }}</span>
                  <el-icon class="shortcut__arrow"><ArrowRight /></el-icon>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>

    <!-- ==================== 教师 / 管理员 ==================== -->
    <template v-else>
      <AppSkeleton v-if="showSkeleton" variant="stats" :count="4" />
      <!-- 没有匹配任务时卡片区整块不出现：8 张卡全写 0 会被读成「这个班一个人都没来」 -->
      <div v-else-if="isAdmin || session" v-stagger class="dashboard__stats">
        <StatCard
          v-for="(item, index) in isAdmin ? adminStats : overview.stats"
          :key="item.key"
          class="animate-in"
          :data="item"
          :index="index"
          :to="cardTo(item.key)"
          @select="go"
        />
      </div>
      <p v-else class="empty-note">
        这个筛选条件下没有实训任务。换一个课程或班级，或者到「课程管理」里布置一次实训。
      </p>

      <div class="dashboard__grid">
        <div class="dashboard__col">
          <!-- 当前实训：课程 / 班级 / 任务 / 时间，教师第一眼要对上号的就是这四件 -->
          <section v-if="!isAdmin && session" class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">
                  {{ session.taskTitle }}
                  <span class="tag" :class="`is-${session.status}`">
                    {{ TRAINING_STATUS_LABEL[session.status] }}
                  </span>
                </h2>
                <p class="card-head__desc">{{ session.courseTitle }}</p>
              </div>
              <el-button link type="primary" @click="go('/courses')">课程详情</el-button>
            </div>

            <dl class="session">
              <div>
                <dt>班级</dt>
                <dd>{{ session.className }}</dd>
              </div>
              <div>
                <dt>任课教师</dt>
                <dd>{{ session.teacher }}</dd>
              </div>
              <div>
                <dt>实训时间</dt>
                <dd class="num">
                  {{ formatDateTime(session.startedAt, 'M 月 D 日 HH:mm') }} –
                  {{ formatDateTime(session.endedAt, 'HH:mm') }}
                </dd>
              </div>
              <div>
                <dt>实训进度</dt>
                <dd>
                  正在进行 <span class="num">{{ session.inTraining }}</span> 人 · 已完成
                  <span class="num">{{ session.completed }}</span> 人 · 已归档
                  <span class="num">{{ session.archived }}</span> 份
                </dd>
              </div>
            </dl>
          </section>

          <!-- 管理员：账号体系 -->
          <section v-if="isAdmin" class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">账号构成</h2>
                <p class="card-head__desc">共 {{ users.length }} 个账号</p>
              </div>
              <el-button link type="primary" @click="go('/system/user')">用户管理</el-button>
            </div>

            <ul class="roles">
              <li v-for="row in roleBreakdown" :key="row.label" class="role">
                <div class="role__row">
                  <span class="role__label">{{ row.label }}</span>
                  <span class="role__pct num">{{ row.pct }}%</span>
                  <span class="role__count num">{{ row.count }} 个</span>
                </div>
                <div class="meter">
                  <div class="meter__fill" :style="{ '--value': `${row.pct}%` }" />
                </div>
              </li>
            </ul>
          </section>

          <!-- 模块进度：交付进度，只给管理员看 -->
          <section v-if="isAdmin" class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">评价模块进度</h2>
                <p v-if="showSkeleton" class="card-head__desc">
                  <span class="sk" style="width: 96px; height: 10px" />
                </p>
                <p v-else class="card-head__desc">
                  {{ readyCount }} / {{ overview.modules.length }} 个模块已上线
                </p>
              </div>
              <el-button link type="primary" @click="go('/ai-eval')">全部模块</el-button>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="3" />
            <ul v-if="!showSkeleton" class="modules animate-fade">
              <li v-for="mod in overview.modules" :key="mod.key" class="module">
                <div class="module__row">
                  <span class="module__name" :title="mod.description">{{ mod.name }}</span>
                  <span class="module__state" :class="{ 'is-ready': mod.ready }">
                    {{ mod.ready ? '已上线' : '对接中' }}
                  </span>
                  <span class="module__pct num">{{ mod.progress }}%</span>
                </div>
                <div class="meter">
                  <div
                    class="meter__fill"
                    :class="mod.ready ? '' : 'meter__fill--muted'"
                    :style="{ '--value': `${mod.progress}%` }"
                  />
                </div>
              </li>
            </ul>
          </section>

          <!-- 待复核：教师首屏要回答的是「还有谁没归档」，不是模块上线了几个 -->
          <section v-else class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">待复核</h2>
                <p class="card-head__desc">
                  {{ pendingAll.length }} 份未归档<template v-if="pendingAll.length > 5">，先列前 5 份</template>
                </p>
              </div>
              <el-button link type="primary" @click="go('/modules/summary')">去归档</el-button>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="4" />
            <ul v-else-if="pendingReviews.length" class="reviews animate-fade">
              <li v-for="stu in pendingReviews" :key="stu.id">
                <button type="button" class="review" @click="go('/modules/summary')">
                  <span class="review__name">{{ stu.name }}</span>
                  <span class="review__meta num">{{ stu.studentNo }} · 工位 {{ stu.seat }}</span>
                  <span class="review__state">未归档</span>
                  <el-icon class="review__arrow"><ArrowRight /></el-icon>
                </button>
              </li>
            </ul>
            <p v-else class="empty-line">本节课的成绩都已归档</p>
          </section>

          <!-- 各模块完成情况：教师看的是「这个班走完了几项」，不是「接口对接了几个」 -->
          <section v-if="!isAdmin && session" class="app-card">
            <div class="card-head">
              <div>
                <h2 class="card-head__title">各评价模块完成情况</h2>
                <p class="card-head__desc">
                  按本节应到 <span class="num">{{ session.total }}</span> 人计；未开启的模块不给完成率
                </p>
              </div>
              <el-button link type="primary" @click="go('/ai-eval')">逐个查看</el-button>
            </div>

            <ul class="completion">
              <li v-for="mod in overview.completion" :key="mod.key" class="completion__row">
                <div class="completion__head">
                  <span class="completion__name">{{ mod.name }}</span>
                  <span v-if="!mod.active" class="completion__state">本节未开启</span>
                  <span v-else class="completion__count num">
                    {{ mod.done }} / {{ mod.total }}
                  </span>
                </div>
                <div class="meter">
                  <div
                    class="meter__fill"
                    :class="mod.active ? '' : 'meter__fill--muted'"
                    :style="{
                      '--value': mod.active && mod.total ? `${Math.round((mod.done / mod.total) * 100)}%` : '0%',
                    }"
                  />
                </div>
              </li>
            </ul>
          </section>

          <!-- 近期动态 -->
          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">近期动态</h2>
              <el-button link @click="go('/ai-eval')">查看全部</el-button>
            </div>

            <AppSkeleton v-if="showSkeleton" variant="list" :count="4" />
            <ul v-if="!showSkeleton" class="feed animate-fade">
              <li v-for="item in overview.activities" :key="item.id" class="feed__item">
                <span
                  class="status-dot"
                  :class="`status-dot--${activityTone[item.type] ?? 'muted'}`"
                  aria-hidden="true"
                />
                <div class="feed__body">
                  <p class="feed__title">{{ item.title }}</p>
                  <p class="feed__desc">{{ item.description }}</p>
                </div>
                <time class="feed__time">{{ formatDateTime(item.time, 'MM-DD HH:mm') }}</time>
              </li>
            </ul>
          </section>
        </div>

        <div class="dashboard__col">
          <!-- 今日签到率 -->
          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">今日签到率</h2>
              <span class="checkin__badge">
                <span class="status-dot status-dot--success status-dot--live" />
                实时
              </span>
            </div>

            <div v-if="showSkeleton" class="checkin-skeleton">
              <span class="sk sk--circle" style="width: 148px; height: 148px" />
              <div class="checkin-skeleton__facts">
                <span v-for="i in 3" :key="i" class="sk" style="height: 56px" />
              </div>
              <span class="sk sk--block" style="width: 100%; height: 36px" />
            </div>

            <div v-else class="checkin">
              <div class="checkin__ring">
                <svg viewBox="0 0 120 120" role="img" aria-label="今日签到率">
                  <circle class="checkin__track" cx="60" cy="60" :r="RADIUS" />
                  <circle
                    class="checkin__bar"
                    cx="60"
                    cy="60"
                    :r="RADIUS"
                    :stroke-dasharray="CIRCUMFERENCE"
                    :stroke-dashoffset="ringOffset"
                  />
                </svg>
                <div class="checkin__center">
                  <strong class="num">{{ overview.checkinRate.toFixed(1) }}%</strong>
                  <span>已签到</span>
                </div>
              </div>

              <dl class="checkin__facts">
                <div>
                  <dt>应到</dt>
                  <dd class="num">{{ totalStudents }}</dd>
                </div>
                <div>
                  <dt>已签到</dt>
                  <dd class="num">{{ checkedIn }}</dd>
                </div>
                <div>
                  <dt>未签到</dt>
                  <dd class="num">{{ pendingCheckin }}</dd>
                </div>
              </dl>

              <el-button class="checkin__btn" plain @click="go('/face-checkin')">
                进入签到页
              </el-button>
            </div>
          </section>

          <!--
            公告：教师与管理员右栏第一张卡是「今日签到率」——那是正在发生的现场，
            不能被公告挤下去；公告放在快捷入口之前，属于「后台信息」区。
          -->
          <NoticeBoard :limit="2" />

          <!-- 快捷入口：竖排列表，不用彩色图标网格 -->
          <section class="app-card">
            <div class="card-head">
              <h2 class="card-head__title">快捷入口</h2>
            </div>

            <ul class="shortcuts">
              <li v-for="link in shortcuts" :key="link.path">
                <button type="button" class="shortcut" @click="go(link.path)">
                  <el-icon class="shortcut__icon"><component :is="link.icon" /></el-icon>
                  <span class="shortcut__title">{{ link.title }}</span>
                  <span class="shortcut__hint">{{ link.hint }}</span>
                  <el-icon class="shortcut__arrow"><ArrowRight /></el-icon>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  &__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: $space-4;
    margin-bottom: $space-4;
  }
  // 左右两列各自成栈，卡片按内容高度自然排布，不留齐平空白
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
    gap: $space-4;
    align-items: start;
  }

  &__col {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    min-width: 0;
  }
}

// ---------- 本节课 ----------
.lesson {
  display: flex;
  gap: $space-6;
  align-items: flex-end;
  justify-content: space-between;

  &__main {
    min-width: 0;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
    letter-spacing: -0.01em;
  }

  &__goal {
    max-width: 52ch;
    margin-top: 6px;
    font-size: $font-size-sm;
    line-height: 1.65;
    color: $color-text-secondary;
  }

  &__dishes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;

    li {
      padding: 3px 9px;
      font-size: $font-size-xs;
      color: $color-text-regular;
      background: $color-bg-subtle;
      border-radius: $radius-sm;
    }
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
  }
}

// ---------- 我的环节得分 ----------
.stages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-5 $space-6;
}

.stage {
  &__row {
    display: flex;
    gap: $space-2;
    align-items: baseline;
    margin-bottom: 8px;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__weight {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__state {
    flex: 1;
    font-size: 11px;
    color: $color-text-placeholder;
    text-align: right;

    &.is-running {
      color: $color-warning;
    }

    &.is-done {
      color: $color-success;
    }
  }

  &__score {
    min-width: 26px;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    text-align: right;
  }
}

// ---------- 待办 ----------
.todos {
  li + li {
    border-top: 1px solid $color-border-light;
  }
}

.todo {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 11px 6px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-hover;

    .todo__arrow {
      color: $color-text-secondary;
      transform: translateX(2px);
    }
  }

  // 未完成是空心圆，完成是实心 — 不用对勾图标，避免和「已完成」文字重复
  &__mark {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    border: 1.5px solid $color-border-strong;
    border-radius: 50%;
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__hint {
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    flex: 0 0 12px;
    font-size: 12px;
    color: $color-text-placeholder;
    transition: transform $duration-fast $ease-standard, color $duration-fast $ease-standard;
  }

  &.is-done {
    .todo__mark {
      background: $color-text-placeholder;
      border-color: $color-text-placeholder;
    }

    .todo__title {
      color: $color-text-placeholder;
      text-decoration: line-through;
    }
  }
}

// ---------- 账号构成 ----------
.roles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-5;
}

.role {
  &__row {
    display: flex;
    gap: $space-2;
    align-items: baseline;
    margin-bottom: 8px;
  }

  &__label {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__pct {
    flex: 1;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__count {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.empty-line {
  padding: 18px 0;
  font-size: $font-size-sm;
  color: $color-text-placeholder;
}

// ---------- 模块进度 ----------
.modules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-5 $space-6;
}

.module {
  &__row {
    display: flex;
    gap: $space-2;
    align-items: baseline;
    margin-bottom: 8px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    font-size: 11px;
    color: $color-text-placeholder;

    &.is-ready {
      color: $color-success;
    }
  }

  &__pct {
    min-width: 34px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    text-align: right;
  }
}

// ---------- 待复核 ----------
.reviews {
  li + li {
    border-top: 1px solid $color-border-light;
  }
}

.review {
  display: flex;
  gap: 10px;
  align-items: baseline;
  width: 100%;
  padding: 10px 6px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-hover;

    .review__arrow {
      color: $color-text-secondary;
      transform: translateX(2px);
    }
  }

  &__name {
    flex-shrink: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__meta {
    flex: 1;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    flex-shrink: 0;
    font-size: 11px;
    color: $color-warning;
  }

  &__arrow {
    flex: 0 0 12px;
    font-size: 12px;
    color: $color-text-placeholder;
    transition: transform $duration-fast $ease-standard, color $duration-fast $ease-standard;
  }
}

// ---------- 近期动态 ----------
.feed {
  &__item {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    padding: 11px 0;
    border-top: 1px solid $color-border-light;

    &:first-child {
      padding-top: 2px;
      border-top: none;
    }

    &:last-child {
      padding-bottom: 0;
    }

    .status-dot {
      margin-top: 7px;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    margin-top: 2px;
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    flex-shrink: 0;
    padding-top: 1px;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

// ---------- 签到率 ----------
.checkin {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  align-items: center;

  &__badge {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__ring {
    position: relative;
    width: 148px;
    height: 148px;

    svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
  }

  &__track {
    fill: none;
    stroke: $color-bg-sunken;
    stroke-width: 7;
  }

  // 环用深墨色而非品牌蓝：整页只有主按钮是蓝的，避免大面积彩色
  &__bar {
    fill: none;
    stroke: $color-text-primary;
    stroke-width: 7;
    stroke-linecap: round;
    transition: stroke-dashoffset 900ms $ease-emphasized;
  }

  &__center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    justify-content: center;

    strong {
      font-size: 27px;
      font-weight: $font-weight-semibold;
      line-height: 1;
      color: $color-text-primary;
      letter-spacing: -0.02em;
    }

    span {
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    padding: $space-3 0;
    margin: 0;
    border-top: 1px solid $color-border-light;
    border-bottom: 1px solid $color-border-light;

    div {
      text-align: center;

      & + div {
        border-left: 1px solid $color-border-light;
      }
    }

    dt {
      font-size: 11px;
      color: $color-text-placeholder;
    }

    dd {
      margin: 3px 0 0;
      font-size: $font-size-md;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  &__btn {
    width: 100%;
  }
}

// 签到率卡的骨架：与真实结构等高，避免数据到达时整卡跳动
.checkin-skeleton {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  align-items: center;

  &__facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $space-3;
    width: 100%;
  }
}

// ---------- 快捷入口 ----------
.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 2px;

  li + li {
    border-top: 1px solid $color-border-light;
  }
}

.shortcut {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 9px 8px;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-hover;

    .shortcut__icon {
      color: $color-text-primary;
    }

    .shortcut__arrow {
      color: $color-text-secondary;
      transform: translateX(2px);
    }
  }

  &__icon {
    flex: 0 0 16px;
    font-size: 16px;
    color: $color-text-placeholder;
    transition: color $duration-fast $ease-standard;
  }

  &__title {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__hint {
    flex: 1;
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    flex: 0 0 12px;
    font-size: 12px;
    color: $color-text-placeholder;
    transition: transform $duration-fast $ease-standard, color $duration-fast $ease-standard;
  }
}

// ---------- 筛选条 ----------
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3 $space-4;
  align-items: center;
  padding: 12px $card-padding;
  margin-bottom: $space-4;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__label {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    white-space: nowrap;
  }

  &__select {
    width: 180px;

    &--wide {
      width: 220px;
    }
  }

  &__reset {
    margin-left: auto;
  }

  &__hint {
    margin-left: auto;
    font-size: 11px;
    color: $color-text-placeholder;
  }

  // 清除筛选与说明文字互斥，只有其中之一靠右
  &__reset + &__hint {
    margin-left: $space-3;
  }
}

// ---------- 状态标签 ----------
// 只用文字 + 一个语义色，不做胶囊底：这一页的彩色元素已经够少了
.tag {
  margin-left: 8px;
  font-size: 11px;
  color: $color-text-placeholder;

  &.is-running {
    color: $color-warning;
  }

  &.is-finished {
    color: $color-text-secondary;
  }
}

// ---------- 当前实训 ----------
.session {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4 $space-6;
  margin: 0;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 4px 0 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }
}

// ---------- 学生：任务与签到 ----------
.task-state {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4 $space-6;
  padding-top: $space-4;
  margin: $space-4 0 0;
  border-top: 1px solid $color-border-light;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 4px 0 0;
    font-size: $font-size-sm;
    color: $color-text-primary;

    &.is-missing {
      color: $color-danger;
    }
  }
}

// ---------- 学生：已归档成绩 ----------
.archived {
  li + li {
    border-top: 1px solid $color-border-light;
  }

  &__row {
    display: flex;
    gap: $space-3;
    align-items: baseline;
    padding: 10px 0;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__total {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__grade {
    min-width: 32px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
    text-align: right;
  }
}

// ---------- 各模块完成情况 ----------
.completion {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4 $space-6;

  &__head {
    display: flex;
    gap: $space-2;
    align-items: baseline;
    margin-bottom: 8px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__state {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

// 没有匹配任务时的整段说明：宁可写一句话，也不摆 8 个 0
.empty-note {
  padding: $space-6 $card-padding;
  margin-bottom: $space-4;
  font-size: $font-size-sm;
  line-height: 1.7;
  color: $color-text-secondary;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
}

@media (max-width: 1180px) {
  .dashboard__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: $breakpoint-lg) {
  .dashboard__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: $breakpoint-sm) {
  .dashboard__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .modules,
  .stages,
  .roles,
  .session,
  .task-state,
  .completion {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;

    &__select,
    &__select--wide {
      flex: 1;
      width: auto;
    }

    &__reset,
    &__hint {
      margin-left: 0;
      text-align: left;
    }
  }

  .lesson {
    flex-direction: column;
    align-items: stretch;
    gap: $space-4;
  }
}
</style>
