import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { mockCourses, mockRecipeAnalysis, mockRecipeDoc } from '@/mock/courses'
import type { Course, CourseForm, RecipeAnalysis, RecipeDoc } from '@/types'

/**
 * 课程与菜谱接口
 * ----------------------------------------------------------------------------
 * 教师上传 PDF → 后端解析为结构化菜谱（RecipeDoc）→ 学生端阅读
 * → 学生点「让 AI 读一遍」拿到难点与易错点（RecipeAnalysis）。
 * Mock 模式下用一份完整的「青椒土豆丝」文档兜底，交互链路与真实一致。
 */

export async function fetchCourses(): Promise<Course[]> {
  if (USE_MOCK) {
    await mockDelay(260)
    return [...mockCourses].sort((a, b) => b.lessonAt.localeCompare(a.lessonAt))
  }
  return http.get<Course[]>('/v1/courses')
}

export async function fetchCourse(id: number): Promise<Course> {
  if (USE_MOCK) {
    await mockDelay(180)
    const found = mockCourses.find((item) => item.id === id)
    if (!found) throw new Error('课程不存在或已删除')
    return { ...found }
  }
  return http.get<Course>(`/v1/courses/${id}`)
}

/** 菜谱正文：真实环境由后端解析 PDF 后返回结构化文档 */
export async function fetchRecipeDoc(courseId: number): Promise<RecipeDoc> {
  if (USE_MOCK) {
    await mockDelay(320)
    void courseId
    return mockRecipeDoc
  }
  return http.get<RecipeDoc>(`/v1/courses/${courseId}/recipe`)
}

/**
 * 让 AI 读菜谱 POST /v1/courses/{id}/analyze
 * 后端会把菜品标准、步骤控制点交给模型，返回难点与易错点；
 * 学生端负责把它们标注到对应步骤上。
 */
export async function analyzeRecipe(courseId: number): Promise<RecipeAnalysis> {
  if (USE_MOCK) {
    await mockDelay(1500)
    return mockRecipeAnalysis(courseId)
  }
  return http.post<RecipeAnalysis>(`/v1/courses/${courseId}/analyze`, null, { timeout: 60000 })
}

export async function createCourse(form: CourseForm): Promise<Course> {
  if (USE_MOCK) {
    await mockDelay(600)
    const course: Course = {
      id: Date.now(),
      title: form.title,
      dishes: form.dishes.split(/[、,，\s]+/).filter(Boolean),
      className: form.className,
      teacherName: '陈立群',
      lessonAt: form.lessonAt,
      fileName: form.fileName,
      fileSize: form.fileSize,
      fileUrl: form.fileUrl,
      published: false,
      goal: form.goal,
      receiverCount: 0,
      studentCount: 42,
    }
    mockCourses.unshift(course)
    return course
  }
  return http.post<Course>('/v1/courses', form)
}

/** 发布课程 = 把菜谱推送给班级学生 */
export async function publishCourse(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(400)
    const found = mockCourses.find((item) => item.id === id)
    if (found) {
      found.published = true
      found.receiverCount = found.studentCount
    }
    return
  }
  await http.post<null>(`/v1/courses/${id}/publish`)
}

export async function deleteCourse(id: number): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(300)
    const index = mockCourses.findIndex((item) => item.id === id)
    if (index >= 0) mockCourses.splice(index, 1)
    return
  }
  await http.delete<null>(`/v1/courses/${id}`)
}
