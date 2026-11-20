/** 通用表格列定义（DataTable 使用） */
export interface DataTableColumn<T = Record<string, unknown>> {
  prop: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  /** 纯文本格式化，返回展示字符串 */
  formatter?: (row: T, value: unknown) => string
}
