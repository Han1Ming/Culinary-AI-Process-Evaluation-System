/**
 * 浮空助手的本地知识库
 * ----------------------------------------------------------------------------
 * 【职责边界】这是整份代码里最重要的一条设计约束：
 *   助手只负责「找到功能」「解释规则」「排查故障」「汇总数据」四件事，
 *   不回答任何具体的菜品评分、切丝频率、着装判定结果——那些是七个评价模块的职责。
 *   遇到越界提问，一律引导到对应模块，避免两个入口给出不一致的答案。
 *
 * 【按角色分库】三个角色的疑问根本不是一类：
 *   学生问的是「这道菜怎么做、菜谱在哪、我的分在哪看」；
 *   教师问的是「怎么上传、怎么扣分、怎么归档、接口在哪」；
 *   管理员不挂这个入口（见 config/permissions.ts 的 assistant.use）。
 *   所以同一句「怎么弄」在两侧要给出不同答案，用 roles 字段分流，
 *   而不是写一句放之四海皆可的废话。
 *
 * 匹配方式：关键词加权打分，取最高分的意图；分数低于阈值走兜底。
 * 后端就绪后可把 matchIntent 替换为 /api/assistant/chat 的返回。
 */
import type { UserRole } from '@/types'

export interface AssistantAction {
  label: string
  /** 站内跳转目标 */
  to?: string
}

export interface AssistantReply {
  /** 回答正文，支持换行 */
  text: string
  /** 可选的操作按钮 */
  action?: AssistantAction
  /** 命中意图的标识，便于埋点分析 */
  intent: string
}

/** 助手服务的角色：管理员不在其中 */
export type AssistantRole = Extract<UserRole, 'student' | 'teacher'>

interface Intent {
  id: string
  /** 关键词及权重，命中越具体权重越高 */
  keys: Array<[string, number]>
  /** 限定角色；缺省表示两侧通用 */
  roles?: AssistantRole[]
  reply: AssistantReply
}

/* ============================ 通用（师生都会问） ============================ */

const commonIntents: Intent[] = [
  {
    id: 'camera-issue',
    keys: [
      ['摄像头', 5],
      ['打不开', 6],
      ['黑屏', 6],
      ['权限', 5],
      ['看不到画面', 6],
      ['镜头', 4],
    ],
    reply: {
      intent: 'camera-issue',
      text: '按这个顺序查，多数情况是第一步：\n\n1. 看浏览器地址栏左侧的摄像头图标，确认是「允许」而不是「已阻止」；\n2. 关掉腾讯会议、钉钉等占用摄像头的程序；\n3. 换 Chrome 或 Edge 最新版，Safari 对 getUserMedia 限制较多；\n4. 如果是外接 USB 相机，换一个 USB 口，前置面板的口供电常常不足。\n\n仍然黑屏的话，把设备管理里相机的名字发我，我帮你判断是不是驱动问题。',
    },
  },
  {
    id: 'login-issue',
    keys: [
      ['登录不了', 8],
      ['忘记密码', 8],
      ['进不去', 6],
      ['密码', 5],
      ['账号', 4],
    ],
    reply: {
      intent: 'login-issue',
      text: '账号由学校统一开通。忘记密码找管理员在「用户管理」里重置，重置后是初始密码，首次登录要改。\n\n如果提示「无权访问该页面」，那是角色权限，不是密码问题——不同角色能看到的菜单本来就不一样。',
    },
  },
  {
    id: 'api-integration',
    keys: [
      ['接口', 6],
      ['对接', 5],
      ['后端', 5],
      ['api', 6],
      ['联调', 6],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'api-integration',
      text: '每个评价模块页右侧都有一块「后端接入」面板，列出该模块需要的接口、请求体与响应体，路径和前端实际调用完全一致，不会过期。\n\n人脸签到与智能 AI 老师是满宽布局，接口收在页头的「接口」抽屉里。统一响应是 { code, data, message }，鉴权走 Bearer Token；把 VITE_USE_MOCK 改成 false 就切真实接口，业务代码不用动。',
      action: { label: '打开烹饪过程评价', to: '/modules/cooking' },
    },
  },
  {
    id: 'module-list',
    keys: [
      ['有哪些功能', 8],
      ['几个功能', 7],
      ['模块', 5],
      ['能做什么', 4],
    ],
    reply: {
      intent: 'module-list',
      text: '七个模块：人脸签到、着装规范识别、食材预处理评价、烹饪过程评价、菜肴成品分析、综合评价、智能 AI 老师。\n\n前六个按一节课的时间顺序排，第七个是课后的答疑——能发成品图或菜谱 PDF 问「哪里不对、下次怎么改」。左侧菜单里顺序固定，不要记错前后。',
      action: { label: '查看评价总览', to: '/ai-eval' },
    },
  },
]

/* ================================ 学生侧 ================================ */

const studentIntents: Intent[] = [
  {
    id: 'student-recipe',
    keys: [
      ['菜谱', 7],
      ['配方', 5],
      ['这节课做', 7],
      ['做什么菜', 7],
      ['pdf', 5],
      ['课件', 5],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-recipe',
      text: '本节课的菜谱在「课程管理」里，教师上传后会出现在你的课程列表中。打开课程详情就能直接看这份 PDF，也可以下载到本地。\n\n菜谱页右边有一个「解析这份菜谱」按钮——点它，系统会把这份菜谱的难点、易错点和关键火候标出来，比你自己通读一遍快得多。',
      action: { label: '打开课程管理', to: '/courses' },
    },
  },
  {
    id: 'student-hardpoint',
    keys: [
      ['难点', 8],
      ['易错', 8],
      ['重点', 5],
      ['标注', 5],
      ['看不懂', 5],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-hardpoint',
      text: '打开课程详情，右边「菜谱解读」那一栏会给出三类标注：\n\n· 难点——这一步为什么容易失败（比如炒糖色的温度窗口只有十几度）；\n· 易错——新手最常做错的动作；\n· 关键控制点——直接对应评分项，做错要扣分。\n\n解析只针对这份菜谱，不会替你做，也不会给你打分。',
      action: { label: '打开课程管理', to: '/courses' },
    },
  },
  {
    id: 'student-my-score',
    keys: [
      ['我的成绩', 9],
      ['我的分', 8],
      ['多少分', 5],
      ['排名', 6],
      ['成绩', 5],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-my-score',
      text: '你的分在「综合评价」里，只能看到自己的：五个环节各占多少分、总分多少、教师有没有调整过。\n\n班级名单和其他同学的分数只对教师开放——这是权限边界，不是没加载出来。',
      action: { label: '查看我的评价', to: '/modules/summary' },
    },
  },
  {
    id: 'student-upload',
    keys: [
      ['上传', 5],
      ['成品照片', 8],
      ['交作业', 7],
      ['传不上去', 8],
      ['文件太大', 7],
      ['图片', 4],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-upload',
      text: '成品照在「菜肴成品分析」页上传，上限 4MB，前端会先压到 1600px 宽再传，正常不会超。\n\n两个常见失败：iPhone 默认的 HEIC 格式部分浏览器读不出来，改成 JPG；或者拍摄时盘子没进画面中心，系统裁不到主体，会提示「未识别到菜品」。',
      action: { label: '打开成品分析', to: '/modules/dish' },
    },
  },
  {
    id: 'student-cook',
    keys: [
      ['怎么做', 7],
      ['怎么炒', 7],
      ['火候', 7],
      ['勾芡', 6],
      ['焯水', 6],
      ['腌制', 6],
      ['油温', 6],
      ['刀工', 6],
      ['切丝', 5],
      ['怎么处理', 6],
      ['收汁', 6],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-cook',
      text: '具体做法以本节菜谱为准——不同菜系的配比和火候差别很大，我给的通用经验可能和你们的标准不一致。\n\n我只能讲通用工艺：焯水冷水下锅、撇净浮沫再捞出；炒糖色用小火，冰糖化开到枣红色大约 160℃，冒小泡立刻下料；勾芡要关小火、分两次淋，一次太稠就回不去了。\n\n要按你们的标准来，去课程详情点「解析这份菜谱」，它标的是这份菜谱的难点。',
      action: { label: '打开课程管理', to: '/courses' },
    },
  },
  {
    id: 'student-checkin',
    keys: [
      ['签到', 7],
      ['打卡', 6],
      ['代签', 6],
      ['考勤', 6],
      ['签不上', 8],
    ],
    roles: ['student'],
    reply: {
      intent: 'student-checkin',
      text: '进工位后打开「人脸识别签到」，正对摄像头、别低头，系统每 1.5 秒截一帧比对，通过会自动写入本次实训。\n\n签不上通常是三个原因：光线太暗（背光最糟）、口罩没摘、注册时留的照片和现在差别太大（换了发型或戴了眼镜）。第三种只能让管理员在用户管理里帮你补录一张新的。',
      action: { label: '打开人脸签到', to: '/face-checkin' },
    },
  },
]

/* ================================ 教师侧 ================================ */

const teacherIntents: Intent[] = [
  {
    id: 'teacher-upload-course',
    keys: [
      ['上传菜谱', 10],
      ['上传课程', 9],
      ['发菜谱', 8],
      ['布置', 6],
      ['新建课程', 8],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-upload-course',
      text: '「课程管理」页右上角「上传课程」：填菜名、选班级、选实训日期，再把 PDF 拖进来。上传后学生端立刻可见。\n\n两个约定：PDF 上限 20MB，超过请先压图；同一班级同一天只能有一节课，重复上传会提示覆盖而不是并存——避免学生端出现两份菜谱。',
      action: { label: '打开课程管理', to: '/courses' },
    },
  },
  {
    id: 'teacher-deduct',
    keys: [
      ['扣分', 9],
      ['扣他', 8],
      ['不合规', 8],
      ['人工判定', 9],
      ['改分', 7],
      ['纠正', 5],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-deduct',
      text: '五个评价模块页里都有一块「教师复核」：勾选问题项 → 填扣分值和一句说明 → 提交。扣完这个环节的分立刻重算，学生端能马上看到。\n\n扣分必须写理由，会进审计日志，归档后不可改。想撤销只能在归档前重新提交一次，以最后一次为准。',
      action: { label: '打开着装规范', to: '/modules/uniform' },
    },
  },
  {
    id: 'teacher-archive',
    keys: [
      ['归档', 9],
      ['复核', 8],
      ['提交成绩', 8],
      ['定稿', 6],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-archive',
      text: '在「综合评价」右侧详情里点「归档当前成绩」：归档会锁定分数、生成快照，之后权重再调整也不影响这一批。\n\n低于 60 分的会先要求复核再归档。整班归档前建议先导出一次核对名单，漏人的话只能逐个重归档，比较费事。',
      action: { label: '打开综合评价', to: '/modules/summary' },
    },
  },
  {
    id: 'teacher-export',
    keys: [
      ['导出', 7],
      ['成绩单', 7],
      ['excel', 6],
      ['pdf', 5],
      ['表格下载', 6],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-export',
      text: '班级成绩在「综合评价」页右上角「导出班级成绩」，导出 CSV，Excel / WPS 双击直接打开，一行一个学生，含五个环节得分、教师现场扣分和总分。\n\n单人报告点「导出当前报告」，会打开一张 A4 打印页，在打印对话框里选「另存为 PDF」就能发给学生或存档。导出不含视频，视频按保留周期在服务器清理。',
      action: { label: '打开综合评价', to: '/modules/summary' },
    },
  },
  {
    id: 'teacher-class-list',
    keys: [
      ['班级名单', 9],
      ['导入', 6],
      ['学生名单', 7],
      ['加人', 4],
      ['建账号', 6],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-class-list',
      text: '班级名单由管理员在「用户管理」里维护，你没有这个入口。要加人或改班级，把名单发给管理员，或者直接在「用户管理」页让管理员用模板批量导入。\n\n如果只是要看某个班的成绩排名，在「综合评价」左侧名单里切换班级即可。',
      action: { label: '打开综合评价', to: '/modules/summary' },
    },
  },
  {
    id: 'teacher-score-rule',
    keys: [
      ['评分标准', 8],
      ['权重', 7],
      ['及格线', 7],
      ['怎么算', 5],
      ['总分', 4],
      ['评分规则', 8],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-score-rule',
      text: '综合分 = Σ（环节得分 × 权重），默认：签到与着装 15%、食材预处理 20%、烹饪过程 30%、菜肴成品 30%、课堂问答 5%。\n\n权重、及格线和扣分项在「综合评价」的评分标准里改，改完对下一次实训生效；历史成绩保留当时的快照，不会被追溯修改。',
      action: { label: '打开综合评价', to: '/modules/summary' },
    },
  },
  {
    id: 'teacher-notice',
    keys: [
      ['通知', 7],
      ['公告', 7],
      ['发布消息', 8],
      ['告诉学生', 7],
    ],
    roles: ['teacher'],
    reply: {
      intent: 'teacher-notice',
      text: '通知发布目前只开给管理员——它发的是全站公告，会同时推给三个角色，教师误发的影响面太大。\n\n班级范围内的事（改时间、补交）建议直接在班级群里说，或者写在课程说明里，学生打开课程就能看到。',
    },
  },
]

const ALL_INTENTS: Intent[] = [...commonIntents, ...studentIntents, ...teacherIntents]

/** 兜底回复：说清楚能帮什么，不让用户对着一句「我没听懂」发愣 */
const FALLBACK: Record<AssistantRole, AssistantReply> = {
  student: {
    intent: 'fallback',
    text: '这个问题我答不上来。我能帮你的是：找菜谱、讲这节课的难点在哪看、告诉你去哪签到和交成品、查你自己的分数。\n\n可以这样问：「这节课菜谱在哪」「红烧肉怎么收汁」「我的成绩在哪看」。具体某个菜怎么评分，得看评价模块里的结果。',
  },
  teacher: {
    intent: 'fallback',
    text: '这个问题我答不上来。我擅长的是：上传课程菜谱、解释扣分与归档的规则、导出成绩、排查摄像头和上传的问题、告诉你接口在哪。\n\n可以这样问：「怎么上传菜谱」「扣分怎么留痕」「成绩怎么归档」。',
  },
}

/** 面板开场白：第一句话就说明「我能干什么」，而不是「你好我是助手」 */
const GREETING: Record<AssistantRole, string> = {
  student:
    '我是这节课的助手。菜谱在哪、难点怎么看、成品怎么交、你的分在哪查，都可以问我。\n\n具体的评分和识别结果不归我管——那在评价模块里。',
  teacher:
    '我是教学端助手。上传菜谱、扣分留痕、复核归档、导出成绩、接口对接，都可以问我。\n\n学生的具体分数请到评价模块里看，我不重复报数。',
}

/** 快捷问题：放在面板底部，让用户不用打字就能看到能问什么 */
const QUICK: Record<AssistantRole, string[]> = {
  student: ['这节课菜谱在哪', '红烧肉怎么收汁', '我的成绩在哪看', '成品照片怎么上传'],
  teacher: ['怎么上传菜谱', '扣分怎么留痕', '成绩怎么归档', '接口在哪看'],
}

export function getGreeting(role: AssistantRole): string {
  return GREETING[role]
}

export function getQuickQuestions(role: AssistantRole): string[] {
  return QUICK[role]
}

/** 把用户输入拆成可用于匹配的形式：转小写、去掉常见语气词与标点 */
function normalize(input: string): string {
  return input.toLowerCase().replace(/[?？,，。!！、\s]/g, '')
}

/**
 * 匹配意图
 * 每条命中的关键词按权重累加，最高分且超过阈值才算命中，
 * 避免「签到」两个字出现在一句无关的话里就跳转。
 *
 * 角色过滤放在打分前：学生问「怎么扣分」不该命中教师侧的答案，
 * 命中不到就走兜底，兜底文案本身也按角色写。
 */
export function matchIntent(input: string, role: AssistantRole = 'student'): AssistantReply {
  const text = normalize(input)
  if (!text) return FALLBACK[role]

  let best: { score: number; reply: AssistantReply } | null = null

  for (const intent of ALL_INTENTS) {
    if (intent.roles && !intent.roles.includes(role)) continue
    let score = 0
    for (const [key, weight] of intent.keys) {
      if (text.includes(normalize(key))) score += weight
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, reply: intent.reply }
    }
  }

  // 阈值 5：单个一般权重关键词（4）不足以触发跳转
  return best && best.score >= 5 ? best.reply : FALLBACK[role]
}
