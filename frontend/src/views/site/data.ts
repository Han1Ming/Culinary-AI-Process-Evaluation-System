/**
 * 官网内容数据
 * ----------------------------------------------------------------------------
 * 文案纪律（依据 .codex/skills/design-taste-frontend/references/copy.md）：
 *   · 标题必须含名词，说清「是什么 / 给谁用」，不用口号、比喻、问句
 *   · 首屏必须有一个硬事实（数量、参数、日期），不写形容词
 *   · 按钮 = 动词 + 对象，不用「了解更多」「立即体验」这类空转标签
 *   · 不编造客户评价、合作院校、获奖、使用人数；没有的事实就不写
 */

/** 七大模块：与《项目开发方案》第三节一致 */
export interface SiteModule {
  /** 模块编号，用于页面锚点与列表标号 */
  key: string
  index: string
  name: string
  /** 一句话说明它解决什么问题，不超过 30 字 */
  summary: string
  /** 具体能力点，2-3 条 */
  points: string[]
  /** 对应的前端路由 */
  route: string
  /** 后端接口，供对接面板使用 */
  endpoint: string
  /** 接口当前状态 */
  state: 'ready' | 'pending'
}

export const siteModules: SiteModule[] = [
  {
    key: 'face',
    index: '01',
    name: '人脸识别签到',
    summary: '学生进入工位即完成签到，身份与本次实训任务绑定。',
    points: ['人脸信息采集与注册', '实时检测与身份比对', '签到记录按班级归档'],
    route: '/face-checkin',
    endpoint: 'POST /api/face/checkin',
    state: 'ready',
  },
  {
    key: 'uniform',
    index: '02',
    name: '着装规范识别',
    summary: '检测厨师服与厨师帽，不合规时当场提示。',
    points: ['工位摄像头实时取帧', '厨师服、厨师帽合规判定', '不合格记录留档备查'],
    route: '/modules/uniform',
    endpoint: 'POST /api/modules/uniform/analyze',
    state: 'pending',
  },
  {
    key: 'ingredient',
    index: '03',
    name: '食材预处理评价',
    summary: '分析切配动作与节奏，统计单位时间内的切丝次数。',
    points: ['刀具与操作区域定位', '切配动作识别', '切丝频率曲线'],
    route: '/modules/ingredient',
    endpoint: 'POST /api/modules/ingredient/analyze',
    state: 'pending',
  },
  {
    key: 'cooking',
    index: '04',
    name: '烹饪过程评价',
    summary: '识别六个烹饪步骤，记录每一步的开始、结束与时长。',
    points: ['六步骤自动分段', '四路视频并发分析', '步骤缺失与顺序错误提示'],
    route: '/modules/cooking',
    endpoint: 'WS /ws/cooking',
    state: 'pending',
  },
  {
    key: 'dish',
    index: '05',
    name: '菜肴成品分析',
    summary: '拍照上传成品菜，从五个维度给出评分与评语。',
    points: ['移动端拍照上传', '外观、摆盘、色彩、工艺、创意五维评分', '自动生成文字评语'],
    route: '/modules/dish',
    endpoint: 'POST /api/modules/dish/analyze',
    state: 'pending',
  },
  {
    key: 'summary',
    index: '06',
    name: '综合评价',
    summary: '汇总各环节结果，按评分标准生成个人实训报告。',
    points: ['跨模块成绩关联', '权重可配置的综合算法', '历史成绩查询与班级统计'],
    route: '/modules/summary',
    endpoint: 'GET /api/modules/summary/report',
    state: 'pending',
  },
  {
    key: 'chat',
    index: '07',
    name: '智能 AI 老师',
    summary: '发成品图或菜谱 PDF，按图说问题、按菜谱标难点。',
    points: ['图片与 PDF 附件问答', '难点与易错点标注到具体步骤', '回答给方法，不给分数'],
    route: '/chat',
    endpoint: 'POST /api/v1/chat（SSE）+ POST /api/v1/files',
    state: 'ready',
  },
]

/** 首屏下方的三条事实：两条技术规格 + 一条交付周期，全部与下文对得上 */
export interface HeroFact {
  value: string
  unit: string
  label: string
}

export const heroFacts: HeroFact[] = [
  { value: '7', unit: '个', label: '评价环节覆盖一节课全程' },
  { value: '6', unit: '步', label: '烹饪步骤自动分段计时' },
  { value: '4', unit: '周', label: '从现场勘查到验收签字' },
]

/** 一节课的时间线，用真实的课程节奏而不是抽象流程图 */
export interface FlowStep {
  time: string
  title: string
  detail: string
  /** 对应模块的 key，用于显示归属 */
  moduleKey: string
}

export const courseFlow: FlowStep[] = [
  { time: '08:00', title: '学生进入工位', detail: '人脸比对通过，签到写入本次实训任务。', moduleKey: 'face' },
  { time: '08:05', title: '着装检查', detail: '摄像头判断厨师服与厨师帽，不合格即时提示更换。', moduleKey: 'uniform' },
  { time: '08:20', title: '备菜与切配', detail: '记录切配时长与切丝频率，形成操作节奏曲线。', moduleKey: 'ingredient' },
  { time: '08:50', title: '开火烹饪', detail: '六个步骤自动分段，每段起止时间精确到秒。', moduleKey: 'cooking' },
  { time: '09:30', title: '装盘与拍照', detail: '学生上传成品照片，五维评分当场返回。', moduleKey: 'dish' },
  { time: '09:40', title: '生成实训报告', detail: '各环节成绩按权重汇总，教师确认后归档。', moduleKey: 'summary' },
]

/** 技术栈：只列真实使用的，不写「行业领先」这类定语 */
export interface StackItem {
  group: string
  items: string[]
}

export const techStack: StackItem[] = [
  { group: '前端', items: ['Vue 3 + TypeScript', 'Element Plus', 'Pinia / Vue Router', 'Vite'] },
  { group: '后端', items: ['FastAPI', 'MySQL', 'Redis 缓存', 'WebSocket'] },
  { group: 'AI 推理', items: ['PyTorch / ONNX', '多模态大模型 API', 'LangChain · RAG', 'Chroma 向量库'] },
]

/** 接口对接清单：给后端同学的对照表，也是「模块页」里接入面板的数据来源 */
export interface ApiContract {
  module: string
  method: 'GET' | 'POST' | 'WS' | 'SSE'
  path: string
  payload: string
  response: string
}

export const apiContracts: ApiContract[] = [
  {
    module: '人脸签到',
    method: 'POST',
    path: '/api/face/checkin',
    payload: 'FormData: file(jpeg), user_id?',
    response: '{ success, user, timestamp, similarity }',
  },
  {
    module: '着装规范',
    method: 'POST',
    path: '/api/modules/uniform/analyze',
    payload: 'FormData: file, task_id',
    response: '{ compliant, items[], confidence }',
  },
  {
    module: '食材预处理',
    method: 'POST',
    path: '/api/modules/ingredient/analyze',
    payload: 'FormData: video | frames[]',
    response: '{ frequency, curve[], score }',
  },
  {
    module: '烹饪过程',
    method: 'WS',
    path: '/ws/cooking',
    payload: '帧流（4 路）+ task_id',
    response: '逐帧推送 { step, start, end }',
  },
  {
    module: '菜肴成品',
    method: 'POST',
    path: '/api/modules/dish/analyze',
    payload: 'FormData: image, task_id',
    response: '{ scores{5}, comment }',
  },
  {
    module: '综合评价',
    method: 'GET',
    path: '/api/modules/summary/report',
    payload: '?student_id&task_id',
    response: '{ total, items[], report_url }',
  },
  {
    module: '智能 AI 老师',
    method: 'SSE',
    path: '/api/v1/chat',
    payload: '{ session_id, message, file_ids? }',
    response: 'text/event-stream: data:{token}'
  },
  {
    module: '附件上传',
    method: 'POST',
    path: '/api/v1/files',
    payload: 'multipart/form-data: file',
    response: '{ id, name, size, mime, url }',
  },
]

/** 适用场景：写「这类客户用它做什么」，不写「已服务 XX 所学校」 */
export interface SceneItem {
  title: string
  detail: string
  points: string[]
}

export const scenes: SceneItem[] = [
  {
    title: '高职院校烹饪实训室',
    detail: '一节课 30 到 40 人，教师无法同时盯住每个工位的操作细节。',
    points: ['过程数据自动留档', '实训报告直接进教务系统', '课堂回放定位问题环节'],
  },
  {
    title: '技能大赛与考核',
    detail: '评分需要可追溯的依据，评委口径要一致。',
    points: ['步骤时长与操作记录可复核', '同一套评分标准贯穿全场', '成绩单支持导出归档'],
  },
  {
    title: '餐饮企业内训',
    detail: '新员工的出品标准靠师傅带，难以规模化。',
    points: ['标准菜品作为评分基准', '培训进度按人统计', '出师考核有量化依据'],
  },
]

/** 常见问题：回答技术选型与落地细节，教师和信息化部门都会问 */
export interface FaqItem {
  q: string
  a: string
}

export const faqs: FaqItem[] = [
  {
    q: '实训室已有的摄像头能直接用吗？',
    a: '能。系统按标准 RTSP 流接入，1080P 网络摄像机即可，不需要专用采集卡。工位上方俯拍和正前方平视各一路效果最好。',
  },
  {
    q: '断网的时候数据会不会丢？',
    a: '前端会缓存未提交的签到与评价结果，网络恢复后按顺序补传。视频分析在后端进行，断网期间只影响实时画面，不影响已入库的数据。',
  },
  {
    q: '评分标准可以按学校自己的要求改吗？',
    a: '可以。各维度权重、及格线、扣分项都在后台配置，改完对下一次实训生效，历史成绩保留当时的评分快照。',
  },
  {
    q: '学生人脸照片和视频存在哪里？',
    a: '全部存在校内服务器，不上传第三方。人脸特征以向量形式存储，原图可配置保留周期，删除学生档案时一并清除。',
  },
  {
    q: '怎么和现有的教务系统对接？',
    a: '提供 REST 接口与统一响应格式，学生名单、班级、实训任务支持定时同步或按需拉取。对接工作量通常在 2 到 3 人日。',
  },
  {
    q: '部署需要什么服务器？',
    a: '四路视频并发推理建议 1 张 24G 显存的 GPU；仅做业务与数据库时，8 核 16G 的通用服务器即可。支持 Docker Compose 单机部署。',
  },
]

/**
 * 导航：六个单词式名词。
 * 【必须与首页 DOM 从上到下的顺序完全一致】——高亮是按页面位置算的，
 * 以前把「定价」排在「流程」前面，滚到定价区时导航会亮在「流程」上，
 * 两套顺序不一致就是这个 bug 的根因。加分区时同步改这里。
 */
export interface NavLink {
  label: string
  href: string
}

export const navLinks: NavLink[] = [
  { label: '模块', href: '#modules' },
  { label: '流程', href: '#flow' },
  { label: '测算', href: '#roi' },
  { label: '定价', href: '#pricing' },
  { label: '实施', href: '#delivery' },
  { label: '问题', href: '#faq' },
]

// ============================================================================
// 商业部分（定价 / 测算 / 实施 / 合规）
// ----------------------------------------------------------------------------
// 写这一节的前提：访客不是「来看看产品」，是「来评估能不能买」。
// 所以必须有报价口径、有含与不含、有交付时间、有验收指标。
//
// 【纪律】所有价格都是**参考价**，正式报价按工位数与部署方式出。
// 页面里也照实写「参考价」，不写成「仅需 ¥X」——学校采购会拿这句话来对账。
// ============================================================================

/** 套餐：三档覆盖三种采购路径（先试一个模块 / 整室年费 / 私有化买断） */
export interface Plan {
  key: string
  name: string
  /** 价格主数字，不含货币符号 */
  price: string
  /** 价格单位，如「/ 学期」 */
  unit: string
  /** 一句话说明这一档给谁 */
  fit: string
  /** 采购方最关心的三个数字 */
  scale: string
  includes: string[]
  /** 交付物：写在明面上，减少立项时的反复问 */
  deliverable: string
  /** 卡片自己的动作按钮：动词 + 对象，指向留资页并带上这一档 */
  cta: string
  /** 视觉上强调的一档（全年费），靠底色，不靠角标 */
  emphasis?: boolean
}

export const plans: Plan[] = [
  {
    key: 'pilot',
    name: '单模块试点',
    price: '18,000',
    unit: '/ 学期',
    fit: '先验证识别效果，不承担整室改造风险。',
    scale: '4 个工位 · 1 个模块',
    includes: [
      '人脸签到或成品分析任选一个',
      '工位摄像头接入与角度调试',
      '教师账号 5 个、学生账号 200 个',
      '开课培训 2 场（各 90 分钟）',
    ],
    deliverable: '试点期结束提供一份识别准确率与教师反馈报告，作为是否续采的依据。',
    cta: '索取试点报价',
  },
  {
    key: 'annual',
    name: '实训室年费',
    price: '1,200',
    unit: '/ 工位 / 年',
    fit: '整间实训室上线，30 个工位起。',
    scale: '30 工位起 · 七个模块全开',
    includes: [
      '七个评价模块 + 智能 AI 老师',
      '问答额度每月 5,000 次，超出按量计',
      '评分标准配置与权重调整',
      '学期初模型校准 1 次',
      '工作日 2 小时响应',
    ],
    deliverable: '按工位计费，学年内可增减工位，按剩余月份折算。',
    cta: '按工位核算年费',
    emphasis: true,
  },
  {
    key: 'onprem',
    name: '私有化买断',
    price: '280,000',
    unit: '起 · 一次性',
    fit: '数据不出校、需要二次开发或与教务深度对接。',
    scale: '不限工位 · 源码交付',
    includes: [
      '完整源码与部署文档',
      '内网离线部署（无外网亦可运行）',
      '对接教务系统的接口开发 10 人日',
      '管理员与运维培训 3 天',
      '第二年起按合同额 15% 收年服务费',
    ],
    deliverable: '交付源码仓库、部署脚本、数据库结构与接口文档各一套。',
    cta: '索取买断方案',
  },
]

/** 报价说明：三条最容易在立项会上被追问的事 */
export const pricingNotes: { label: string; text: string }[] = [
  {
    label: '不包含',
    text: 'GPU 服务器等硬件、校内网络与摄像头改造、与教务系统的定制对接（超出 10 人日的部分按 2,000 元/人日计）。',
  },
  {
    label: '付款节奏',
    text: '合同签订 30%、试点验收 40%、正式验收 30%。年费档按学年预付，中途退订按已用月份结算。',
  },
  {
    label: '发票与流程',
    text: '可开增值税专用发票，支持政府采购平台下单、竞争性磋商与单一来源公示所需的资质材料。',
  },
]

/** 成本测算的默认值：一所高职一个烹饪实训室的常见规模，可在页面上改 */
export interface RoiInput {
  /** 每学期参与实训的人次（班级数 × 人数 × 实训次数） */
  sessions: number
  /** 人工逐份评分与录入成绩的平均耗时（分钟） */
  minutes: number
  /** 学校用人综合成本（元/小时，含课时费、绩效与教务核算） */
  rate: number
  /** 并发工位数，用于折算系统费用 */
  seats: number
}

export const roiDefaults: RoiInput = {
  sessions: 1200,
  minutes: 12,
  rate: 120,
  seats: 30,
}

/** 年费档单价（元/工位/年），测算与定价页共用，避免两处数字对不上 */
export const SEAT_PRICE_PER_YEAR = 1200
/** 上线后教师只做抽检复核，这一比例来自评价流程设计，不是乐观估计 */
export const REVIEW_RATIO = 0.2

/** 实施里程碑：以周为单位，写给要排工期的人看 */
export interface Milestone {
  week: string
  title: string
  detail: string
  /** 这一周结束时要交出的东西 */
  output: string
}

export const milestones: Milestone[] = [
  {
    week: 'W1',
    title: '现场勘查',
    detail: '量工位间距、看照明与逆光、测上行带宽、定摄像头挂点与俯角。',
    output: '布线方案与设备清单（含型号、数量、预算）',
  },
  {
    week: 'W2',
    title: '环境部署',
    detail: '装服务器或开通云端实例，导入学生名册与班级，跑通一路视频。',
    output: '可登录的测试环境 + 账号清单',
  },
  {
    week: 'W3',
    title: '单节课试跑',
    detail: '选一个班按真实课程节奏跑完整链路，教师跟课记录误判与卡点。',
    output: '试跑问题清单（按严重程度排序）',
  },
  {
    week: 'W4',
    title: '培训与验收',
    detail: '配置本校评分标准与权重，培训教师与管理员，按验收指标逐条签字。',
    output: '验收单 + 教师操作手册',
  },
]

/** 验收指标：写具体数字，不写「效果良好」 */
export interface Acceptance {
  metric: string
  target: string
  /** 测量条件，缺了条件的目标值没有意义 */
  condition: string
}

export const acceptance: Acceptance[] = [
  { metric: '人脸签到通过率', target: '≥ 98%', condition: '本人、正面、正常室内光照' },
  { metric: '着装识别漏检率', target: '≤ 5%', condition: '工位正前方机位，厨师服与厨师帽可见' },
  { metric: '一节课成绩生成耗时', target: '≤ 10 分钟', condition: '40 人、单机 4 路并发' },
  { metric: '断网续传', target: '不丢数据', condition: '断网 30 分钟内，恢复后自动补传' },
]

/** 服务承诺 */
export const serviceLevels: { label: string; value: string }[] = [
  { label: '响应时间', value: '工作日 9:00–18:00，2 小时内响应' },
  { label: '故障恢复', value: '影响上课的故障 8 小时内恢复，超时按合同扣减服务费' },
  { label: '模型校准', value: '每学期 1 次，用本校新增样本重训着装与成品模型' },
  { label: '数据处置', value: '合同终止后 30 日内导出全部数据并删除副本，出具书面确认' },
]

/** 预约演示：表单下拉选项与「需要准备什么」 */
export const demoScales = ['4 个工位以内', '5–20 个工位', '21–40 个工位', '40 个工位以上'] as const
export const demoPlans = ['还不确定，想先了解', '单模块试点', '实训室年费', '私有化买断'] as const
export const demoWants = ['远程演示（30 分钟）', '带本校视频现场跑一遍', '上门勘查'] as const

export const demoPrepares: string[] = [
  '实训室的工位数与摄像头型号，决定演示用几路视频。',
  '本学期要评的 1–2 道菜，最好带一份学校自己的评分表。',
  '参与决策的人：专业负责人、实训教师、信息中心各一位最省来回。',
]

/** 合规文档：内容由路由 meta 的 doc 字段选择 */
export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDoc {
  title: string
  updatedAt: string
  lead: string
  sections: LegalSection[]
}

export const legalDocs: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: '隐私政策',
    updatedAt: '2026-11-01',
    lead: '本政策说明本系统在处理学生人脸信息、课堂视频与成绩数据时的范围、存储位置与保留期限。系统面向学校部署，学校是数据的控制者，我们仅作为受托处理方。',
    sections: [
      {
        heading: '一、处理哪些信息',
        paragraphs: [
          '账号信息：姓名、学号或工号、班级或教研室、手机号、登录账号。用于身份识别与成绩归属。',
          '人脸信息：注册时采集的一张人脸照片及由此提取的特征向量。仅用于实训签到时的 1:1 比对，不做身份检索，不用于训练对外提供的模型。',
          '课堂视频：工位摄像头采集的操作过程录像与抽帧。用于切配、烹饪、成品三个环节的过程评价与事后复核。',
          '成绩数据：各环节得分、扣分项、教师裁量记录与最终报告。',
        ],
      },
      {
        heading: '二、存在哪里',
        paragraphs: [
          '私有化部署时，全部数据存放在学校机房或学校指定的云主机，我们不保留副本。',
          '年费托管模式下，数据存放在境内机房，按学校隔离，不与其它学校共用存储。数据不出境。',
          '人脸特征以向量形式存储，原始照片的保留周期可在后台配置，默认学期结束后删除原图、保留特征。',
        ],
      },
      {
        heading: '三、保留多久',
        paragraphs: [
          '课堂视频默认保留 1 个学期，用于成绩复核与教学检查，到期自动清理。',
          '成绩与评价记录按学校教务要求保留，通常为 3 至 6 年。',
          '学生毕业或退学时，删除其账号与人脸特征；删除操作在后台留痕，可导出删除记录。',
        ],
      },
      {
        heading: '四、谁能看到',
        paragraphs: [
          '学生只能看到自己的签到、各环节得分与报告，看不到同学的数据与班级排名。',
          '教师可看到所带班级学生的过程数据与成绩，用于复核与归档。',
          '管理员可看到账号与运行状态，不参与评分。所有查看与修改操作记入审计日志。',
        ],
      },
      {
        heading: '五、未成年人',
        paragraphs: [
          '中职阶段学生可能未满 18 周岁。此类场景下，人脸采集需取得学生本人与监护人的书面同意，同意书模板由我方提供，学校负责组织签署与留存。',
        ],
      },
      {
        heading: '六、联系',
        paragraphs: [
          '数据相关的查询、更正与删除请求，请通过预约演示页面留下的联系方式与我们联系，或直接联系学校信息化主管部门。我们会在 5 个工作日内答复。',
        ],
      },
    ],
  },
  terms: {
    title: '服务条款',
    updatedAt: '2026-11-01',
    lead: '本条款适用于本系统的试用、年费与私有化三种交付方式。具体权利义务以双方签署的合同为准，本页仅作签约前的公开说明。',
    sections: [
      {
        heading: '一、试用',
        paragraphs: [
          '试用期为 30 日，开放单模块与 10 个工位，用于验证识别效果。',
          '试用期不收取费用，学校自备摄像头与网络；需要我方提供临时服务器时按 2,000 元/月计。',
          '试用期结束未签约的，我方在 7 日内删除试用数据并出具书面确认。',
        ],
      },
      {
        heading: '二、交付与验收',
        paragraphs: [
          '交付内容以订单或合同附件列明的模块清单为准。未列明的模块不在交付范围内。',
          '验收按本页公布的验收指标逐条测量，测量条件同时适用；条件不满足时双方先整改环境再复测。',
          '验收期限为部署完成后 15 个工作日，逾期未提出书面异议视为验收通过。',
        ],
      },
      {
        heading: '三、费用与发票',
        paragraphs: [
          '年费档按学年预付，学年内增减工位按剩余月份折算，不足一个月的按一个月计。',
          '私有化买断含首年服务，第二年起按合同额 15% 收取年服务费，含模型校准、版本升级与技术支持。',
          '可开具增值税专用发票。政府采购项目的付款节点以合同约定为准。',
        ],
      },
      {
        heading: '四、双方责任',
        paragraphs: [
          '我方负责软件功能、模型效果与部署实施；学校负责摄像头、网络、服务器等基础设施，以及学生告知与授权。',
          '因基础设施不达标（光照不足、上行带宽不够、摄像头分辨率低于 1080P）导致的识别偏差，不属于质量责任范围。',
          '因学校未按约定取得人脸采集授权引发的争议，由学校承担。',
        ],
      },
      {
        heading: '五、知识产权',
        paragraphs: [
          '年费与试用方式下，软件著作权归我方所有，学校获得合同期内的使用许可，不得反向工程或转授权。',
          '私有化买断方式下，学校获得源码的使用与修改权，可将修改用于本校教学；不得将源码或衍生系统对外销售。',
        ],
      },
      {
        heading: '六、终止',
        paragraphs: [
          '任一方提前 30 日书面通知可终止年费服务，已发生费用按实际使用月份结算。',
          '终止后 30 日内，学校可导出全部数据；逾期未导出的，我方按隐私政策约定的期限删除。',
        ],
      },
    ],
  },
}
