<script setup lang="ts">
/**
 * 个人中心
 * ----------------------------------------------------------------------------
 * 一个页面，两个入口（侧栏底部 + 右上角用户名），三个角色共用。
 *
 * 【为什么不新造数据】
 * 这里显示的东西全部来自已经在用的来源，只是换了个视角：
 *   姓名 / 手机 / 邮箱 / 最后登录 ← 账号（useAuthStore / GET /profile）
 *   学号 / 班级 / 人脸照片        ← 花名册（与学生档案同源）
 *   成绩与趋势                    ← 实训档案的历次记录 + 综合评价的环节分
 *   课表                          ← 课程与班级关系
 * 如果这里另算一套，「个人中心 88 分、档案页 85 分」会立刻被学生发现。
 *
 * 【角色差异】
 *   学生：本人信息 + 环节得分 + 趋势 + 最近一次成绩；
 *   教师：本人信息 + 授课课表 + 所带班级成绩概览（人数 / 均分 / 待复核）。
 * 教师不显示"我的成绩"——他没有成绩，显示班级概览才对。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import AppSkeleton from '@/components/AppSkeleton.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import { fetchProfileOverview, updateContact } from '@/api/profile'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'
import { ROLE_LABELS } from '@/types'
import { WEEKDAY_LABEL, type ProfileLesson, type ProfileOverview } from '@/types/profile'

const router = useRouter()
const auth = useAuthStore()
const { isStudent } = useRole()

const loading = ref(true)
const loadError = ref('')
const data = ref<ProfileOverview | null>(null)

const contactVisible = ref(false)
const contactSaving = ref(false)
const contact = ref({ phone: '', email: '' })

const base = computed(() => data.value?.base ?? null)
const scores = computed(() => data.value?.scores ?? null)

/** 教师课表按星期分组；学生为空数组，整块不渲染 */
const lessonsByDay = computed<Array<{ day: number; label: string; lessons: ProfileLesson[] }>>(() => {
  const lessons = data.value?.timetable ?? []
  const days = new Map<number, ProfileLesson[]>()
  for (const lesson of lessons) {
    const list = days.get(lesson.weekday) ?? []
    list.push(lesson)
    days.set(lesson.weekday, list)
  }
  return [...days.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({
      day,
      label: WEEKDAY_LABEL[day] ?? `第 ${day} 天`,
      lessons: list.sort((a, b) => a.period.localeCompare(b.period, 'zh')),
    }))
})

/**
 * 身份事实（学号/工号、手机、邮箱……）按角色拼装。
 * 教师没有独立工号，`code` 就是登录账号，两行都写会出现「工号 teacher_chen / 账号 teacher_chen」
 * 这种一眼可见的重复；同理学生的学号本身就是登录账号，重复时只保留学号一行。
 */
const facts = computed<Array<{ label: string; value: string; numeric?: boolean; wide?: boolean }>>(() => {
  const b = base.value
  if (!b) return []
  const rows: Array<{ label: string; value: string; numeric?: boolean; wide?: boolean }> = []

  if (isStudent.value) {
    rows.push({ label: '学号', value: b.code, numeric: true })
    rows.push({ label: '班级', value: b.department })
    if (b.username && b.username !== b.code) {
      rows.push({ label: '登录账号', value: b.username, numeric: true })
    }
  } else {
    rows.push({ label: '登录账号', value: b.username, numeric: true })
    rows.push({ label: '教研室', value: b.department })
  }

  rows.push({ label: '手机号', value: b.phone || '—', numeric: true })
  rows.push({
    label: '开通时间',
    value: b.createdAt ? formatDateTime(b.createdAt, 'YYYY-MM-DD') : '—',
    numeric: true,
  })
  rows.push({
    label: '上次登录',
    value: b.lastLoginAt ? formatDateTime(b.lastLoginAt, 'MM-DD HH:mm') : '—',
    numeric: true,
  })
  // 邮箱最长，独占一行避免被两列挤断
  rows.push({ label: '邮箱', value: b.email || '—', wide: true })
  return rows
})

/* --------------------------- 趋势折线（手绘 SVG） --------------------------- */

const CHART = { w: 520, h: 132, top: 14, bottom: 22, left: 12, right: 12 }

/**
 * 纵轴刻度：以实际得分区间取整到 10 的倍数，上下各留 8 分余量。
 * 固定按 0–100 画会得到一条贴着顶边的直线，看不出起伏；
 * 收紧区间必须同时画出刻度值，否则读者会误以为是 0–100 的刻度。
 */
const domain = computed(() => {
  const values = (scores.value?.trend ?? []).map((item) => item.value)
  if (!values.length) return { lo: 0, hi: 100 }
  let lo = Math.max(0, Math.floor((Math.min(...values) - 8) / 10) * 10)
  let hi = Math.min(100, Math.ceil((Math.max(...values) + 8) / 10) * 10)
  if (hi - lo < 20) {
    hi = Math.min(100, lo + 20)
    lo = Math.max(0, hi - 20)
  }
  return { lo, hi }
})

const trendPoints = computed(() => {
  const items = scores.value?.trend ?? []
  if (!items.length) return []
  const innerW = CHART.w - CHART.left - CHART.right
  const innerH = CHART.h - CHART.top - CHART.bottom
  const span = domain.value.hi - domain.value.lo || 100
  const step = items.length > 1 ? innerW / (items.length - 1) : 0
  return items.map((item, index) => ({
    ...item,
    x: CHART.left + step * index,
    y: CHART.top + innerH * (1 - (Math.min(domain.value.hi, Math.max(domain.value.lo, item.value)) - domain.value.lo) / span),
    // 首尾标签改为左/右对齐，避免被卡片边缘裁掉（曾出现最后一个日期变成「11-2」）
    anchor: index === 0 ? 'start' : index === items.length - 1 ? 'end' : 'middle',
  }))
})

const trendPath = computed(() => {
  const points = trendPoints.value
  if (points.length < 2) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
})

const trendArea = computed(() => {
  const points = trendPoints.value
  if (points.length < 2) return ''
  const baseline = CHART.h - CHART.bottom
  return `${trendPath.value} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`
})

/* --------------------------------- 交互 --------------------------------- */

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await fetchProfileOverview(auth.user?.username ?? '')
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '个人信息加载失败'
  } finally {
    loading.value = false
  }
}

function openContact(): void {
  contact.value = { phone: base.value?.phone ?? '', email: base.value?.email ?? '' }
  contactVisible.value = true
}

async function saveContact(): Promise<void> {
  const phone = contact.value.phone.trim()
  const email = contact.value.email.trim()
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    ElMessage.warning('手机号格式不正确')
    return
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ElMessage.warning('邮箱格式不正确')
    return
  }
  contactSaving.value = true
  try {
    await updateContact({ phone, email })
    if (data.value) {
      data.value.base.phone = phone
      data.value.base.email = email
    }
    contactVisible.value = false
    ElMessage.success('联系方式已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    contactSaving.value = false
  }
}

function goArchive(studentId?: number): void {
  void router.push(studentId ? `/archive/${studentId}` : '/archive')
}

onMounted(load)
</script>

<template>
  <div class="profile-page">
    <PageHeader
      title="个人中心"
      :subtitle="
        base
          ? `${ROLE_LABELS[base.role]} · ${base.department} · 上次登录 ${formatDateTime(base.lastLoginAt, 'MM-DD HH:mm')}`
          : '正在读取账号信息'
      "
    >
      <template #actions>
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" plain @click="openContact">修改联系方式</el-button>
      </template>
    </PageHeader>

    <AppSkeleton v-if="loading && !data" variant="stats" :count="3" />
    <StateView
      v-else-if="loadError"
      state="error"
      :description="loadError"
      retryable
      @retry="load"
    />

    <div v-else-if="data && base" class="profile-grid">
      <!-- ============ 左：身份与联系 ============ -->
      <section class="app-card identity">
        <div class="identity__top">
          <div class="identity__photo">
            <img v-if="base.facePhoto" :src="base.facePhoto" :alt="`${base.name}的人脸照片`" />
            <span v-else class="identity__initial">{{ base.name.slice(0, 1) }}</span>
            <!-- 教师不参与人脸签到，徽标只在学生视角出现 -->
            <span
              v-if="isStudent"
              class="identity__badge"
              :class="base.faceRegistered ? 'is-ok' : 'is-missing'"
            >
              {{ base.faceRegistered ? '已录入人脸' : '未录入人脸' }}
            </span>
          </div>
          <div class="identity__head">
            <h2>{{ base.name }}</h2>
            <p class="identity__role">{{ ROLE_LABELS[base.role] }}</p>
            <p class="identity__dept">{{ base.department }}</p>
          </div>
        </div>

        <dl class="facts">
          <div v-for="row in facts" :key="row.label" :class="{ facts__wide: row.wide }">
            <dt>{{ row.label }}</dt>
            <dd :class="{ num: row.numeric }">{{ row.value }}</dd>
          </div>
        </dl>

        <p v-if="isStudent && !base.faceRegistered" class="identity__hint">
          还没有录入人脸照片，签到时识别不到你。请到「人脸识别签到」页面完成采集，或联系任课教师补录。
        </p>
        <p v-else-if="isStudent" class="identity__hint">
          人脸照片只用于本人签到比对，不会用于其他用途；如需注销请联系管理员。
        </p>
        <p v-else class="identity__hint">
          人脸信息由管理员在「用户管理」中维护；教师不参与人脸签到，此处不展示底库照片。
        </p>
      </section>

      <!-- ============ 右：角色相关内容 ============ -->
      <div class="profile-main">
        <!-- 学生：成绩概览 -->
        <section v-if="isStudent && scores" class="app-card scores">
          <header class="card-head">
            <div>
              <h2>我的成绩</h2>
              <p>已归档 {{ scores.archivedCount }} 次实训 · 历史均分 {{ scores.average }}</p>
            </div>
            <el-button link type="primary" @click="goArchive()">查看完整档案</el-button>
          </header>

          <div class="score-line">
            <div class="score-line__main">
              <span class="score-line__label">本次实训</span>
              <strong class="num">{{ scores.latest?.total ?? '—' }}</strong>
              <span class="score-line__grade">{{ scores.latest?.grade ?? '' }}</span>
            </div>
            <div class="score-line__meta">
              <p>{{ scores.latest?.courseTitle ?? '暂无进行中的实训' }}</p>
              <span class="num">按当前环节加权，未含教师现场扣分</span>
            </div>
          </div>

          <ul v-if="scores.stages?.length" class="stage-list">
            <li v-for="stage in scores.stages" :key="stage.key" class="stage">
              <span class="stage__label">{{ stage.label }}</span>
              <span class="stage__track"><i :style="{ width: `${stage.score}%` }" /></span>
              <span class="stage__value num">{{ stage.score }}</span>
            </li>
          </ul>
          <p v-else class="empty-line">本节课各环节还没出分</p>

          <div v-if="trendPoints.length > 1" class="trend">
            <p class="trend__caption">近 {{ trendPoints.length }} 次已归档总分</p>
            <svg :viewBox="`0 0 ${CHART.w} ${CHART.h}`" role="img" aria-label="最近六次实训成绩趋势">
              <!-- 刻度线：区间收紧后必须标出上下界，避免误读为 0–100 -->
              <line
                :x1="CHART.left"
                :x2="CHART.w - CHART.right"
                :y1="CHART.top"
                :y2="CHART.top"
                class="trend__grid"
              />
              <line
                :x1="CHART.left"
                :x2="CHART.w - CHART.right"
                :y1="CHART.h - CHART.bottom"
                :y2="CHART.h - CHART.bottom"
                class="trend__grid"
              />
              <path :d="trendArea" class="trend__area" />
              <path :d="trendPath" class="trend__line" />
              <g v-for="point in trendPoints" :key="point.label">
                <circle :cx="point.x" :cy="point.y" r="2.5" class="trend__dot" />
              </g>
              <!-- 刻度值必须画在面积之后，否则会被填充盖住 -->
              <text :x="CHART.left" :y="CHART.top + 10" class="trend__y">{{ domain.hi }}</text>
              <text :x="CHART.left" :y="CHART.h - CHART.bottom - 4" class="trend__y">
                {{ domain.lo }}
              </text>
              <g v-for="point in trendPoints" :key="`x-${point.label}`">
                <text
                  :x="point.x"
                  :y="CHART.h - 6"
                  :text-anchor="point.anchor"
                  class="trend__x"
                >
                  {{ point.label }}
                </text>
              </g>
            </svg>
          </div>
        </section>

        <!-- 教师：课表 -->
        <section v-if="!isStudent" class="app-card timetable">
          <header class="card-head">
            <div>
              <h2>本周课表</h2>
              <p>共 {{ data.timetable.length }} 节实训课</p>
            </div>
          </header>
          <div v-if="lessonsByDay.length" class="week">
            <div v-for="day in lessonsByDay" :key="day.day" class="week__day">
              <span class="week__label">{{ day.label }}</span>
              <ul class="week__list">
                <li v-for="lesson in day.lessons" :key="lesson.id" class="lesson">
                  <span class="lesson__period num">{{ lesson.period }}</span>
                  <div class="lesson__body">
                    <p class="lesson__course">{{ lesson.courseTitle }}</p>
                    <span class="lesson__meta">
                      {{ lesson.className }} · {{ lesson.station }} · {{ lesson.weekRange }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="empty-line">本学期还没有排课</p>
        </section>

        <!-- 教师：所带班级成绩概览 -->
        <section v-if="!isStudent && scores" class="app-card classes">
          <header class="card-head">
            <div>
              <h2>班级成绩概览</h2>
              <p>已归档 {{ scores.archivedCount }} 人次，整体均分 {{ scores.average }}</p>
            </div>
            <el-button link type="primary" @click="router.push('/modules/summary')">
              去综合评价
            </el-button>
          </header>
          <ul v-if="scores.classes?.length" class="class-list">
            <li v-for="item in scores.classes" :key="item.classId" class="class-row">
              <div class="class-row__name">
                <strong>{{ item.className }}</strong>
                <span class="class-row__meta num">
                  {{ item.count }} 人 · 待复核 {{ item.pending }} 人
                </span>
              </div>
              <span class="class-row__score num">{{ item.average }}</span>
              <!-- 班级名单不是一个学生的档案，跳综合评价（它自带按班筛选），别把 classId 当 studentId 传 -->
              <el-button link type="primary" @click="router.push('/modules/summary')">查看</el-button>
            </li>
          </ul>
          <p v-else class="empty-line">还没有班级成绩</p>
        </section>
      </div>
    </div>

    <!-- 修改联系方式 -->
    <el-dialog v-model="contactVisible" title="修改联系方式" width="420px">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="手机号">
          <el-input v-model="contact.phone" placeholder="11 位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="contact.email" placeholder="name@example.com" />
        </el-form-item>
      </el-form>
      <p class="dialog-hint">
        学号、班级与姓名由教务系统同步，个人无法修改；如需更正请联系管理员。
      </p>
      <template #footer>
        <el-button @click="contactVisible = false">取消</el-button>
        <el-button type="primary" :loading="contactSaving" @click="saveContact">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: $space-4;
  align-items: start;
}

.profile-main {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

/* ---------------- 左侧身份卡 ---------------- */
.identity {
  &__top {
    display: flex;
    gap: $space-3;
    align-items: center;
  }

  &__photo {
    position: relative;
    flex: 0 0 84px;
    width: 84px;
    height: 84px;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: $radius-md;
    }
  }

  &__initial {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-md;
  }

  &__badge {
    position: absolute;
    right: -4px;
    bottom: -6px;
    padding: 1px 6px;
    font-size: 10px;
    line-height: 15px;
    border-radius: $radius-pill;

    &.is-ok {
      color: $color-success;
      background: $color-bg-surface;
      border: 1px solid $color-border-light;
    }

    &.is-missing {
      color: $color-warning;
      background: $color-bg-surface;
      border: 1px solid $color-border-light;
    }
  }

  &__head {
    min-width: 0;

    h2 {
      margin: 0;
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__role {
    margin: 2px 0 0;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__dept {
    margin: 2px 0 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__hint {
    padding: $space-3;
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-secondary;
    background: $color-bg-subtle;
    border-radius: $radius-sm;
  }
}

.facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: $space-3 $space-4;
  padding: $space-3 0 0;
  margin: $space-3 0 0;
  border-top: 1px solid $color-border-light;

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 2px 0 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }

  // 邮箱长度不可控，两列排会断成两行，占整行更稳
  &__wide {
    grid-column: 1 / -1;
  }
}

/* ---------------- 通用卡片头 ---------------- */
.card-head {
  display: flex;
  gap: $space-3;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: $space-3;
  border-bottom: 1px solid $color-border-light;
  margin-bottom: $space-3;

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

/* ---------------- 成绩 ---------------- */
.score-line {
  display: flex;
  gap: $space-4;
  align-items: center;
  padding-bottom: $space-3;

  &__main {
    display: flex;
    gap: 6px;
    align-items: baseline;

    strong {
      font-size: 30px;
      font-weight: $font-weight-semibold;
      line-height: 1;
      color: $color-text-primary;
    }
  }

  &__label {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__grade {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__meta {
    p {
      margin: 0;
      font-size: $font-size-sm;
      color: $color-text-regular;
    }

    span {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stage {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 34px;
  gap: $space-3;
  align-items: center;

  &__label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__track {
    height: 4px;
    overflow: hidden;
    background: $color-bg-subtle;
    border-radius: $radius-pill;

    i {
      display: block;
      height: 100%;
      background: $color-primary;
      border-radius: $radius-pill;
      transition: width 420ms $ease-out;
    }
  }

  &__value {
    font-size: $font-size-xs;
    text-align: right;
    color: $color-text-primary;
  }
}

.trend {
  margin-top: $space-3;

  &__caption {
    margin: 0 0 4px;
    font-size: 10.5px;
    color: $color-text-placeholder;
  }

  svg {
    width: 100%;
    height: auto;
  }

  &__area {
    fill: $color-primary-soft;
  }

  &__line {
    fill: none;
    stroke: $color-primary;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  &__dot {
    fill: $color-bg-surface;
    stroke: $color-primary;
    stroke-width: 1.5;
  }

  &__x {
    font-size: 9px;
    fill: $color-text-placeholder;
  }

  &__y {
    font-size: 9px;
    fill: $color-text-placeholder;
    font-variant-numeric: tabular-nums;
    /* 刻度值贴着线画在绘图区内侧，避免和底部日期撞在一起 */
    paint-order: stroke;
    stroke: $color-bg-surface;
    stroke-width: 2.5px;
  }

  &__grid {
    stroke: $color-border-light;
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
}

/* ---------------- 课表 ---------------- */
.week {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__day {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: $space-2;
    padding: 8px 0;
    border-bottom: 1px solid $color-border-light;

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
}

.lesson {
  display: flex;
  gap: $space-3;
  align-items: flex-start;

  &__period {
    flex: 0 0 48px;
    font-size: 11px;
    color: $color-text-secondary;
  }

  &__course {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

/* ---------------- 班级 ---------------- */
.class-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.class-row {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: none;
  }

  &__name {
    flex: 1;
    min-width: 0;

    strong {
      display: block;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  &__meta {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  &__score {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }
}

.empty-line {
  padding: $space-4 0;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-text-placeholder;
}

.dialog-hint {
  margin: 0;
  font-size: $font-size-xs;
  line-height: 1.6;
  color: $color-text-placeholder;
}

@media (max-width: $breakpoint-lg) {
  .profile-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
