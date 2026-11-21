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
  /** 0-100 的整数分 */
  score: number
  /** 该环节的原始记录条数，用于说明这一分的依据 */
  records: number
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
