/**
 * 菜肴成品 Mock
 * ----------------------------------------------------------------------------
 * 五个维度都带「为什么给这个分」与「怎么改」，因为甲方明确要求
 * 每个维度展示分数、评价理由和改进建议；只给数字的评分页是不可验收的。
 */
import dishShot from '@/assets/images/dish-plated.jpg'
import type { DishAnalysis, DishDimension, DishRecord } from '@/types/dish'
import { dishGrade } from '@/types/dish'

interface Seed {
  key: string
  label: string
  weight: number
  base: number
  reason: string
  advice: string
}

const SEEDS: Seed[] = [
  {
    key: 'appearance',
    label: '食材外观',
    weight: 0.25,
    base: 90,
    reason: '主料表面呈均匀金黄色，挂糊厚薄一致，无明显脱浆；配菜断面整齐。',
    advice: '边缘两处略深，复炸时可将火调低一档，避免局部上色过快。',
  },
  {
    key: 'plating',
    label: '摆盘艺术',
    weight: 0.2,
    base: 86,
    reason: '采用偏左侧留白构图，视觉重心明确，主辅料层次清楚。',
    advice: '酱汁点缀距离主体略远，可再靠近 1cm，让视线收回到主料。',
  },
  {
    key: 'color',
    label: '色彩搭配',
    weight: 0.2,
    base: 91,
    reason: '金黄主色与青红配菜形成冷暖对比，整体饱和度自然，无过油发暗。',
    advice: '可增加一点白色（如芝麻或葱白）提亮，避免画面偏暖。',
  },
  {
    key: 'craft',
    label: '制作工艺',
    weight: 0.2,
    base: 87,
    reason: '糖醋汁挂汁均匀，盘底无明显渗液，说明收汁浓度到位。',
    advice: '右上角一块主料挂汁偏薄，出锅前可再翻一次锅。',
  },
  {
    key: 'creativity',
    label: '创意',
    weight: 0.15,
    base: 84,
    reason: '在传统糖醋里脊基础上加入少量果粒，酸甜层次更丰富。',
    advice: '创意表达克制是优点，不必再叠加装饰，保持盘面干净。',
  },
]

/** 按学生 id 做小幅扰动，保证不同学生分数不同 */
export function mockDishAnalysis(seedValue = 0): DishAnalysis {
  const jitter = ((seedValue % 5) - 2) * 1.5
  const dimensions: DishDimension[] = SEEDS.map((seed, index) => {
    const wave = Math.sin((seedValue + index * 3) * 0.8) * 2
    return {
      key: seed.key,
      label: seed.label,
      weight: seed.weight,
      score: Math.max(55, Math.min(99, Math.round(seed.base + jitter + wave))),
      reason: seed.reason,
      advice: seed.advice,
    }
  })

  const total = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0))

  return {
    total,
    grade: dishGrade(total),
    dimensions,
    remark:
      '成品整体完成度较高：主料色泽均匀，挂糊与收汁都到位，摆盘有明确的视觉重心。' +
      '改进方向集中在细节——酱汁点缀再靠近主体一点，复炸火候略降，盘面会更干净。' +
      '需要说明的是：照片只能评价外观与呈现，无法判断真实口味、内部熟度与食品安全。',
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    modelVersion: 'vision-dish-v2.4',
  }
}

export const mockDishHistory: DishRecord[] = [
  {
    id: 'dish_20261121_01',
    studentName: '陈子豪',
    studentNo: '2023010101',
    dish: '糖醋里脊',
    image: dishShot,
    total: 88,
    grade: '良好',
    at: '2026-11-21 11:32',
    reviewed: true,
  },
  {
    id: 'dish_20261106_01',
    studentName: '陈子豪',
    studentNo: '2023010101',
    dish: '上汤娃娃菜',
    image: dishShot,
    total: 86,
    grade: '良好',
    at: '2026-11-06 11:18',
    reviewed: true,
  },
  {
    id: 'dish_20261022_01',
    studentName: '陈子豪',
    studentNo: '2023010101',
    dish: '黑椒牛柳',
    image: dishShot,
    total: 90,
    grade: '优秀',
    at: '2026-10-22 11:40',
    reviewed: false,
  },
]
