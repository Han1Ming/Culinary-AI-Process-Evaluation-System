/**
 * 班级白名单导入
 * ----------------------------------------------------------------------------
 * 教师开学第一件事就是把班上的学生名单导进来，否则学生无法登录。
 * 以前的流程是管理员一个个建账号，一个班 40 人要建半天且容易错。
 *
 * 行的三种状态：
 *   new     可以创建（学号与姓名都合法且库里没有）
 *   exists  已存在，跳过（不覆盖已有账号，避免把改过的手机号冲掉）
 *   invalid 格式不合法（学号不匹配、姓名空、重复行）
 */

export interface ClassBrief {
  id: number
  name: string
  /** 年级，如「2023 级」 */
  grade: string
  /** 专业方向 */
  major: string
  studentCount: number
  /** 班主任 / 任课教师 */
  teacher: string
  /** 本班待开通（白名单已导入但未激活）人数 */
  pendingCount: number
}

export type WhitelistRowStatus = 'new' | 'exists' | 'invalid'

export const WHITELIST_STATUS_LABEL: Record<WhitelistRowStatus, string> = {
  new: '可创建',
  exists: '已存在',
  invalid: '不合法',
}

export interface WhitelistRow {
  /** 行号，解析失败时指回原文 */
  line: number
  studentNo: string
  name: string
  className: string
  phone?: string
  status: WhitelistRowStatus
  message?: string
}

export interface WhitelistParseResult {
  rows: WhitelistRow[]
  summary: {
    total: number
    creatable: number
    exists: number
    invalid: number
  }
}

export interface WhitelistImportResult {
  batchId: string
  created: number
  skipped: number
  failed: number
}

/** 导入模板：前端生成 CSV，避免让教师自己猜列顺序 */
export const WHITELIST_TEMPLATE_HEADER = ['学号', '姓名', '手机号(可选)'] as const

/** 学号规则：8~14 位数字，与教务系统一致 */
export const STUDENT_NO_PATTERN = /^\d{8,14}$/
