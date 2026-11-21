import type { Course, RecipeAnalysis, RecipeDoc } from '@/types'

/**
 * 课程与菜谱的演示数据
 * ----------------------------------------------------------------------------
 * 真实环境下一份课程 = 教师上传的 PDF + 后端解析出的结构化菜谱。
 * Mock 里给一份完整的「青椒土豆丝」文档，让学生端的「解析这份菜谱」有东西可读。
 */

export const mockRecipeDoc: RecipeDoc = {
  title: '青椒土豆丝',
  standard: '家常热菜 · 咸鲜微酸',
  meta: '2 人份 · 建议 12 分钟 · 灶位 3 号',
  ingredients: [
    { name: '土豆', amount: '300 g', note: '黄心土豆，去皮切丝' },
    { name: '青椒', amount: '80 g', note: '去籽切细丝' },
    { name: '蒜', amount: '2 瓣', note: '切片' },
    { name: '干辣椒', amount: '3 个', note: '剪段去籽' },
    { name: '白醋', amount: '5 ml', note: '出锅前淋' },
    { name: '盐 / 糖', amount: '2 g / 1 g', note: '分两次下' },
    { name: '食用油', amount: '25 ml' },
  ],
  steps: [
    {
      index: 1,
      text: '土豆去皮，切 0.2cm 薄片后改刀成丝，切好立即投入冷水中浸泡，冲洗两遍至水清。',
      minutes: 4,
      control: '水清 = 淀粉洗净，决定是否粘锅',
    },
    {
      index: 2,
      text: '青椒去籽切细丝；蒜切片，干辣椒剪段。土豆丝捞出沥干，用厨房纸吸去表面水分。',
      minutes: 3,
      control: '沥干程度影响下锅后是否溅油',
    },
    {
      index: 3,
      text: '锅烧至冒青烟，下油滑锅，转大火下干辣椒与蒜片爆香，倒入土豆丝快速翻炒 60 秒。',
      minutes: 2,
      control: '全程大火，锅温不能掉',
    },
    {
      index: 4,
      text: '下青椒丝，加盐与糖翻匀，沿锅边淋白醋，再翻 15 秒出锅装盘。',
      minutes: 1,
      control: '醋沿锅边淋，靠锅气激香',
    },
  ],
}

export const mockCourses: Course[] = [
  {
    id: 1,
    title: '第 7 周 · 刀工与火候综合训练',
    dishes: ['青椒土豆丝', '醋溜白菜'],
    className: '烹饪工艺与营养 2301',
    teacherName: '陈立群',
    lessonAt: '2026-11-20 08:00',
    fileName: '第7周-刀工与火候-菜谱.pdf',
    fileSize: 486 * 1024,
    published: true,
    goal: '掌握 2mm 均匀切丝与大火快炒的出锅时机，成品要求丝不断、不粘锅、青椒翠绿。',
    receiverCount: 38,
    studentCount: 42,
  },
  {
    id: 2,
    title: '第 8 周 · 上浆与油温控制',
    dishes: ['滑炒鸡丝', '软炸里脊'],
    className: '烹饪工艺与营养 2301',
    teacherName: '陈立群',
    lessonAt: '2026-11-27 08:00',
    fileName: '第8周-上浆与油温-菜谱.pdf',
    fileSize: 512 * 1024,
    published: false,
    goal: '掌握蛋清淀粉上浆比例与三四成油温的判断，鸡肉不柴、不脱浆。',
    receiverCount: 0,
    studentCount: 42,
  },
  {
    id: 3,
    title: '第 6 周 · 基础刀工（已结课）',
    dishes: ['土豆丝', '萝卜花'],
    className: '西餐工艺 2302',
    teacherName: '李慧敏',
    lessonAt: '2026-11-13 08:00',
    fileName: '第6周-基础刀工-菜谱.pdf',
    fileSize: 402 * 1024,
    published: true,
    goal: '直刀、推刀、拉刀三种刀法的手部姿势与安全距离。',
    receiverCount: 35,
    studentCount: 36,
  },
]

/** AI 解读结果：难点与易错点，按菜谱步骤挂靠 */
export function mockRecipeAnalysis(courseId: number): RecipeAnalysis {
  return {
    courseId,
    summary:
      '这道菜的评分点集中在「丝」和「火」两件事上：切丝均匀度决定口感和成熟一致性，火候与下锅顺序决定是否出水、是否粘锅。下面 6 条按操作顺序排列，其中 3 条是该班往届最常失分的地方。',
    at: '2026-11-20 07:52',
    insights: [
      {
        id: 'i1',
        step: 1,
        kind: 'pitfall',
        title: '切好不泡水，土豆丝会发黑发黏',
        detail:
          '土豆含多酚氧化酶，暴露在空气里 3 分钟就开始褐变；表面淀粉不洗掉，下锅后糊化粘成一团。',
        advice: '切完立即入冷水，冲洗到水清为止；水里加几滴白醋可进一步抑制褐变。',
      },
      {
        id: 'i2',
        step: 1,
        kind: 'difficulty',
        title: '2mm 见方是最难稳住的一刀',
        detail:
          '新手常见问题是「片厚不均 → 丝粗细不匀」，粗丝没熟、细丝已经断。评分里均匀度占切配环节的 40%。',
        advice: '先把土豆修成规则方块再切片，切完一片就码平，用指关节抵住刀面做定位。',
      },
      {
        id: 'i3',
        step: 2,
        kind: 'pitfall',
        title: '带水下锅会溅油、也会降低锅温',
        detail: '沥不干的水进热油会瞬间爆溅，同时把锅温拉下来，土豆丝从「炒」变成「煮」。',
        advice: '沥水后摊在厨房纸上吸一遍，下锅前抖散，不要成团倒入。',
      },
      {
        id: 'i4',
        step: 3,
        kind: 'difficulty',
        title: '火候：锅要冒青烟，全程不能掉温',
        detail:
          '土豆丝下锅后锅内温度会骤降 60–80℃，如果火不够，出水后就成了炖土豆丝，脆感全失。',
        advice: '空锅烧到冒青烟再下油滑锅，土豆丝分两次下，每次只铺满锅底一层。',
      },
      {
        id: 'i5',
        step: 4,
        kind: 'pitfall',
        title: '醋放早了，酸味挥发、青椒发黄',
        detail: '白醋中的乙酸受热挥发很快，早放只剩酸涩没有香气；青椒久炒会从翠绿转橄榄色。',
        advice: '青椒下锅后 30 秒内完成调味，醋沿锅边淋一圈，翻 15 秒立刻出锅。',
      },
      {
        id: 'i6',
        kind: 'difficulty',
        title: '调味比例：宁淡不咸，酸味要能尝出来',
        detail: '本菜标准是咸鲜微酸，盐 2g、糖 1g、醋 5ml（300g 土豆）。糖不是为了甜，是压住醋的尖酸。',
        advice: '先放盐的 2/3，出锅前尝一根再补；糖必须和盐一起下，单独下容易结块。',
      },
    ],
  }
}
