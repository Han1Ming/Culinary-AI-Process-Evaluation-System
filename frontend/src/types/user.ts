/** 用户与鉴权相关类型 */

export type UserRole = 'admin' | 'teacher' | 'student'

export type UserStatus = 0 | 1

export interface User {
  id: number
  username: string
  name: string
  role: UserRole
  phone?: string
  email?: string
  /** 学生所属班级 / 教师所属教研室 */
  department?: string
  /** 学生学号 */
  studentNo?: string
  avatar?: string
  /**
   * 人脸照片地址（注册时采集）
   * - 后端返回可直接访问的 URL
   * - Mock 模式下为内联 SVG 占位
   */
  facePhoto?: string
  /** 是否已完成人脸采集，决定能否走人脸签到 */
  faceRegistered?: boolean
  status: UserStatus
  createdAt: string
  lastLoginAt?: string
}

/** 注册（申请开通）提交体 */
export interface RegisterPayload {
  name: string
  username: string
  password: string
  role: UserRole
  phone: string
  /** 学生填班级，教师填教研室 */
  department: string
  /** 学生必填 */
  studentNo?: string
  /** 人脸照片：dataURL（前端已压缩到 480px 宽） */
  facePhoto: string
}

export interface RegisterResult {
  id: number
  username: string
  /** 是否需要管理员审核后才可登录 */
  needApproval: boolean
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

export interface UserQuery extends Record<string, unknown> {
  page: number
  pageSize: number
  keyword?: string
  role?: UserRole | ''
  status?: UserStatus | ''
}

/** 新增 / 编辑用户表单 */
export interface UserForm {
  id?: number
  username: string
  name: string
  password?: string
  role: UserRole
  phone: string
  email: string
  department: string
  /** 学号，仅学生填写 */
  studentNo?: string
  /** 人脸照片地址，编辑时可不传表示不修改 */
  facePhoto?: string
  status: UserStatus
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '系统管理员',
  teacher: '任课教师',
  student: '学生',
}
