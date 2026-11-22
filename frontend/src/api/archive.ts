import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { buildArchive } from '@/mock/archive'
import type { ArchiveQuery, StudentArchive } from '@/types/archive'

/**
 * 学生实训档案
 *   GET /api/v1/archive/{studentId}?semester=&courseTitle=&type=
 * 后端只返回该生数据；学生查他人时由后端直接 403，前端也会先按角色拦一层
 * （前端拦是为了不让人点进去看到空白页，不是安全边界）。
 */
export async function fetchStudentArchive(
  studentId: number,
  query: ArchiveQuery = {},
): Promise<StudentArchive> {
  if (USE_MOCK) {
    await mockDelay(300)
    const archive = buildArchive(studentId)
    if (!archive) throw new Error('没有找到这名学生的档案')
    return archive
  }
  return http.get<StudentArchive>(`/archive/${studentId}`, {
    semester: query.semester,
    courseTitle: query.courseTitle,
    type: query.type,
  })
}
