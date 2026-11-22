/**
 * 人脸签到 Mock 数据
 * ----------------------------------------------------------------------------
 * 记录里刻意混入：失败、重复签到、教师补签三种「非成功」样本，
 * 因为教师端真正要处理的是这些；只有成功记录的演示页面是没有说服力的。
 *
 * 截图用现场实拍图占位（shizhan 系列），不引入新的生成图。
 */
import faceChen from '@/assets/images/faces/chen-zihao.jpg'
import faceLi from '@/assets/images/faces/li-siying.jpg'
import faceWang from '@/assets/images/faces/wang-haoran.jpg'
import shotUniform from '@/assets/images/uniform-students.jpg'
import { mockStudents } from './students'
import type {
  FaceCheckinResult,
  FaceDeviceInfo,
  FaceProfile,
  FaceRecord,
  FaceRecordQuery,
  ManualCheckinPayload,
} from '@/types'
import type { PageResult } from '@/types/api'

export const mockFaceDevices: FaceDeviceInfo[] = [
  { deviceId: 'cam-builtin-front', label: '内置摄像头（前置）', kind: 'videoinput' },
  { deviceId: 'cam-usb-wide-01', label: 'USB 广角 · 工位 02', kind: 'videoinput' },
  { deviceId: 'cam-usb-overhead-06', label: 'USB 俯拍 · 工位 06', kind: 'videoinput' },
]

const PHOTOS: Record<number, string> = {
  1001: faceChen,
  1002: faceLi,
  1003: faceWang,
}

export const mockFaceProfiles: FaceProfile[] = mockStudents.map((stu) => {
  const photo = PHOTOS[stu.id]
  return {
    userId: stu.id,
    name: stu.name,
    studentNo: stu.studentNo,
    className: stu.className,
    photo,
    status: photo ? 'active' : 'none',
    registeredAt: photo ? '2026-09-03 10:12' : undefined,
    consentAt: photo ? '2026-09-03 10:10' : undefined,
  }
})

const COURSE = '《中式热菜制作》—— 糖醋里脊'

export const mockCheckinRecords: FaceRecord[] = [
  {
    id: 'ck_20261121_008',
    name: '陈子豪',
    studentNo: '2023010101',
    className: '烹饪工艺与营养 2301',
    seat: '02',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:12:31',
    similarity: 0.964,
    status: 'success',
    source: 'ai',
    snapshot: faceChen,
    deviceName: 'USB 广角 · 工位 02',
  },
  {
    id: 'ck_20261121_007',
    name: '李思影',
    studentNo: '2023010102',
    className: '烹饪工艺与营养 2301',
    seat: '05',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:10:02',
    similarity: 0.938,
    status: 'success',
    source: 'ai',
    snapshot: faceLi,
    deviceName: 'USB 广角 · 工位 02',
  },
  {
    id: 'ck_20261121_006',
    name: '王皓然',
    studentNo: '2023010128',
    className: '西餐工艺 2302',
    seat: '09',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:08:44',
    similarity: 0.921,
    status: 'success',
    source: 'ai',
    snapshot: faceWang,
    deviceName: '内置摄像头（前置）',
  },
  {
    id: 'ck_20261121_005',
    name: '未知用户',
    studentNo: '—',
    className: '—',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:06:10',
    similarity: 0.412,
    status: 'failed',
    source: 'ai',
    snapshot: shotUniform,
    deviceName: 'USB 广角 · 工位 02',
    reason: '画面逆光，人脸比对未达阈值 0.75',
  },
  {
    id: 'ck_20261121_004',
    name: '赵一诺',
    studentNo: '2023010133',
    className: '烹饪工艺与营养 2301',
    seat: '12',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:04:52',
    similarity: 1,
    status: 'manual',
    source: 'manual',
    deviceName: '—',
    reason: '学生刘海遮挡，识别失败三次，现场核对学生证后补签',
    operator: '陈立群',
  },
  {
    id: 'ck_20261121_003',
    name: '吴思远',
    studentNo: '2023010142',
    className: '烹饪工艺与营养 2301',
    seat: '18',
    courseTitle: COURSE,
    timestamp: '2026-11-21T08:02:15',
    similarity: 0.951,
    status: 'duplicate',
    source: 'ai',
    snapshot: shotUniform,
    deviceName: 'USB 广角 · 工位 02',
    reason: '同一学生 08:01 已完成签到，本次仅留痕不重复计数',
  },
  {
    id: 'ck_20261120_012',
    name: '陈子豪',
    studentNo: '2023010101',
    className: '烹饪工艺与营养 2301',
    seat: '02',
    courseTitle: '《中式热菜制作》—— 青椒土豆丝',
    timestamp: '2026-11-20T08:12:31',
    similarity: 0.958,
    status: 'success',
    source: 'ai',
    snapshot: faceChen,
    deviceName: 'USB 广角 · 工位 02',
  },
  {
    id: 'ck_20261120_011',
    name: '周与同',
    studentNo: '2023010140',
    className: '西餐工艺 2302',
    seat: '15',
    courseTitle: '《中式热菜制作》—— 青椒土豆丝',
    timestamp: '2026-11-20T08:09:40',
    similarity: 0.903,
    status: 'success',
    source: 'ai',
    snapshot: shotUniform,
    deviceName: '内置摄像头（前置）',
  },
]

/** 教师的补签记录追加到内存里，列表立即可见 */
export function mockManualCheckin(payload: ManualCheckinPayload): FaceRecord {
  const record: FaceRecord = {
    id: `ck_manual_${Date.now()}`,
    name: payload.studentName,
    studentNo: payload.studentNo,
    className: payload.className,
    seat: payload.seat,
    courseTitle: COURSE,
    timestamp: payload.at,
    similarity: 1,
    status: 'manual',
    source: 'manual',
    reason: payload.reason,
    operator: '陈立群',
    deviceName: '—',
  }
  mockCheckinRecords.unshift(record)
  return record
}

/** 筛选 + 分页：真实环境由后端完成，这里保持同样的入参口径 */
export function queryMockFaceRecords(query: FaceRecordQuery): PageResult<FaceRecord> {
  const keyword = (query.keyword ?? '').trim()
  const student = (query.studentKeyword ?? '').trim()
  /**
   * 学生范围过滤：按 studentId 找到学号再比对。
   * 真实接口应直接按 user_id 过滤并把角色校验做在服务端；
   * 这里用学号兜底，是为了让 Mock 行为与「只返回本人」一致。
   */
  const scopedNo = query.studentId
    ? (mockStudents.find((item) => item.id === query.studentId)?.studentNo ?? '__none__')
    : ''

  const list = mockCheckinRecords.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.name.includes(keyword) ||
      (item.courseTitle ?? '').includes(keyword) ||
      (item.deviceName ?? '').includes(keyword)
    const matchStudent =
      !student || item.name.includes(student) || item.studentNo.includes(student)
    const matchScope = !scopedNo || item.studentNo === scopedNo
    const matchClass = !query.className || item.className === query.className
    const matchStatus = !query.status || item.status === query.status
    const date = item.timestamp.slice(0, 10)
    const matchStart = !query.dateStart || date >= query.dateStart
    const matchEnd = !query.dateEnd || date <= query.dateEnd
    return (
      matchKeyword && matchStudent && matchScope && matchClass && matchStatus && matchStart && matchEnd
    )
  })

  const start = (query.page - 1) * query.pageSize
  return {
    list: list.slice(start, start + query.pageSize),
    total: list.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/**
 * Mock 识别：90% 单人成功，偶尔两人同框/重复签到/未注册，
 * 让「多人入镜结果列表」和「重复签到提示」两条交互能被真实触发。
 */
export function mockCheckinMulti(delay = 1100): Promise<FaceCheckinResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const pool = mockStudents.filter((s) => s.facePhoto)
      const roll = Math.random()
      const snapshot = shotUniform

      if (roll < 0.06) {
        resolve({
          success: false,
          user: null,
          timestamp: new Date().toISOString(),
          similarity: 0,
          message: 'no_face',
          snapshot,
        })
        return
      }

      if (roll < 0.14) {
        // 两人同框
        const first = pool[Math.floor(Math.random() * pool.length)]
        const second = pool.filter((s) => s.id !== first.id)[0]
        resolve({
          success: true,
          user: { id: first.id, name: first.name, studentNo: first.studentNo, className: first.className },
          timestamp: new Date().toISOString(),
          similarity: 0.946,
          snapshot,
          matches: [
            {
              userId: first.id,
              name: first.name,
              studentNo: first.studentNo,
              className: first.className,
              similarity: 0.946,
              status: 'success',
            },
            {
              userId: second.id,
              name: second.name,
              studentNo: second.studentNo,
              className: second.className,
              similarity: 0.912,
              status: 'success',
            },
          ],
        })
        return
      }

      if (roll < 0.2) {
        // 重复签到
        const stu = pool[0]
        resolve({
          success: false,
          user: { id: stu.id, name: stu.name, studentNo: stu.studentNo, className: stu.className },
          timestamp: new Date().toISOString(),
          similarity: 0.938,
          message: 'duplicate',
          duplicate: true,
          snapshot,
          matches: [
            {
              userId: stu.id,
              name: stu.name,
              studentNo: stu.studentNo,
              className: stu.className,
              similarity: 0.938,
              status: 'duplicate',
              checkedAt: '08:12',
            },
          ],
        })
        return
      }

      const stu = pool[Math.floor(Math.random() * pool.length)]
      const score = Number((0.91 + Math.random() * 0.07).toFixed(3))
      resolve({
        success: true,
        user: { id: stu.id, name: stu.name, studentNo: stu.studentNo, className: stu.className },
        timestamp: new Date().toISOString(),
        similarity: score,
        snapshot,
        matches: [
          {
            userId: stu.id,
            name: stu.name,
            studentNo: stu.studentNo,
            className: stu.className,
            similarity: score,
            status: 'success',
          },
        ],
      })
    }, delay)
  })
}
