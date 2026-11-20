import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mockStudents, type RosterStudent } from '@/mock/students'

/**
 * 教师人工判定（扣分）+ 在评学生
 * ----------------------------------------------------------------------------
 * 七个模块里有相当一部分是「机器判不了、但教师一眼能看出来」的问题：
 * 手没洗、砧板生熟混用、跳步、用错刀。这类判定结果不进模型，直接进扣分记录，
 * 由教师负责——所以单独一个 store，和 AI 分数并行存在，综合评价里两栏分开展示。
 *
 * 数据形态刻意保持扁平（一条记录 = 一个学生在某个模块被扣的一次分），
 * 因为它将来要合成到成绩单里，扁平结构最好聚合。
 *
 * 【activeStudentId 是全模块共享的】教师在着装页选了陈子豪，切到切配页还是
 * 陈子豪——一节课是跟着人走的，不是跟着页面走的。所以它放在 store 里，
 * 而不是各页面自己 ref 一份。
 */

export type ReviewStudent = RosterStudent

/** 本节课在评学生（= 花名册里已签到的人） */
export const reviewStudents: ReviewStudent[] = mockStudents

export interface Deduction {
  id: string
  studentId: number
  studentName: string
  /** 模块标识，与路由末段一致：uniform / ingredient / cooking / dish */
  module: string
  moduleLabel: string
  /** 违规项，来自各模块的判定清单 */
  item: string
  /** 扣分，正数 */
  points: number
  reason: string
  at: string
  by: string
}

function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const useReviewStore = defineStore('review', () => {
  /** 默认落在第一个已签到的学生上，避免打开页面就是「未签到」的人 */
  const activeStudentId = ref(reviewStudents.find((s) => s.checkedIn)?.id ?? reviewStudents[0].id)

  /** 预置两条，让教师首次进入就能看到扣分记录长什么样 */
  const deductions = ref<Deduction[]>([
    {
      id: 'd_seed_1',
      studentId: 1004,
      studentName: '赵一诺',
      module: 'uniform',
      moduleLabel: '着装规范',
      item: '未戴厨师帽',
      points: 5,
      reason: '进入操作间时未戴帽，提醒后补戴',
      at: '11-20 08:06',
      by: '陈立群',
    },
    {
      id: 'd_seed_2',
      studentId: 1006,
      studentName: '吴思远',
      module: 'cooking',
      moduleLabel: '烹饪过程',
      item: '跳步：未热锅直接下油',
      points: 4,
      reason: '锅温不足，导致土豆丝出水',
      at: '11-20 08:41',
      by: '陈立群',
    },
  ])

  const activeStudent = computed(
    () => reviewStudents.find((s) => s.id === activeStudentId.value) ?? reviewStudents[0],
  )

  /** 上一位 / 下一位：教师按工位顺序走，比反复点下拉快 */
  function step(delta: number): void {
    const index = reviewStudents.findIndex((s) => s.id === activeStudentId.value)
    const next = (index + delta + reviewStudents.length) % reviewStudents.length
    activeStudentId.value = reviewStudents[next].id
  }

  function listBy(studentId: number, module?: string): Deduction[] {
    return deductions.value
      .filter((d) => d.studentId === studentId)
      .filter((d) => !module || d.module === module)
  }

  /** 某学生被扣的总分（综合评价里用来体现教师裁量） */
  function sumBy(studentId: number): number {
    return listBy(studentId).reduce((sum, d) => sum + d.points, 0)
  }

  function add(payload: Omit<Deduction, 'id' | 'at' | 'studentName' | 'by'>): Deduction {
    const student = reviewStudents.find((s) => s.id === payload.studentId)
    const record: Deduction = {
      ...payload,
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentName: student?.name ?? '未知学生',
      at: now(),
      by: '陈立群',
    }
    deductions.value.unshift(record)
    return record
  }

  function remove(id: string): void {
    const index = deductions.value.findIndex((d) => d.id === id)
    if (index >= 0) deductions.value.splice(index, 1)
  }

  return { activeStudentId, activeStudent, deductions, step, listBy, sumBy, add, remove }
})
