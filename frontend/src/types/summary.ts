/**
 * 综合评价（/modules/summary）
 * ----------------------------------------------------------------------------
 * 这里的类型同时服务三个消费者，所以刻意做成「扁平 + 可枚举」的形状：
 *   1. 页面上的名单与分环节拆分；
 *   2. 成绩单导出（一行一个学生，列固定）；
 *   3. 单人报告页（打印 / 另存为 PDF）。
 *
 * 后端实现时按 GET /v1/summary/roster、GET /v1/summary/{id}/report 两个接口
 * 对齐即可，字段名与这里保持一致，前端不用改。
 */

/** 一个评价环节。weight 是权重（0-1），不是百分数 */
export interface SummaryStage {
  key: string
  label: string
  weight: number
  /** 最终计入总分的分数（教师复核后） */
  score: number
  /** 该环节的原始记录条数，用于说明这一分的依据 */
  records: number
  /** AI 初评分数（机器分），未接入时等于 score */
  aiScore?: number
  /** 教师复核后的分数；未复核时等于 aiScore */
  reviewScore?: number
  /** 教师是否已复核该环节 */
  reviewed?: boolean
  /** 分数来源记录：可追溯到一个具体的签到 / 事件 / 图片 */
  sources?: ScoreSource[]
}

/** 一条分数来源（点开「这一分怎么来的」看到的东西） */
export interface ScoreSource {
  id: string
  /** 来源模块：签到 / 着装 / 食材 / 烹饪 / 成品 / 问答 */
  module: string
  title: string
  at: string
  /** 该记录贡献的分值或扣分说明 */
  detail: string
  /** 截图 / 关键帧，有则展示缩略图 */
  snapshot?: string
  /** 这条记录的单条得分（0-100），用于弹窗里展示与改分 */
  score?: number
  /** 该来源的评分维度明细，弹窗里逐条展示 */
  dimensions?: Array<{ label: string; value: string; score?: number }>
  /** 模型版本 / 设备 / 原始置信度等，弹窗里的「技术信息」 */
  meta?: Array<{ label: string; value: string }>
}

/**
 * 教师复核状态
 * ----------------------------------------------------------------------------
 * 与 confirmed（归档）是两件事：复核是「这个分数我认不认」，归档是「锁不锁」。
 * 先把三个动作定义清楚，页面才不会各写一套：
 *   pending   待复核 —— 默认态，AI 出分后等教师看
 *   confirmed 已确认 —— 认这个分，可进入归档
 *   rejected  已驳回 —— 分不成立，退回学生补做 / 重新上传
 *   reviewing 转复核 —— 当场判不了，挂起留给课后或教研组
 */
export type ReviewState = 'pending' | 'confirmed' | 'rejected' | 'reviewing'

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  pending: '待复核',
  confirmed: '已确认',
  rejected: '已驳回',
  reviewing: '转复核',
}

/** 成绩被修改的一次记录（教师复核、改分、权重调整） */
export interface ScoreChange {
  id: string
  at: string
  by: string
  /** 改的是环节分还是总分 */
  target: 'stage' | 'total'
  stageLabel?: string
  from: number
  to: number
  reason: string
}

/** 名单里的一名学生 */
export interface SummaryStudent {
  id: number
  name: string
  studentNo: string
  className: string
  /** 班级主键，用于按班筛选与导出 */
  classId: number
  seat: string
  stages: SummaryStage[]
  /** 已归档 = 分数锁定，不再随权重调整变化 */
  confirmed: boolean
  archivedAt?: string
  /** 归档时冻结的评价规则版本 */
  ruleVersion?: string
  /** 归档时冻结的总分（用于证明「归档后不因权重调整而变」） */
  archivedTotal?: number
  /** 成绩修改记录，按时间倒序 */
  changes?: ScoreChange[]
  /** 教师复核状态：待复核 / 已确认 / 已驳回 / 转复核 */
  reviewState?: ReviewState
  /** 最近一次复核说明（驳回与转复核必须写） */
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
}

/** 本次实训任务（报告页眉用） */
export interface SummaryTask {
  id: string
  courseTitle: string
  className: string
  lessonAt: string
  teacher: string
}

/**
 * 名单接口的返回：任务信息 + 学生列表。
 * 任务信息一起返回，是为了让教师端的名单能自动锁定「本节课的班」，
 * 而不是把全校学生平铺出来。
 */
export interface SummaryRoster {
  task: SummaryTask
  students: SummaryStudent[]
}

/** 单人报告：分数由服务端算好，扣分明细由前端从复核 store 合并 */
export interface SummaryReportData {
  student: SummaryStudent
  /** 加权分（未扣教师现场分） */
  total: number
  grade: string
  task: SummaryTask
  generatedAt: string
}

/** 班级 / 全站汇总 */
export interface SummaryClassStat {
  classId: number
  className: string
  count: number
  average: number
  /** 0-1 */
  passRate: number
  distribution: {
    excellent: number
    good: number
    medium: number
    pass: number
    fail: number
  }
}
