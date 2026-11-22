import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import {
  mockCheckinMulti,
  mockFaceProfiles,
  mockManualCheckin,
  queryMockFaceRecords,
} from '@/mock/face'
import type {
  FaceCheckinResult,
  FaceProfile,
  FaceRecord,
  FaceRecordQuery,
  ManualCheckinPayload,
} from '@/types'
import type { PageResult } from '@/types/api'

/**
 * 人脸签到接口（统一前缀 /api/v1）
 * ----------------------------------------------------------------------------
 *   POST   /face/checkin              识别签到，multipart：file / user_id?
 *   GET    /face/records              记录分页查询（班级、日期、学生、状态）
 *   GET    /face/records/{id}         单条详情（含截图）
 *   POST   /face/checkin/manual       教师补签（记录补签人、时间、原因）
 *   GET    /face/profiles             人脸底库（注册状态）
 *   PUT    /face/profiles/{userId}    注册 / 更新人脸
 *   DELETE /face/profiles/{userId}    注销人脸
 */

export async function checkinFace(frame: Blob, userId?: number): Promise<FaceCheckinResult> {
  if (USE_MOCK) return mockCheckinMulti(1100)

  const form = new FormData()
  form.append('file', frame, `face_${Date.now()}.jpg`)
  if (userId !== undefined) form.append('user_id', String(userId))

  // 不要手动设置 Content-Type，交给浏览器生成 multipart boundary
  return http.upload<FaceCheckinResult>('/face/checkin', form, { timeout: 20000 })
}

export async function fetchFaceRecords(query: FaceRecordQuery): Promise<PageResult<FaceRecord>> {
  if (USE_MOCK) {
    await mockDelay(220)
    return queryMockFaceRecords(query)
  }
  return http.get<PageResult<FaceRecord>>('/face/records', { ...query })
}

export async function fetchFaceRecordDetail(id: string): Promise<FaceRecord> {
  if (USE_MOCK) {
    await mockDelay(160)
    const record = queryMockFaceRecords({ page: 1, pageSize: 100 }).list.find((item) => item.id === id)
    if (!record) throw new Error('签到记录不存在')
    return { ...record }
  }
  return http.get<FaceRecord>(`/face/records/${id}`)
}

export async function manualCheckin(payload: ManualCheckinPayload): Promise<FaceRecord> {
  if (USE_MOCK) {
    await mockDelay(360)
    return mockManualCheckin(payload)
  }
  return http.post<FaceRecord>('/face/checkin/manual', payload)
}

export async function fetchFaceProfiles(): Promise<FaceProfile[]> {
  if (USE_MOCK) {
    await mockDelay(240)
    return mockFaceProfiles.map((item) => ({ ...item }))
  }
  return http.get<FaceProfile[]>('/face/profiles')
}

/**
 * 注册 / 更新人脸
 * photo 为前端压缩后的 dataURL（480px 宽），后端转存对象存储并回写 URL。
 * 注册与更新是同一个接口、同一套审计口径：都要留采集人与采集时间。
 */
export async function registerFace(userId: number, photo: string): Promise<FaceProfile> {
  if (USE_MOCK) {
    await mockDelay(420)
    const profile = mockFaceProfiles.find((item) => item.userId === userId)
    if (!profile) throw new Error('学生不存在')
    profile.photo = photo
    profile.status = 'active'
    profile.registeredAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    profile.consentAt = profile.consentAt ?? profile.registeredAt
    return { ...profile }
  }
  return http.put<FaceProfile>(`/face/profiles/${userId}`, { photo })
}

/** 注销人脸：底库立即失效，历史签到记录保留（记录里不存特征值） */
export async function revokeFace(userId: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(320)
    const profile = mockFaceProfiles.find((item) => item.userId === userId)
    if (!profile) throw new Error('学生不存在')
    profile.photo = undefined
    profile.status = 'revoked'
    profile.registeredAt = undefined
    return
  }
  await http.delete<null>(`/face/profiles/${userId}`)
}
