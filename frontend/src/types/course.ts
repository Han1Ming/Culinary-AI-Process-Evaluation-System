/** 课程与菜谱相关类型 */

export interface RecipeIngredient {
  name: string
  amount: string
  /** 处理要求，如「切 3cm 段」 */
  note?: string
}

export interface RecipeStep {
  /** 从 1 开始，和文档里的步骤序号一致 */
  index: number
  text: string
  /** 建议用时（分钟） */
  minutes?: number
  /** 关键控制点，AI 解析时优先指向这里 */
  control?: string
}

/** 菜谱文档（教师上传 PDF 后由后端解析成结构化内容） */
export interface RecipeDoc {
  title: string
  /** 菜品标准，如「鲁菜 · 咸鲜」 */
  standard: string
  /** 建议份量与时长 */
  meta: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

export interface Course {
  id: number
  title: string
  /** 本节课要做的菜肴 */
  dishes: string[]
  className: string
  teacherName: string
  /** 授课时间 */
  lessonAt: string
  /** 上传的 PDF 原始文件名 */
  fileName: string
  fileSize: number
  /** 真实文件地址；为 undefined 时前端渲染内置样例菜谱（演示态） */
  fileUrl?: string
  published: boolean
  goal: string
  /** 已收到菜谱的学生数 / 班级人数 */
  receiverCount: number
  studentCount: number
}

/** AI 对菜谱的解读条目 */
export interface RecipeInsight {
  id: string
  /** 关联步骤序号；不填表示整道菜的通用提示 */
  step?: number
  kind: 'difficulty' | 'pitfall'
  title: string
  /** 为什么会难 / 容易错在哪 */
  detail: string
  /** 教师的处理建议 */
  advice: string
}

export interface RecipeAnalysis {
  courseId: number
  summary: string
  insights: RecipeInsight[]
  /** 生成时间 */
  at: string
}

export interface CourseForm {
  title: string
  dishes: string
  className: string
  lessonAt: string
  goal: string
  fileName: string
  fileSize: number
  fileUrl?: string
}
