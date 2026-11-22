import type { Notice } from '@/types'

/**
 * 通知公告演示数据
 * ----------------------------------------------------------------------------
 * 【为什么要落 localStorage】
 * 原来这份数组只活在内存里：管理员发布一条公告，切个页面还在，一刷新就回到
 * 种子数据——接手的人会以为「发布了但没生效」。既然 Mock 是给验收演示用的，
 * 就得让它跨刷新活着，否则演示流程讲不通。
 *
 * key 带版本号：种子数据结构变了直接换版本，旧数据自动作废，不做迁移
 * （演示数据没有迁移价值，硬迁只会留下更脏的状态）。
 */
const STORAGE_KEY = 'culinary_ai_mock_notices'
const STORAGE_VERSION = 1

const SEED: Notice[] = [
  {
    id: 1001,
    title: '新增「课程管理」：教师上传菜谱，学生可让 AI 先讲难点',
    body: '本周上线课程管理模块。\n\n教师上传本节课菜肴的菜谱 PDF 后，班级学生会收到通知；学生在课程详情里读完后，可以点「解析这份菜谱」，系统会把难点与易错点标注到对应步骤上。\n\n目前已支持 PDF，单文件上限 20MB。',
    type: 'feature',
    status: 'published',
    pinned: true,
    audience: 'all',
    publisher: '张明远',
    createdAt: '2026-11-19 16:20',
    publishedAt: '2026-11-19 16:30',
    readCount: 312,
    totalCount: 386,
  },
  {
    id: 1002,
    title: '11 月 23 日 22:00 系统维护，预计 40 分钟',
    body: '为配合教务处数据同步，11 月 23 日 22:00–22:40 系统暂停服务。\n\n维护期间人脸签到不可用，请教师提前完成当日晚课的签到安排。维护结束后无需重新登录。',
    type: 'maintenance',
    status: 'published',
    pinned: false,
    audience: ['teacher', 'admin'],
    publisher: '张明远',
    createdAt: '2026-11-18 10:05',
    publishedAt: '2026-11-18 10:12',
    readCount: 54,
    totalCount: 61,
  },
  {
    id: 1003,
    title: '人脸照片采集要求更新',
    body: '即日起人脸照片要求：正面、免冠、光线均匀，分辨率不低于 480×640。\n\n照片由学生注册时自助采集，教师可在班级名单里核对是否已录入；未录入的学生无法完成人脸签到，只能由教师在签到页代签。',
    type: 'system',
    status: 'published',
    pinned: false,
    audience: 'all',
    publisher: '张明远',
    createdAt: '2026-11-15 09:30',
    publishedAt: '2026-11-15 09:40',
    readCount: 298,
    totalCount: 386,
  },
  {
    id: 1004,
    title: '关于期末实训评价口径调整',
    body: '期末综合评价的权重方案拟调整为：签到与着装 10%、食材预处理 20%、烹饪过程 35%、菜肴成品 35%，取消课堂问答项。\n\n待教研组会讨论后发布。',
    type: 'system',
    status: 'draft',
    pinned: false,
    audience: ['teacher'],
    publisher: '张明远',
    createdAt: '2026-11-20 11:48',
    readCount: 0,
    totalCount: 0,
  },
]

function readStorage(): Notice[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; items?: Notice[] }
    if (parsed.v !== STORAGE_VERSION || !Array.isArray(parsed.items)) return null
    return parsed.items
  } catch {
    // 存储被清、被手动改坏都走种子数据，不阻断页面
    return null
  }
}

/** 演示用公告列表：可写，且跨刷新保留 */
export const mockNotices: Notice[] = readStorage() ?? structuredClone(SEED)

/** 任何写操作之后调一次；失败只影响下次刷新，不影响当前页面 */
export function persistMockNotices(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, items: mockNotices }))
  } catch {
    // 隐私模式 / 配额满：当前会话照常工作
  }
}

/** 恢复演示种子数据（管理端「重置演示数据」用，也方便验收时回到初始态） */
export function resetMockNotices(): void {
  mockNotices.splice(0, mockNotices.length, ...structuredClone(SEED))
  persistMockNotices()
}
