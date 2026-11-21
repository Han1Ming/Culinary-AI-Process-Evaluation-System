<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import AppSkeleton from '@/components/AppSkeleton.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { fetchDashboardOverview, fetchMyOverview, fetchUsers } from '@/api/user'
import { fetchSummaryRoster } from '@/api/summary'
import { useRole } from '@/composables/useRole'
import { formatDateTime } from '@/utils/format'
import type { SummaryStudent } from '@/types/summary'
import type {
  ActivityItem,
  ActivityType,
  DashboardOverview,
  MyOverview,
  StatCardData,
  User,
} from '@/types'

/**
 * 工作台
 * ----------------------------------------------------------------------------
 * 一个路由、三套内容。三个角色进来看的东西本来就不是一回事：
 *   学生 —— 我的课、我的环节得分、我还差什么没交（看不到别人的成绩）；
 *   教师 —— 班级签到率、模块推进、近期动态、待复核；
 *   管理员 —— 在教师视角之上再加账号体系与系统待办，但不参与评分。
 *
 * 三套内容共享同一套版式（统计卡 → 左右两列），差异只在数据与卡片，
 * 这样切换角色时不会像进了另一个系统。
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
})
const my = ref<MyOverview | null>(null)
const users = ref<User[]>([])

/**
 * 教师端的「待复核」直接取综合评价的名单，不另造一份数据。
 * 教师关心的是「今天还有谁没归档」，而不是「六个模块对接了几个」——
 * 后者是交付进度，属于管理员和验收材料，不该占教师的首屏。
 */
const roster = ref<SummaryStudent[]>([])
const pendingAll = computed(() => roster.value.filter((s) => !s.confirmed))
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

const totalStudents = computed(
  () => overview.value.stats.find((item) => item.key === 'students')?.value ?? 0,
)
const checkedIn = computed(
  () => overview.value.stats.find((item) => item.key === 'checkin')?.value ?? 0,
)
const pendingCheckin = computed(() => Math.max(totalStudents.value - checkedIn.value, 0))

const readyCount = computed(() => overview.value.modules.filter((item) => item.ready).length)
const today = formatDateTime(Date.now(), 'YYYY 年 M 月 D 日')

const ringOffset = computed(() => CIRCUMFERENCE * (1 - ringProgress.value / 100))

/* ------------------------------ 学生侧派生 ------------------------------ */

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
    { key: 'students', label: '学生账号', value: students, unit: '个', icon: 'User', tone: 'primary' },
    { key: 'teachers', label: '教师账号', value: teachers, unit: '个', icon: 'Avatar', tone: 'primary' },
    { key: 'noFace', label: '未录入人脸', value: noFace, unit: '人', icon: 'Camera', tone: 'warning' },
    { key: 'disabled', label: '停用账号', value: disabled, unit: '个', icon: 'Warning', tone: 'danger' },
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
    return `${my.value.className} · ${my.value.studentNo}`
  }
  if (isAdmin.value) {
    return `${today} · 账号 ${users.value.length} 个 · 停用 ${users.value.filter((u) => u.status === 0).length} 个`
  }
  return `${today} · 今日已签到 ${checkedIn.value} 人次`
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    if (isStudent.value) {
      my.value = await fetchMyOverview()
    } else {
      overview.value = await fetchDashboardOverview()
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
        </div>

        <div class="dashboard__col">
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
      <div v-else v-stagger class="dashboard__stats">
        <StatCard
          v-for="(item, index) in isAdmin ? adminStats : overview.stats"
          :key="item.key"
          class="animate-in"
          :data="item"
          :index="index"
        />
      </div>

      <div class="dashboard__grid">
        <div class="dashboard__col">
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
  .roles {
    grid-template-columns: minmax(0, 1fr);
  }

  .lesson {
    flex-direction: column;
    align-items: stretch;
    gap: $space-4;
  }
}
</style>
