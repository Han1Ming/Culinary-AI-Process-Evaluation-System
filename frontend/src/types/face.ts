/** 人脸签到相关类型 */

export interface FaceUser {
  id: number
  name: string
  studentNo: string
  className: string
  avatar?: string
}

/** POST /api/face/checkin 返回体 */
export interface FaceCheckinResult {
  success: boolean
  user: FaceUser | null
  /** ISO 时间字符串 */
  timestamp: string
  /** 0 ~ 1 的相似度 */
  similarity: number
  message?: string
}

export type FaceRecordStatus = 'success' | 'failed'

export interface FaceRecord {
  id: string
  name: string
  studentNo: string
  className: string
  timestamp: string
  similarity: number
  status: FaceRecordStatus
}

/** 页面识别状态机 */
export type FaceScanStatus = 'idle' | 'scanning' | 'success' | 'failed'

export const FACE_ERROR_MESSAGES: Record<string, string> = {
  no_face: '未检测到人脸，请正对摄像头',
  low_light: '光线不足，请调整位置',
  multi_face: '画面中存在多张人脸，请单人签到',
  low_similarity: '人脸不匹配，请重试或联系管理员',
  camera_denied: '摄像头权限被拒绝，请在浏览器地址栏重新允许',
  camera_missing: '未检测到可用摄像头设备',
}
