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
    name: 'AI 综合评价',
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

/** 首屏下方的三条事实：全部来自开发方案中的技术要求，不是营销数字 */
export interface HeroFact {
  value: string
  unit: string
  label: string
}

export const heroFacts: HeroFact[] = [
  { value: '7', unit: '个', label: '评价环节覆盖一节课全程' },
  { value: '6', unit: '步', label: '烹饪步骤自动分段计时' },
  { value: '4', unit: '路', label: '视频并发分析（可扩展）' },
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

/** 导航：四到六个单词式名词，不做飘浮胶囊 */
export interface NavLink {
  label: string
  href: string
}

export const navLinks: NavLink[] = [
  { label: '模块', href: '#modules' },
  { label: '角色', href: '#roles' },
  { label: '流程', href: '#flow' },
  { label: '界面', href: '#product' },
  { label: '对接', href: '#integration' },
  { label: '场景', href: '#scenes' },
  { label: '问题', href: '#faq' },
]
