/** 人脸签到相关类型（对齐 /api/v1/face/* 与 /api/v1/files） */
import type { PageQuery } from './api'

export interface FaceUser {
  id: number
  name: string
  studentNo: string
  className: string
  avatar?: string
}

/** 单张人脸匹配结果：多人同框时后端一次返回多条 */
export type MatchStatus = 'success' | 'unregistered' | 'duplicate'

export interface FaceMatch {
  userId: number
  name: string
  studentNo: string
  className: string
  /** 0 ~ 1 */
  similarity: number
  status: MatchStatus
  /** 该人本次是否已签到过（重复签到） */
  checkedAt?: string
}

/** POST /api/v1/face/checkin 返回体 */
export interface FaceCheckinResult {
  success: boolean
  /** 主匹配人（单人或多人取相似度最高者），失败时为 null */
  user: FaceUser | null
  /** ISO 时间字符串 */
  timestamp: string
  /** 0 ~ 1 的相似度 */
  similarity: number
  /** 失败原因枚举：no_face / low_light / multi_face / low_similarity / duplicate */
  message?: string
  /** 多人同框时的完整结果列表 */
  matches?: FaceMatch[]
  /** 本次识别截图的 URL（后端落对象存储）或本地 objectURL */
  snapshot?: string
  /** 是否命中了「已签到」 */
  duplicate?: boolean
}

/** 签到记录来源：AI 识别 / 教师补签 */
export type CheckinSource = 'ai' | 'manual'
export type CheckinStatus = 'success' | 'failed' | 'duplicate' | 'manual'

export interface FaceRecord {
  id: string
  name: string
  studentNo: string
  /** 学生主键（花名册 id），服务端按此校验「学生只能查自己」 */
  studentId?: number
  className: string
  /** 工位号 */
  seat?: string
  /** 本次实训课程 */
  courseTitle?: string
  timestamp: string
  similarity: number
  status: CheckinStatus
  source: CheckinSource
  /** 识别截图（失败记录同样留图，便于教师追查） */
  snapshot?: string
  /** 采集设备名称，用于定位是哪台机器签的 */
  deviceName?: string
  /** 补签原因 / 失败原因 */
  reason?: string
  /** 补签操作人 */
  operator?: string
}

/** 签到记录查询条件（分页 + 筛选统一走 PageQuery） */
export interface FaceRecordQuery extends PageQuery {
  className?: string
  /** YYYY-MM-DD */
  dateStart?: string
  dateEnd?: string
  /** 学号或姓名，教师用来搜人 */
  studentKeyword?: string
  /**
   * 按学生主键硬过滤。
   * 学生端必须用这个字段（而不是 studentKeyword）：后者是模糊匹配，
   * 搜「张」会把全班的张都带出来。服务端也要按这个字段再校验一次角色，
   * 不能只信前端传了谁。
   */
  studentId?: number
  status?: CheckinStatus | ''
}

/** 教师人工补签 */
export interface ManualCheckinPayload {
  studentId: number
  studentName: string
  studentNo: string
  className: string
  seat?: string
  /** ISO 时间 */
  at: string
  reason: string
}

/** 人脸底库档案 */
export interface FaceProfile {
  userId: number
  name: string
  studentNo: string
  className: string
  photo?: string
  /** 未注册时为 none */
  status: 'active' | 'none' | 'revoked'
  registeredAt?: string
  /** 授权告知的确认时间（个人信息保护要求留痕） */
  consentAt?: string
}

/** 浏览器可用的摄像头设备 */
export interface FaceDeviceInfo {
  deviceId: string
  label: string
  kind: 'videoinput'
}

/** 页面识别状态机 */
export type FaceScanStatus = 'idle' | 'scanning' | 'success' | 'failed'

export const FACE_ERROR_MESSAGES: Record<string, string> = {
  no_face: '未检测到人脸，请正对摄像头',
  low_light: '光线不足，请调整位置',
  multi_face: '画面中存在多张人脸，请单人签到',
  low_similarity: '人脸不匹配，请重试或联系管理员',
  duplicate: '该学生本节课已签到，无需重复签到',
  unregistered: '该学生尚未录入人脸，请先完成人脸注册',
  camera_denied: '摄像头权限被拒绝，请在浏览器地址栏重新允许',
  camera_missing: '未检测到可用摄像头设备',
  camera_busy: '摄像头被其他程序占用，请关闭后重试',
  network: '网络中断，签到未提交。恢复网络后可重试，不会产生重复记录',
  timeout: '接口超时，请稍后重试；若已签到成功，记录列表里能看到',
}

/** 记录状态的中文与色调，列表与详情共用一份 */
export const CHECKIN_STATUS_META: Record<
  CheckinStatus,
  { label: string; tone: 'success' | 'danger' | 'warning' | 'primary' }
> = {
  success: { label: '签到成功', tone: 'success' },
  failed: { label: '识别失败', tone: 'danger' },
  duplicate: { label: '重复签到', tone: 'warning' },
  manual: { label: '教师补签', tone: 'primary' },
}
