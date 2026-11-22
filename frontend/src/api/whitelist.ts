import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { importWhitelistMock, mockClasses, parseWhitelistMock } from '@/mock/whitelist'
import type { ClassBrief, WhitelistImportResult, WhitelistParseResult, WhitelistRow } from '@/types/whitelist'

/**
 * 班级与白名单接口
 * ----------------------------------------------------------------------------
 *   GET  /classes                       我带的班（教师）/ 全部班（管理员）
 *   POST /classes/{id}/whitelist/parse  服务端再校验一遍，返回同样的行状态
 *   POST /classes/{id}/whitelist        正式创建待开通账号
 *
 * 为什么 parse 要单独一个接口：粘贴 200 行时前端也能校验，但学号是否与教务
 * 系统冲突只有服务端知道。先 parse 再把结果给教师确认，比直接导完再报错好。
 */
export async function fetchClasses(): Promise<ClassBrief[]> {
  if (USE_MOCK) {
    await mockDelay(200)
    return mockClasses.map((item) => ({ ...item }))
  }
  return http.get<ClassBrief[]>('/classes')
}

export async function parseWhitelist(
  text: string,
  className: string,
  classId?: number,
): Promise<WhitelistParseResult> {
  if (USE_MOCK) {
    await mockDelay(260)
    return parseWhitelistMock(text, className)
  }
  return http.post<WhitelistParseResult>(
    classId ? `/classes/${classId}/whitelist/parse` : '/classes/whitelist/parse',
    { text, className },
  )
}

export async function importWhitelist(
  rows: WhitelistRow[],
  classId: number,
): Promise<WhitelistImportResult> {
  if (USE_MOCK) {
    await mockDelay(520)
    return importWhitelistMock(rows, classId)
  }
  return http.post<WhitelistImportResult>(`/classes/${classId}/whitelist`, {
    students: rows
      .filter((row) => row.status === 'new')
      .map((row) => ({ studentNo: row.studentNo, name: row.name, phone: row.phone })),
  })
}
