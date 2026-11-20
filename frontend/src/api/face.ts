import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay, mockFaceRecords } from '@/mock'
import { mockCheckin } from '@/utils/faceCapture'
import type { FaceCheckinResult, FaceRecord } from '@/types'

/**
 * 人脸签到接口
 * 后端约定：POST /api/face/checkin，multipart/form-data，字段 file（必填）、user_id（可选）
 * 返回：{ success, user, timestamp, similarity }
 */
export async function checkinFace(frame: Blob, userId?: number): Promise<FaceCheckinResult> {
  if (USE_MOCK) {
    return mockCheckin(1200)
  }

  const form = new FormData()
  form.append('file', frame, `face_${Date.now()}.jpg`)
  if (userId !== undefined) form.append('user_id', String(userId))

  // 不要手动设置 Content-Type，交给浏览器生成 multipart boundary
  return http.post<FaceCheckinResult>('/face/checkin', form, { timeout: 20000 })
}

/** 最近签到记录 GET /face/records?limit=10 */
export async function fetchFaceRecords(limit = 10): Promise<FaceRecord[]> {
  if (USE_MOCK) {
    await mockDelay(200)
    return mockFaceRecords.slice(0, limit)
  }
  return http.get<FaceRecord[]>('/face/records', { limit })
}
