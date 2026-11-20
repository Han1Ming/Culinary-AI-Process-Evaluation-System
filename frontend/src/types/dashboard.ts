/** 工作台 / 仪表盘类型 */

export type StatTone = 'primary' | 'success' | 'warning' | 'danger'

export interface StatCardData {
  key: string
  label: string
  value: number
  unit?: string
  /** 环比变化百分比，正数为上升 */
  delta?: number
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

export interface DashboardOverview {
  stats: StatCardData[]
  activities: ActivityItem[]
  modules: EvaluationModule[]
  /** 今日签到率 0-100 */
  checkinRate: number
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
  /** 本节课程 */
  course: {
    id: number
    title: string
    dishes: string[]
    lessonAt: string
    goal: string
    published: boolean
  } | null
  stats: StatCardData[]
  stages: MyStageScore[]
  todos: MyTodo[]
  /** 只包含我自己的动态 */
  activities: ActivityItem[]
}

