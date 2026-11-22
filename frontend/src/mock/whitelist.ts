import { mockStudents } from '@/mock/students'
import { mockUsers } from '@/mock'
import {
  STUDENT_NO_PATTERN,
  type ClassBrief,
  type WhitelistImportResult,
  type WhitelistParseResult,
  type WhitelistRow,
} from '@/types/whitelist'

/**
 * 班级白名单 Mock
 * ----------------------------------------------------------------------------
 * 解析规则写在前端，是为了让教师在**提交前**就看到哪几行有问题；
 * 服务端仍要按同一规则再审一遍（前端校验只负责体验，不负责安全）。
 *
 * 支持的粘贴格式（制表符 / 逗号 / 空格分隔都行）：
 *   2023010111  王小明  13800000011
 *   2023010112,李小红
 */
export const mockClasses: ClassBrief[] = (() => {
  const groups = new Map<string, typeof mockStudents>()
  for (const student of mockStudents) {
    const list = groups.get(student.className) ?? []
    list.push(student)
    groups.set(student.className, list)
  }
  return Array.from(groups.entries()).map(([name, students], index) => ({
    id: 2301 + index,
    name,
    // 班名末尾四位是年级，其余是专业方向
    grade: '2023 级',
    major: name.replace(/\s*\d{4}$/, ''),
    studentCount: students.length,
    teacher: index === 0 ? '陈立群' : '李慧敏',
    // 待开通 = 名单里还没有人脸底库的人；写死数字会出现「2 人 / 3 待开通」这种自相矛盾的卡片
    pendingCount: students.filter((student) => !student.facePhoto).length,
  }))
})()

/** 已有学号集合：导入时判「已存在」 */
const existingNos = new Set(mockUsers.map((user) => user.studentNo).filter(Boolean) as string[])

export function parseWhitelistMock(text: string, className: string): WhitelistParseResult {
  const rows: WhitelistRow[] = []
  const seen = new Set<string>()

  text
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = index + 1
      const trimmed = raw.trim()
      if (!trimmed) return
      // 跳过表头：第一行含「学号」就当表头
      if (line === 1 && trimmed.includes('学号')) return

      // 单个分隔符就切一格：`2023010154\t\t138...` 中间有空列，
      // 若把连续分隔符合并，手机号会被挤到姓名列，变成一个「名叫 13800000053」的学生。
      // 没有制表符/逗号时按空格切（从 Excel 复制通常带制表符，手打的多是空格）。
      const cells = /[\t,，;；]/.test(trimmed)
        ? trimmed.split(/[\t,，;；]/).map((cell) => cell.trim())
        : trimmed.split(/\s+/)
      while (cells.length > 1 && !cells[cells.length - 1]) cells.pop()
      const [studentNo = '', name = '', phone = ''] = cells

      const push = (status: WhitelistRow['status'], message?: string) =>
        rows.push({ line, studentNo, name, className, phone: phone || undefined, status, message })

      if (!studentNo && !name) return
      if (!STUDENT_NO_PATTERN.test(studentNo)) {
        push('invalid', '学号需为 8~14 位数字')
        return
      }
      if (!name) {
        push('invalid', '缺少姓名')
        return
      }
      if (/^\d/.test(name)) {
        push('invalid', '姓名列是数字，可能是分隔符错位，请检查这一行的列数')
        return
      }
      if (seen.has(studentNo)) {
        push('invalid', '本次导入里重复出现')
        return
      }
      seen.add(studentNo)

      if (existingNos.has(studentNo)) {
        push('exists', '库里已有该学号，将跳过（不覆盖现有资料）')
        return
      }
      if (phone && !/^1\d{10}$/.test(phone)) {
        push('invalid', '手机号格式不对，留空或写 11 位手机号')
        return
      }
      push('new')
    })

  return {
    rows,
    summary: {
      total: rows.length,
      creatable: rows.filter((row) => row.status === 'new').length,
      exists: rows.filter((row) => row.status === 'exists').length,
      invalid: rows.filter((row) => row.status === 'invalid').length,
    },
  }
}

let batchSeq = 0

/**
 * 提交导入：只为「可创建」的行建账号，其余跳过。
 * Mock 会真的把学生写进花名册，导入完切到「课程管理」就能选到这些人。
 */
export function importWhitelistMock(
  rows: WhitelistRow[],
  classId: number,
): WhitelistImportResult {
  const target = mockClasses.find((item) => item.id === classId)
  const className = target?.name ?? rows[0]?.className ?? ''
  const creatable = rows.filter((row) => row.status === 'new')

  let created = 0
  for (const row of creatable) {
    if (existingNos.has(row.studentNo)) continue
    existingNos.add(row.studentNo)
    mockStudents.push({
      id: 3000 + mockStudents.length,
      name: row.name,
      studentNo: row.studentNo,
      className,
      seat: String(mockStudents.length + 1).padStart(2, '0'),
      checkedIn: false,
    })
    created += 1
  }

  if (target) {
    target.studentCount += created
    target.pendingCount += created
  }

  batchSeq += 1
  return {
    batchId: `WL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(batchSeq).padStart(3, '0')}`,
    created,
    skipped: rows.filter((row) => row.status === 'exists').length,
    failed: rows.filter((row) => row.status === 'invalid').length,
  }
}
