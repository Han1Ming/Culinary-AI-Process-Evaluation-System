/**
 * 评价规则常量
 * ----------------------------------------------------------------------------
 * 规则版本会随成绩归档一起冻结：改权重、改阈值就升版本，
 * 已归档的成绩不受影响（甲方要求「已归档报告不得因后续权重调整而自动改变」）。
 */
export const RULE_VERSION = '2026.11-v1.3'

/** 分值等级，教务五档 */
export function gradeOf(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}
