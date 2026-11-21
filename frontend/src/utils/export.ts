/**
 * 导出工具：成绩单（CSV）与报告（打印 / 另存为 PDF）
 * ----------------------------------------------------------------------------
 * 为什么不用 xlsx / jspdf：
 *   · 两个库加起来 1MB 以上，而这里只需要「一行一个学生」的表格；
 *   · Excel 与 WPS 双击打开带 BOM 的 UTF-8 CSV 不会乱码，中文学号也保得住；
 *   · 报告要的是排版（页眉、签字栏、A4 边距），浏览器自带的打印引擎
 *     对中文字体与分页的处理比 canvas 拼 PDF 更可靠，且零依赖。
 *
 * 后端如果要直接下发 xlsx（GET /v1/summary/export），只需把页面里的
 * downloadCsv 换成「请求 blob → downloadBlob」，其余不动。
 */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number
}

/** 单元格转义：逗号、引号、换行都要包起来，内部引号翻倍 */
function escapeCell(value: string | number): string {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** 生成 CSV 文本（CRLF 换行，Excel 在 Windows 下的默认行为） */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((col) => escapeCell(col.header)).join(',')
  const body = rows.map((row) => columns.map((col) => escapeCell(col.value(row))).join(','))
  return [head, ...body].join('\r\n')
}

/** 去掉文件名里系统不认的字符，避免下载时被浏览器改名 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '')
}

/** 触发一次浏览器下载 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // 立刻 revoke 会让部分浏览器取消下载，退一帧再释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出 CSV：BOM 让 Excel 按 UTF-8 解析，否则中文表头变乱码 */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const csv = `\uFEFF${toCsv(columns, rows)}`
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/**
 * 打印当前页面（报告页已写好 @media print 样式）。
 * 打印前把 document.title 换成报告名：浏览器「另存为 PDF」会拿它当默认文件名，
 * 否则导出的一律叫「烹饪AI过程评价系统.pdf」，一个班导三十份就分不清谁是谁。
 */
export function printWithTitle(title: string): void {
  const original = document.title
  document.title = safeFilename(title)
  window.print()
  // 打印对话框关闭后浏览器才会继续执行，这里恢复标题，不影响后续导航
  window.setTimeout(() => {
    document.title = original
  }, 500)
}
