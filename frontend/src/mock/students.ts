/**
 * 花名册（本节课在评学生）
 * ----------------------------------------------------------------------------
 * 三个地方要用到同一份名单：教师复核的「在评学生」下拉、评价模块左上角的
 * 学生选择器、综合评价的班级名单。三处各写一份迟早会串号，所以统一放这里。
 *
 * id 用班级学籍号段（1001 起），与 mockUsers 的账号 id 不是一个命名空间：
 * 账号是「谁能登录」，花名册是「这节课谁在工位上」。真实环境里后者来自
 * GET /api/classes/{id}/students。
 */
import faceChen from '@/assets/images/faces/chen-zihao.jpg'
import faceLi from '@/assets/images/faces/li-siying.jpg'
import faceWang from '@/assets/images/faces/wang-haoran.jpg'

export interface RosterStudent {
  id: number
  name: string
  studentNo: string
  className: string
  /** 注册时留的人脸照片，评价模块的录像回放用它做封面 */
  facePhoto?: string
  /** 工位号，用于区分同一节课的多路画面 */
  seat: string
  /** 本人是否已签到；未签到的人不在评 */
  checkedIn: boolean
}

export const mockStudents: RosterStudent[] = [
  {
    id: 1001,
    name: '陈子豪',
    studentNo: '2023010101',
    className: '烹饪工艺与营养 2301',
    facePhoto: faceChen,
    seat: '02',
    checkedIn: true,
  },
  {
    id: 1002,
    name: '李思影',
    studentNo: '2023010102',
    className: '烹饪工艺与营养 2301',
    facePhoto: faceLi,
    seat: '05',
    checkedIn: true,
  },
  {
    id: 1003,
    name: '王皓然',
    studentNo: '2023010128',
    className: '西餐工艺 2302',
    facePhoto: faceWang,
    seat: '09',
    checkedIn: true,
  },
  {
    id: 1004,
    name: '赵一诺',
    studentNo: '2023010133',
    className: '烹饪工艺与营养 2301',
    seat: '12',
    checkedIn: true,
  },
  {
    id: 1005,
    name: '周与同',
    studentNo: '2023010140',
    className: '西餐工艺 2302',
    seat: '15',
    checkedIn: false,
  },
  {
    id: 1006,
    name: '吴思远',
    studentNo: '2023010142',
    className: '烹饪工艺与营养 2301',
    seat: '18',
    checkedIn: true,
  },
]

/** 供下拉用的短标签：姓名 + 学号后四位 */
export function studentLabel(stu: RosterStudent): string {
  return `${stu.name} · ${stu.studentNo.slice(-4)}`
}
