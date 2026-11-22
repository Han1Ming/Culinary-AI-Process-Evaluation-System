/** 工作台 / 仪表盘类型 */

import type { SelectOption } from './api'

export type StatTone = 'primary' | 'success' | 'warning' | 'danger'

export interface StatCardData {
  key: string
  label: string
  value: number
  unit?: string
  /** 环比变化百分比，正数为上升 */
  delta?: number
  /**
   * 口径说明，例如「含 1 人请假」「离线含故障 2 台」。
   * 与 delta 互斥使用：本周新增的签到数没有「较上周」口径，但必须交代包含什么，
   * 否则同一个数字在不同页面会对不上号。
   */
  note?: string
  icon: string
  tone: StatTone
}

export type ActivityType = 'checkin' | 'evaluation' | 'chat' | 'system'

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  description: string
  time: string
  actor: string
}

export interface EvaluationModule {
  key: string
  name: string
  description: string
  progress: number
  /** 是否已对接后端 */
  ready: boolean
}

/* ---------------- 教师工作台：当前实训 ---------------- */

/** 实训任务状态：未开始 / 进行中 / 已结束（结课不等于已归档） */
export type TrainingStatus = 'planned' | 'running' | 'finished'

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  planned: '未开始',
  running: '进行中',
  finished: '已结束',
}

/**
 * 当前实训任务
 * ----------------------------------------------------------------------------
 * 工作台上的「当前」由三个筛选（课程 / 班级 / 任务）共同决定，
 * 因此这里把课程、班级、任务、时间段一起返回，页面不需要再串三个接口拼上下文。
 */
export interface TrainingSession {
  taskId: string
  taskTitle: string
  courseId: string
  courseTitle: string
  classId: string
  className: string
  teacher: string
  /** 实训时间窗，ISO 到分钟 */
  startedAt: string
  endedAt: string
  status: TrainingStatus
  /** 应到人数（本节课在评学生） */
  total: number
  checkedIn: number
  /** 已签到但还没出成品 —— 「正在实训」 */
  inTraining: number
  /** 已提交成品并完成全部环节 */
  completed: number
  /** 已归档份数：归档后分数冻结，教师不能再改 */
  archived: number
  cameraOnline: number
  cameraOffline: number
  pendingReview: number
  anomalies: number
}

/** 单个评价模块在本节课的完成情况（教师视角，与「对接进度」不是一回事） */
export interface ModuleCompletion {
  key: string
  name: string
  /** 该模块本节是否开启；未开启时不给分母，避免显示成 0% 完成 */
  active: boolean
  done: number
  total: number
}

/** 工作台筛选条件（空串表示不限） */
export interface DashboardQuery {
  courseId?: string
  classId?: string
  taskId?: string
}

export interface DashboardOverview {
  stats: StatCardData[]
  activities: ActivityItem[]
  modules: EvaluationModule[]
  /** 今日签到率 0-100 */
  checkinRate: number
  /** 当前实训；没有任何匹配任务时为 null，页面必须写明原因而不是显示 0 */
  session: TrainingSession | null
  /** 各评价模块完成情况（教师看这个，管理员看 modules 的对接进度） */
  completion: ModuleCompletion[]
  /** 筛选下拉的可选项，由后端按当前教师的可见范围返回 */
  filters: {
    courses: SelectOption[]
    classes: SelectOption[]
    tasks: SelectOption[]
  }
}

/* ---------------- 学生视角 ---------------- */

/** 学生只看得到自己的五环节得分 */
export interface MyStageScore {
  key: string
  label: string
  /** 0-100 */
  score: number
  /** 权重 0-1 */
  weight: number
  state: 'done' | 'running' | 'pending'
}

export interface MyTodo {
  id: string
  title: string
  hint: string
  to: string
  done: boolean
}

/** 本人签到状态：未签到的人评不了，学生首页必须第一眼看到 */
export interface MyCheckin {
  status: 'checked_in' | 'manual' | 'missing'
  at?: string
  similarity?: number
  deviceName?: string
  /** 补录时由哪位教师操作 —— 学生有权知道这一笔是谁补的 */
  operator?: string
}

/** 已归档的成绩单：分数已冻结，点开是当时的规则版本 */
export interface MyArchived {
  id: string
  taskTitle: string
  archivedAt: string
  total: number
  grade: string
  ruleVersion: string
}

/**
 * 学生工作台
 * ----------------------------------------------------------------------------
 * 与 DashboardOverview 刻意做成两个类型：学生的首页里没有「班级签到率」
 * 「模块对接进度」这些运营指标，硬塞进同一个结构会让字段大半为空。
 */
export interface MyOverview {
  studentName: string
  studentNo: string
  className: string
  seat: string
  /** 本节课程 */
  course: {
    id: number
    title: string
    dishes: string[]
    lessonAt: string
    goal: string
    published: boolean
  } | null
  /** 当前实训任务与推进到哪一步 */
  task: {
    id: string
    title: string
    status: TrainingStatus
    startedAt: string
    endedAt: string
    /** 当前环节：备菜 / 焯水 / 翻炒 …… 没开始时为空串 */
    step: string
  } | null
  checkin: MyCheckin
  /** 已归档的历史成绩，按时间倒序；仅本人 */
  archived: MyArchived[]
  stats: StatCardData[]
  stages: MyStageScore[]
  todos: MyTodo[]
  /** 只包含我自己的动态 */
  activities: ActivityItem[]
}

