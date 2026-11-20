import type { UserRole } from './user'

/** 通知类型：普通公告 / 功能更新 / 维护通知 */
export type NoticeType = 'system' | 'feature' | 'maintenance'

export type NoticeStatus = 'draft' | 'published'

export interface Notice {
  id: number
  title: string
  /** 正文，支持换行 */
  body: string
  type: NoticeType
  status: NoticeStatus
  /** 置顶，进入顶栏时排在最前 */
  pinned: boolean
  /** 接收对象；'all' 表示全站 */
  audience: UserRole[] | 'all'
  publisher: string
  createdAt: string
  /** 发布时间；草稿为空 */
  publishedAt?: string
  /** 已读人数 / 应读人数（Mock 演示用） */
  readCount: number
  totalCount: number
}

export interface NoticeForm {
  id?: number
  title: string
  body: string
  type: NoticeType
  audience: UserRole[] | 'all'
  pinned: boolean
}

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  system: '系统公告',
  feature: '功能更新',
  maintenance: '维护通知',
}
