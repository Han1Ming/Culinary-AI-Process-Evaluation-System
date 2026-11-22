/** 菜肴成品分析（/modules/dish） */

export interface DishDimension {
  key: string
  label: string
  score: number
  weight: number
  /** 给分理由 */
  reason: string
  /** 改进建议 */
  advice: string
}

export interface DishAnalysis {
  /** 总分（加权） */
  total: number
  grade: string
  dimensions: DishDimension[]
  /** 总评 */
  remark: string
  generatedAt: string
  /** 模型版本，便于回溯「这分是哪版模型给的」 */
  modelVersion: string
}

/** 教师改分：保留 AI 原始结果，另存一份复核结果 */
export interface DishOverride {
  dimensions: Array<{ key: string; score: number }>
  remark: string
  reason: string
}

export interface DishRecord {
  id: string
  studentName: string
  studentNo: string
  dish: string
  image: string
  total: number
  grade: string
  at: string
  reviewed: boolean
}

export function dishGrade(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}
