import type { UserRole } from './user'

/**
 * 个人中心（/profile）
 * ----------------------------------------------------------------------------
 * 学生和教师共用一个接口，字段按角色裁剪：
 *   学生 —— 班级、学号、人脸照片、手机号、邮箱 + 本人最近成绩；
 *   教师 —— 工号、教研室、手机号、邮箱 + 授课课表 + 所带班级成绩概览。
 *
 * 不复用 User（账号管理用的类型）：
 * 那个类型服务的是「管理员怎么改这个账号」，字段偏管理；
 * 这里服务的是「本人怎么确认自己的信息」，多了课表与成绩。
 */

export interface ProfileBase {
  id: number
  role: UserRole
  name: string
  /** 登录账号（学生=学号，教师=工号） */
  username: string
  /** 学号 / 工号，单独给一个字段方便展示与复制 */
  code: string
  /** 学生=班级，教师=教研室 */
  department: string
  phone: string
  email: string
  /** 人脸底库照片（学生必有，教师可空） */
  facePhoto?: string
  faceRegistered: boolean
  createdAt: string
  lastLoginAt: string
}

/** 教师课表的一格 */
export interface ProfileLesson {
  id: string
  /** 1=周一 … 7=周日 */
  weekday: number
  /** 第几大节，如「1-2 节」 */
  period: string
  courseTitle: string
  className: string
  /** 实训工位，如「A-03」 */
  station: string
  /** 周次范围，如「1-16 周」 */
  weekRange: string
}

/** 成绩概览：学生看自己，教师看所带班级 */
export interface ProfileScoreOverview {
  /** 已归档的实训次数 */
  archivedCount: number
  average: number
  best: number
  latest?: {
    courseTitle: string
    total: number
    grade: string
    at: string
    /** 教师视角下用于跳转到该生档案 */
    studentId?: number
    studentName?: string
  }
  /** 学生：五环节最近得分 */
  stages?: Array<{ key: string; label: string; score: number }>
  /** 趋势：最近 6 次总分 */
  trend?: Array<{ label: string; value: number }>
  /** 教师：所带班级 */
  classes?: Array<{
    classId: number
    className: string
    count: number
    average: number
    /** 待复核人数 */
    pending: number
  }>
}

export interface ProfileOverview {
  base: ProfileBase
  /** 学生为空数组 */
  timetable: ProfileLesson[]
  scores: ProfileScoreOverview
}

export const WEEKDAY_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
