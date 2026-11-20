# Culinary-AI-Process-Evaluation-System

> 基于计算机视觉与多模态大模型的烹饪实训全过程 AI 评价系统
> 本仓库当前交付：**可运行、可演示、可交接的企业级前端骨架**（Vue 3 + TypeScript + Element Plus）

前端已完成整体框架、官网、智能 AI 老师（附件问答 + SSE 流式）、人脸签到（含 Mock 闭环）、工作台、用户管理、
课程与通知管理，以及七个评价模块（其中四个模块支持教师选人复核）；
后端 FastAPI + MySQL 接口按本文档「六、前后端联调约定」对齐即可逐个替换 Mock。

> **第一次接触这个项目，先读 [`docs/项目完整指南.md`](docs/项目完整指南.md)。**
> 它按「从 0 跑起来 → 改代码 → 接后端 → 写论文 → 答辩」的顺序写成 14 章，包含完整 MySQL 建表语句、
> 逐模块的实现与验收标准、论文章节字数分配、10 分钟答辩讲稿与 7 个必被问到的问题。
> 本 README 是**速查手册**，指南是**教学与交付文档**，两者不重复。

---

## 〇、仓库里有什么

| 目录 | 内容 | 该不该改 |
| --- | --- | --- |
| `frontend/` | 全部前端源码（Vue 3 + TS + Element Plus），可独立运行 | 主要工作区 |
| `backend/` | 后端占位目录，当前只有一份 `requirements.txt` 建议依赖清单（FastAPI + MySQL + 视觉/大模型库）。FastAPI 代码由后端同学在这个目录下建，前端不依赖其源码 | 后端同学 |
| `docs/项目完整指南.md` | 14 章完整指南：跑起来 / 改代码 / 接后端 / 建表 / 写论文 / 答辩 | 随代码一起更新 |
| `docs/reference/` | 需求与方案原始材料（任务书、开发方案、项目介绍）+ 一份索引说明 | 只读存档 |
| `docs/assets/` | 真实运行截图，论文与答辩直接取用，不进前端包体 | 只增不改 |
| `design-system/` | `ui-ux-pro-max` 生成的设计系统（MASTER.md + tokens.css/json） | 参考，不直接引 |
| `.codex/skills/` | 六个项目级 Skill 镜像（设计准则、打磨、质量门禁等），见第三节 | 整目录替换式更新 |

---

## 一、环境要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 20.19（建议 20 LTS 或 22 LTS）** | Vite 7 最低要求；`node -v` 自检 |
| 包管理器 | **pnpm ≥ 9** 或 **npm ≥ 10** | 仓库同时提供 `package-lock.json`，npm 可直接用 |
| 后端 | Python 3.10+，FastAPI + Uvicorn | 默认监听 `http://127.0.0.1:8000` |
| 数据库 | MySQL 8.0+ | 由后端连接，前端不直连 |
| 浏览器 | Chrome / Edge 最新版 | 人脸签到依赖 `getUserMedia`，需 `https` 或 `localhost` |

> 摄像头注意：`navigator.mediaDevices` 只在 **HTTPS** 或 **localhost** 下可用。用 IP（如 `http://192.168.1.10:5173`）访问时浏览器会拒绝授权，需配置 HTTPS 或用 `localhost` 调试。

---

## 二、快速启动

### 1. 安装依赖

```bash
cd frontend
pnpm install        # 或：npm install
```

### 2. 配置环境变量

前端环境变量位于 `frontend/` 下，已在仓库中提供默认值：

| 文件 | 用途 |
| --- | --- |
| `.env.development` | 本地开发（`vite dev` 自动读取） |
| `.env.production` | 生产构建（`vite build` 自动读取） |

```ini
# 站点标题
VITE_APP_TITLE=烹饪AI过程评价系统

# 接口前缀：/api 会走 Vite devServer 代理到 FastAPI；也可直接写完整地址
VITE_API_BASE_URL=/api

# true = 前端 Mock（无需后端即可完整演示）；false = 调用真实接口
VITE_USE_MOCK=true
```

- **指向 FastAPI**：开发环境保持 `VITE_API_BASE_URL=/api`，由 `vite.config.ts` 的 `server.proxy` 转发到 `http://127.0.0.1:8000`，可规避跨域；若后端在别的机器/端口，改 `vite.config.ts` 里的 `target` 即可。
- **前后端不同域部署**：把 `VITE_API_BASE_URL` 写成完整地址（如 `https://api.example.com/api`），并在后端 `CORSMiddleware` 中放行前端域名。

### 3. 启动开发服务器

```bash
pnpm dev            # 或 npm run dev
# 打开 http://localhost:5173
```

### 4. Mock 模式与真实后端切换

| 场景 | 操作 |
| --- | --- |
| 后端未就绪，先看效果 | `VITE_USE_MOCK=true`（默认），全部接口由 `src/mock/` 返回，人脸签到走 `mockCheckin()` 模拟 1.2s 后成功 |
| 联调真实接口 | 把 `.env.development` 改成 `VITE_USE_MOCK=false`，重启 `pnpm dev` |
| 上线 | `.env.production` 中 `VITE_USE_MOCK=false`，`VITE_API_BASE_URL` 按部署方式填写 |

**演示账号（Mock 模式，密码均为 `123456`）**

| 账号 | 角色 | 可访问 |
| --- | --- | --- |
| `admin` | 系统管理员 | 全部页面（含用户管理、通知发布）；**无**浮空助手、**无**智能 AI 老师 |
| `teacher_chen` | 任课教师 | 工作台 / 评价总览 / 课程管理 / 六个评价模块（可在左上角选人复核）/ 智能 AI 老师 |
| `2023010101` | 学生 | 工作台 / 人脸签到 / 五个评价模块（只看自己）/ 智能 AI 老师；用户管理与通知发布被路由守卫拦截 |

> 教师端的评价模块是**评别人**：左上角选一个在评学生，画面区显示该生的工位录像替代画面，
> 判定结果、扣分、归档都记在这个学生名下。学生端同一页面才开自己的摄像头。

### 5. 类型检查与构建

```bash
pnpm type-check     # vue-tsc --noEmit，提交前必跑
pnpm build          # type-check + vite build，产物在 frontend/dist
pnpm preview        # 本地预览构建产物（http://localhost:4173）
```

---

## 三、Skill 集成说明（`.codex/skills/`）

项目根目录下的 `.codex/skills/` 是 **Codex 项目级 Skill 的标准加载路径**，Codex 启动时会自动从这里加载 Skill，无需额外配置。
六个 Skill 均为**完整目录镜像**（含 `SKILL.md` 及全部子目录、脚本、资源），不是单文件复制。

> **`.codex/` 不进版本库。** 这六个镜像合计约 57MB、2200+ 个文件，绝大部分是上游的字体、图库与图标库数据，体积是本项目源码的十倍以上，且与上游仓库完全重复。
> 克隆本仓库后不存在这一目录是正常的，按本节末尾「如何更新 Skill」的方式一或二重装/复制即可；本项目的设计规则已固化进 `variables.scss` 与各处注释，不装 Skill 也能正常开发与构建。

| Skill | 用途 | 来源仓库 | 目录 |
| --- | --- | --- | --- |
| `design-taste-frontend` | **官网与企业级页面的设计准则**：反模板化（anti-slop）、一屏一节、真实照片、文案纪律、禁用滚动淡入与紫色系，附浏览器端检查脚本 | <https://github.com/Leonxlnx/taste-skill>（`--skill design-taste-frontend`） | `.codex/skills/design-taste-frontend/`（含 `references/` `assets/` `scripts/` `library/`） |
| `impeccable` | 单个界面的打磨动作：排版、留白、层级、可访问性、动效的具体改法，适合「这页感觉不对」时逐项对照 | <https://github.com/pbakaus/impeccable> | `.codex/skills/impeccable/`（含 `reference/` `scripts/`） |
| `hallmark` | 界面识别度与「避免一眼 AI」的质量门禁，与 impeccable 互补 | <https://github.com/nutlope/hallmark> | `.codex/skills/hallmark/`（含 `agents/` `references/` `scripts/`） |
| `skill-creator` | 沉淀与迭代团队自有 Skill：写 SKILL.md、跑评测、打包发布。后续把「烹饪评价指标」「评分话术」等沉淀成 Skill 时用它 | <https://github.com/anthropics/skills/tree/main/skills/skill-creator> | `.codex/skills/skill-creator/`（含 `agents/` `references/` `scripts/` `assets/` `eval-viewer/`） |
| `ui-ux-pro-max` | 设计决策参考：产品风格、配色、字体、间距、图表、可访问性规则的本地可检索数据库。后台的 token 出自这里 | <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> | `.codex/skills/ui-ux-pro-max/`（含 `data/` `scripts/` `references/` 与上游 `cli/`） |
| `vibe-research` | 开发前的需求验证：把「要做什么」结构化成可验证的产品假设，避免做完才发现方向错 | <https://github.com/KhazP/vibe-coding-prompt-template>（取 `.claude/skills/vibe-research`） | `.codex/skills/vibe-research/`（核心为 `SKILL.md`） |

> 三个新 Skill 用 `npx skills add` 安装时遇到过 GitHub 克隆中断（`schannel: server closed abruptly`），
> 改为下载 `codeload.github.com` 的 tarball 解压后复制，效果一致。

### 三个设计 Skill 的分工

- **改官网、落地页、注册页** → 先读 `design-taste-frontend/SKILL.md`，再按需读 `references/` 下的
  `copy.md`（文案纪律）、`layout-v4.md`（一屏一节与栅格）、`system.md`（令牌与按钮）。
- **改后台某个具体页面** → 用 `impeccable/reference/` 里的 `polish.md`、`typeset.md`、`layout.md` 逐项对照。
- **交付前自查** → `hallmark` 与 `design-taste-frontend/scripts/checker` 的思路一致：截图逐屏比对。

本项目从这三份 Skill 里落地的硬规则（已写进代码注释与 `variables.scss`）：

1. 一个强调色，界面 90% 以上保持中性；
2. 不做滚动淡入、不做视差、不做 scroll-jacking；
3. 每个 section 一屏或两屏，标题顶对齐，不垂直居中；
4. 标题含名词、按钮是「动词 + 对象」、不用「了解更多」；
5. 不编造客户评价、合作院校、使用人数——没有事实就不写；
6. 不用紫色系，不用渐变按钮，不用彩色图标底板。

### 如何更新 Skill

老师侧上游仓库更新后，任选一种方式：

```bash
# 方式一：直接替换目录（最稳妥，不动项目其它文件）
git clone --depth 1 <上游仓库地址> /tmp/upstream
rm -rf .codex/skills/ui-ux-pro-max
cp -R /tmp/upstream/.claude/skills/ui-ux-pro-max .codex/skills/ui-ux-pro-max
cp -R /tmp/upstream/cli .codex/skills/ui-ux-pro-max/cli

# 方式二：保留原始克隆并 git pull 后重新复制，便于比对 diff
cd /tmp/upstream && git pull
cp -R /tmp/upstream/.claude/skills/ui-ux-pro-max <项目>/.codex/skills/ui-ux-pro-max

# 方式三：用 skills CLI 重装（网络稳定时最省事）
npx skills add pbakaus/impeccable
npx skills add nutlope/hallmark
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

> 约定：更新后确认目录内仍有 `SKILL.md`（Codex 以它作为 Skill 入口），并提交一次 commit 便于回溯。

### 本项目的设计系统可复现

已执行 `ui-ux-pro-max` 的设计系统生成能力，产物已入库：

```bash
python .codex/skills/ui-ux-pro-max/scripts/search.py \
  "enterprise school management SaaS dashboard light" \
  --design-system --density 8 --persist --tokens css \
  -p "Culinary AI Process Evaluation" --output-dir .
```

- `design-system/culinary-ai-process-evaluation/MASTER.md`：设计系统主文件（配色 / 字体 / 间距 / 反模式）
- `design-system/culinary-ai-process-evaluation/tokens.css` / `tokens.json`：机器可读 token
- 前端落地文件：`frontend/src/assets/styles/variables.scss`（SCSS 变量）+ `element-override.scss`（Element Plus 变量覆盖）

---

## 四、设计规范（前端唯一事实来源）

所有页面共用一套令牌，定义在 `frontend/src/assets/styles/variables.scss`，**禁止在页面里硬编码颜色与间距**。

### 4.1 五条视觉纪律

这套系统刻意区别于「生成式模板风」，判断标准写在 `variables.scss` 的头部注释里，改样式前请先读：

1. **一个强调色。** 全站彩色只用于状态语义（成功/警告/危险）的小面积元素，**不用彩色区分卡片类别**。层次靠字号、字重、间距、边框深浅建立。
2. **中性灰必须是真中性灰**（R≈G≈B）。偏蓝的灰会让整页发"塑料蓝"。
3. **禁止装饰性色彩条**：卡片顶部 3px 彩条、彩色图标底板、胶囊标签堆叠，一律不做。
4. **三档阴影**，卡片默认 1px 边框 + 几乎不可见的投影，悬浮才抬起一档。
5. **动效统一取值**：进场用 `$ease-emphasized`（快起慢收），状态切换用 `$ease-standard`（对称）；位移不超过 8px。

### 4.2 令牌取值

> 与 `design-system/.../MASTER.md` 的关系：间距、字号阶梯、控件尺寸沿用生成结果；**色彩与圆角做了收敛**——主色从 `#2563EB` 降饱和为 `#2F54EB`，中性色由偏蓝灰改为纯中性灰，卡片圆角 12px → 10px，并移除了生成建议里的彩色图标底板与顶部色条。原因见 4.1 第 1、3 条：那两类装饰是「模板/生成式界面」最明显的视觉特征，与企业级后台的克制取向冲突。

| 类别 | 取值 | 落点 |
| --- | --- | --- |
| 主色 | `#2F54EB`（沉稳靛蓝，仅用于主按钮/链接/焦点/当前菜单项） | `--el-color-primary` 及 light-3/5/7/8/9 |
| 语义色 | 成功 `#15803D` / 警告 `#B45309` / 危险 `#B91C1C`（均为深色，保证白底可读） | 状态点、趋势、错误提示 |
| 页面底色 | `#F7F7F8` | `.layout__main` |
| 文本 | 主 `#18181B` / 常规 `#3F3F46` / 次要 `#71717A` / 占位 `#A1A1AA` | 全局 |
| 边框 | 卡片与外框 `#F0F0F2`，控件 `#E4E4E7`，悬浮 `#D4D4D8` | 全局 |
| 圆角 | 控件 8px / 卡片 10px / 弹窗 14px / 小元素 4–6px | 全局 |
| 阴影 | 卡片 `0 1px 2px rgba(24,24,27,.04)`，悬浮 `0 4px 12px -2px rgba(24,24,27,.08)`，弹层 `0 12px 32px -8px rgba(24,24,27,.16)` | 全局 |
| 间距 | 4px 基准：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 | 全局 |
| 字号阶梯 | 12 / 13 / 14 / 16 / 20 / 26 / 32 / 40 | 全局 |
| 控件尺寸 | 按钮与表单高度 **36px**，表格行高 **52px**，表头 **40px**，卡片内边距 **20–24px** | `element-override.scss` |
| 布局 | 侧栏 220px / 折叠 64px，顶栏 56px，内容区最大 1400px | `DefaultLayout.vue` |

字体：`-apple-system / Segoe UI / PingFang SC / Microsoft YaHei`，**只声明系统可用字体**（不写未加载的 Web Font——声明了却不加载，是"模板感"的细节来源之一）。数字统一 `font-variant-numeric: tabular-nums`，避免统计值与表格数字随内容跳动。

### 4.3 动效层（`assets/styles/motion.scss`）

| 能力 | 用法 | 说明 |
| --- | --- | --- |
| 列表顺序进场 | 容器加 `v-stagger`，子元素加 `class="animate-in"` | 指令写入 `--i` 序号，间隔默认 34ms，形成阅读顺序 |
| 骨架屏 | `<AppSkeleton variant="stats \| table \| list" />` | 与真实内容等高，数据到达零跳动 |
| 数字滚动 | `useCountUp(ref)` | rAF + easeOutExpo，尊重 `prefers-reduced-motion` |
| 进度条 | `.meter > .meter__fill`（`--value` 变量） | 自绘，避免 el-progress 的彩色默认值 |
| 状态点 | `.status-dot` + `--success/--warning/--danger/--live` | 替代彩色标签，压缩彩色面积 |

加载策略：**首次加载用骨架，二次刷新保留旧数据**（`initialized` 标记），避免点"刷新"时整块内容被替换成灰条再长回来。

---

## 五、目录结构与新增模块规则

```text
frontend/
├── index.html
├── vite.config.ts            # @ 别名、/api 代理（SSE 关闭压缩）、chunk 拆分
├── tsconfig*.json
├── .env.development / .env.production
└── src/
    ├── api/                  # 按模块拆：auth chat face user course notice common
    ├── assets/styles/        # variables.scss（令牌）/ site.scss（官网共用类）/ base.scss / motion.scss / element-override.scss / index.scss
    ├── components/           # 全局组件：AppSidebar AppTopbar AppLogo PageHeader DataTable StatCard AppSkeleton
    │                         #   ApiPanel（后端接入面板）ApiDrawer（面板的抽屉版）ModuleShell（模块页骨架）
    │                         #   StudentPicker（模块页左上角的「在评学生」选择器，仅教师/管理员渲染）
    │                         #   ReviewStage（该生工位录像替代画面，教师端用来取代自己的摄像头）
    │                         #   AssistantBall（浮空助手）TeacherReview（模块内人工判定/扣分）
    │                         #   FaceCaptureDialog（补录人脸：摄像头 + 上传兜底）
    ├── composables/          # useSSE（流式请求）useCamera（摄像头）useCountUp（数字滚动）
    │                         #   useRole（角色与能力判断，读 config/permissions.ts，唯一的权限入口）
    ├── config/               # permissions.ts：角色 × 能力 / 角色定位文案 / 七模块权限矩阵（唯一事实来源）
    ├── directives/           # v-stagger：列表顺序进场（写入 --i 序号）
    ├── layouts/              # SiteLayout（官网）DefaultLayout（后台主框架）AuthLayout（登录/注册分栏外壳）
    ├── mock/                 # Mock 数据中枢（VITE_USE_MOCK=true 时生效）
    │                         #   students.ts（学生花名册，被选人器、复核、综合评价三处共用一份）
    │                         #   teacher.ts（智能 AI 老师的 Mock 回答，带附件分支）
    │                         #   courses.ts / notices.ts 单独成文件
    ├── router/               # index.ts 路由表 / guard.ts 守卫（按 meta.roles 拦越权）/ menu.ts 侧栏菜单（按 roles 过滤）
    ├── stores/               # Pinia：auth app chat face review（+ index.ts 实例）
    │                         #   review.ts 里的 activeStudentId 是全模块共享的——一节课跟着人走，不跟着页面走
    ├── types/                # 全局类型：api user chat face dashboard course notice table
    ├── utils/                # request(axios) sse(fetch 流) faceCapture markdown format token env
    │                         #   assistant.ts（浮空助手知识库：按学生/教师分库）
    ├── views/                # 页面级组件，按功能域分目录
    │   ├── site/             # 官网首页：index.vue + data.ts（文案与接口清单）+ sections/ 九个区块
    │   │                     #   Hero / Modules / Roles（角色分工）/ Flow / Product / Api / Scenes / Faq / Cta
    │   ├── register/         # 申请开通：三步表单 + 人脸照片采集
    │   ├── dashboard/        # 工作台：一个路由三套内容（学生 / 教师 / 管理员）
    │   ├── ai-eval/          # 评价总览（角色 × 七模块权限矩阵）
    │   ├── courses/          # 课程管理：index.vue（列表/上传）+ detail.vue（菜谱 + AI 解读）
    │   ├── chat/             # index.vue（智能 AI 老师）+ components/ChatMessage.vue、SessionDrawer.vue
    │   ├── face-checkin/     # 模块 1：人脸识别签到
    │   ├── modules/          # 模块 2-6，每个目录一个独立页面
    │   │   ├── uniform/      #   着装规范识别
    │   │   ├── ingredient/   #   食材预处理评价
    │   │   ├── cooking/      #   烹饪过程评价
    │   │   ├── dish/         #   菜肴成品分析
    │   │   └── summary/      #   AI 综合评价（学生版只显示本人）
    │   ├── login/
    │   ├── system/
    │   │   ├── user/         # 用户管理 + 学生档案抽屉（人脸照片核验 / 补录）
    │   │   └── notice/       # 通知发布：公告 / 功能更新 / 维护通知
    │   └── error/404.vue
    ├── App.vue
    └── main.ts
```

**新增一个业务模块（例如「着装规范识别」）的固定动作：**

1. `src/types/uniform.ts` 写接口出入参类型，并在 `src/types/index.ts` 导出；
2. `src/api/uniform.ts` 写接口函数（遵守 `{ code, data, message }` 拆包约定，Mock 分支写在同文件）；
3. `src/stores/uniform.ts` 只放该域的状态与动作（可选）；
4. `src/views/modules/uniform/index.vue` 页面，**套 `ModuleShell`**，把接口写进 `endpoints` 传给右侧接入面板；
   若该页主区没有右列空间（像人脸签到、智能 AI 老师那样），改用 `ApiDrawer`，从页头「接口」按钮打开，`endpoints` 写法完全一样；
5. `src/router/index.ts` 加子路由（`meta.title` 必填，用于面包屑与 `document.title`），`src/router/menu.ts` 加菜单项；
6. 需要全局复用才放 `src/components/`，页面私有组件放 `views/<模块>/components/`。

> 一句话规则：**接口进 `api/`，类型进 `types/`，状态进 `stores/`，页面进 `views/`，能复用的才进 `components/`。**

---

## 六、前后端联调约定

### 1. 统一响应格式

```json
{ "code": 0, "data": {}, "message": "ok" }
```

- `code` 为 `0` 或 `200` 视为成功，其余走失败分支（`message` 会直接弹给用户）；
- `src/utils/request.ts` 会自动拆包，业务代码只拿到 `data`；
- 分页统一：`{ "list": [], "total": 0, "page": 1, "pageSize": 10 }`；
- 鉴权：请求头 `Authorization: Bearer <token>`，`401` 自动清理本地 token 并跳登录。

### 2. 智能 AI 老师（SSE + 附件）

```http
POST /api/v1/chat
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer <token>

{
  "message": "这块挂糊是不是太厚了？",
  "session_id": "s_1",
  "stream": true,
  "file_ids": ["f_8a12", "f_8a13"]
}
```

`file_ids` 可选：学生先调 `POST /api/v1/files` 上传成品图/菜谱 PDF，拿到 id 再随问题一起发。
只传附件不写字也允许（`message` 可为空串），前端不会拦。

```http
POST /api/v1/files
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <图片或 PDF，单文件 ≤20MB，一次最多 4 个>
```

```json
{ "code": 0, "data": { "id": "f_8a12", "name": "糖醋里脊.jpg", "size": 1843200,
                       "mime": "image/jpeg", "url": "/files/f_8a12.jpg" }, "message": "ok" }
```

响应必须为 `text/event-stream`，每帧二选一即可（前端两种都兼容）：

```
data: {"content": "挂糊"}

data: 挂糊

data: [DONE]
```

要点：**不要用 `EventSource`**（只支持 GET、无法带鉴权头与请求体），前端用 `fetch` + `ReadableStream` 解析，实现见 `src/utils/sse.ts` 与 `src/composables/useSSE.ts`。

> 回答口径：AI 老师**只讲怎么做，不给分**。分数只由五个评价模块产生，提问涉及评分标准时回答会把学生引回模块页，
> 避免同一份作品出现两套口径（`docs/项目完整指南.md` 第 10 章给了完整的三段式系统提示词）。

### 3. 人脸签到

```http
POST /api/face/checkin
Content-Type: multipart/form-data
Authorization: Bearer <token>

file:    <JPEG 二进制，前端每 1.5s 截一帧，canvas.toBlob('image/jpeg', 0.85)>
user_id: 可选，指定比对目标时传
```

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "user": { "id": 1001, "name": "陈子豪", "studentNo": "2023010101", "className": "烹饪工艺与营养 2301" },
    "timestamp": "2026-11-20T08:12:31",
    "similarity": 0.964
  }
}
```

失败时 `success=false`，`message` 建议使用以下枚举值，前端已映射为中文提示：

| message | 前端提示 |
| --- | --- |
| `no_face` | 未检测到人脸，请正对摄像头 |
| `low_light` | 光线不足，请调整位置 |
| `multi_face` | 画面中存在多张人脸，请单人签到 |
| `low_similarity` | 人脸不匹配，请重试或联系管理员 |

### 4. 注册（含人脸底库照片）

```http
POST /v1/auth/register
Content-Type: application/json
```

```json
{
  "name": "陈子豪",
  "username": "2023010101",
  "password": "******",
  "role": "student",
  "phone": "13800001111",
  "department": "烹饪工艺与营养 2301",
  "studentNo": "2023010101",
  "facePhoto": "data:image/jpeg;base64,..."
}
```

- `facePhoto` 为 `dataURL` 字符串（前端已压缩到 480px 宽、JPEG 0.82，单张约 40–60KB）；
- 后端落库时建议直接把 `facePhoto` 存为 `TEXT`/`LONGTEXT`，或转存对象存储后只回存 URL —— 只要 `GET /v1/users` 返回的 `facePhoto` 字段能渲染成图片即可，前端不关心是 base64 还是 URL；
- 返回 `{ "id": 1001, "username": "2023010101", "needApproval": true }`，`needApproval=true` 时前端提示「待管理员审核」，不自动登录。

### 5. 七大模块接口

七个模块的完整契约直接写在各自页面的接入面板里（`ApiPanel`；人脸签到与智能 AI 老师在页头「接口」抽屉里），后端同学打开页面复制即可。汇总：

| 模块 | 接口 | 说明 |
| --- | --- | --- |
| 人脸签到 | `POST /api/face/checkin` | 见第 3 节，`multipart/form-data` |
| 人脸签到 | `GET /api/face/records?limit` | 最近签到流水，`status` 为 success / failed |
| 着装规范 | `POST /api/modules/uniform/analyze` | 入参 `{ image, user_id }`，返回 5 项判定 + 总分 + 建议 |
| 着装规范 | `GET /api/modules/uniform/records?user_id&limit` | 近期复检记录 |
| 食材切配 | `POST /api/modules/ingredient/analyze` | 返回 `cuts_per_min`、`uniformity`、`grade` |
| 食材切配 | `GET /api/modules/ingredient/frame` | 单帧取样（前端 1.5s 轮询） |
| 烹饪过程 | `WS /ws/cooking` | 服务端推 `{ step, progress, confidence }`，断线由前端指数退避重连 |
| 烹饪过程 | `GET /api/modules/cooking/segments?session_id` | 6 步时序分段 + 每步时长判定 |
| 成品评分 | `POST /api/modules/dish/analyze` | 返回 5 维分数 + 总分 + 评语 |
| 成品评分 | `GET /api/modules/dish/rubric` | 评分细则（维度权重可配置） |
| 综合评价 | `GET /api/modules/summary/report?student_id` | 五环节明细 + 加权总分 |
| 综合评价 | `GET /api/modules/summary/class?class_id` | 班级名单 + 排序 |
| 智能 AI 老师 | `POST /api/v1/chat`（SSE，带 `file_ids`） | 帧格式见第 2 节 |
| 智能 AI 老师 | `POST /api/v1/files` | 成品图 / 菜谱 PDF 上传，返回 `file_id` |
| 各模块通用 | `GET /api/v1/students?class_id` | 教师端左上角选人器的名单来源（`mock/students.ts` 的线上版） |

> 注意：模块接口统一挂在 `/api/modules/` 下（不是 `/api/ai/`），这是本次重写的路径约定，与面板里展示的完全一致。若后端沿用 `/api/ai/*`，改 `frontend/src/api/` 对应文件里的常量即可，页面无需改动。

### 6. 其它接口清单

| 模块 | 接口 | 当前状态 |
| --- | --- | --- |
| 登录 | `POST /v1/auth/login`、`GET /v1/auth/profile`、`POST /v1/auth/logout` | Mock 中，可直接替换 |
| 注册 | `POST /v1/auth/register` | Mock 中（会校验用户名重复） |
| 用户管理 | `GET/POST /v1/users`、`PUT/DELETE /v1/users/{id}` | Mock 中，`facePhoto` 字段已打通到学生档案抽屉 |
| 补录人脸 | `PUT /v1/users/{id}/face` | Mock 中；入参 `{ facePhoto }`（dataURL），见 6.2 |
| 工作台（教师/管理员） | `GET /v1/dashboard/overview` | Mock 中 |
| 工作台（学生） | `GET /v1/dashboard/me` | Mock 中，见 6.1 |
| 课程管理 | `GET/POST /v1/courses`、`GET /v1/courses/{id}` | Mock 中，见 6.3 |
| 菜谱 AI 解读 | `POST /v1/courses/{id}/analysis` | Mock 中，返回难点/易错点 + 步骤标注，见 6.3 |
| 通知发布 | `GET/POST /v1/notices`、`PUT/DELETE /v1/notices/{id}` | Mock 中，见 6.4 |
| 问答会话 | `GET /v1/chat/sessions`、`DELETE /v1/chat/sessions/{id}` | Mock 中，页面已预留抽屉 |
| 附件上传 | `POST /api/v1/files` | **待对接**；入参 `multipart/form-data`，返回 `file_id` |
| 学生名单 | `GET /api/v1/students?class_id` | **待对接**；教师端选人器用，Mock 走 `src/mock/students.ts` |
| 智能 AI 老师 | `POST /api/v1/chat`（SSE） | **待对接** |
| 七大模块 | 见第 5 节表格 | **待对接**（每页右侧面板已列全入参出参） |

#### 6.1 学生工作台 `GET /v1/dashboard/me`

学生看不到 `overview` 里的班级维度数据，所以单独一个接口，字段是「我自己的」：

```json
{
  "code": 0,
  "data": {
    "studentName": "陈子豪", "studentNo": "2023010101", "className": "烹饪工艺与营养 2301",
    "course": { "id": 1, "title": "《中式热菜制作》—— 糖醋里脊", "dishes": ["糖醋里脊"],
                "lessonAt": "2026-11-20 08:00", "goal": "掌握挂糊厚度与两遍复炸的火候控制", "published": true },
    "stats": [{ "key": "score", "label": "上次实训得分", "value": 88, "unit": "分", "icon": "DataAnalysis", "tone": "primary" }],
    "stages": [{ "key": "cooking", "label": "烹饪过程", "score": 86, "weight": 0.3, "state": "running" }],
    "todos": [{ "id": "todo_2", "title": "上传成品照片", "hint": "出锅后 5 分钟内拍摄", "to": "/modules/dish", "done": false }],
    "activities": [{ "id": "my_1", "type": "checkin", "title": "人脸签到通过", "description": "相似度 96.4%", "time": "2026-11-20 08:12", "actor": "我" }]
  }
}
```

`stages[].state` 取 `done | running | pending`；`pending` 时前端不参与加权求和（避免「成品没交就有总分」）。

#### 6.2 补录人脸 `PUT /v1/users/{id}/face`

```json
{ "facePhoto": "data:image/jpeg;base64,..." }
```

单独一个接口而不是复用 `PUT /v1/users/{id}`：改资料与动底库的审计口径不同，照片要额外留采集人、采集时间。返回 `{ "code": 0, "data": null }` 即可，前端会用同一份 dataURL 直接刷新列表与抽屉。

#### 6.3 课程管理 `/v1/courses`

| 接口 | 说明 |
| --- | --- |
| `GET /v1/courses?class_id&teacher_id` | 课程列表，含 `fileName` / `fileSize` / `receiverCount` / `studentCount` |
| `POST /v1/courses` | 上传课程：先 `multipart/form-data` 传 PDF（≤20MB），拿到 `fileUrl` 后再提交元信息 |
| `GET /v1/courses/{id}` | 课程详情，返回结构化菜谱 `recipe`（配料 + 步骤）与 `analysis`（已生成时为对象，未生成为 `null`） |
| `POST /v1/courses/{id}/analysis` | 生成菜谱解读，返回 `insights[]`：`kind` 取 `difficulty / pitfall`，`step` 指向步骤序号 |

`insights[].advice` 是给教师看处理建议、给学生的落地提示；前端把它挂在对应步骤右侧，所以 `step` 必须与 `recipe.steps[].index` 对齐，否则标注会落到错行。

#### 6.4 通知发布 `/v1/notices`

| 接口 | 说明 |
| --- | --- |
| `GET /v1/notices?status&type` | 列表，含 `readCount` / `totalCount` / `pinned` |
| `POST /v1/notices` | 新建（草稿或直接发布） |
| `PUT /v1/notices/{id}` | 编辑、发布、撤回（`status` 取 `draft/published/withdrawn`） |
| `DELETE /v1/notices/{id}` | 删除 |

`type` 取 `system / feature / maintenance`；`audience` 为 `'all'` 或角色数组，前端按此渲染「全站用户 / 教师 · 管理员」。

---

## 七、构建与部署

```bash
cd frontend
pnpm build          # 产物：frontend/dist（静态文件 index.html + assets）
```

**Nginx 托管示例**（注意 SSE 必须关闭缓冲，否则打字机效果会变成「一次性吐出」）：

```nginx
server {
    listen 80;
    server_name culinary.example.com;

    root /var/www/culinary-ai/dist;
    index index.html;

    # SPA history 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # FastAPI 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # ---- SSE 关键配置 ----
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        # 通知上游不要缓冲（Starlette 会读这个头）
        proxy_set_header X-Accel-Buffering no;
    }
}
```

若 Nginx 开启了全局 `gzip on;`，请对 SSE 关闭：`gzip_types` 不要包含 `text/event-stream`，或在 `location /api/` 内加 `gzip off;`。

> 体积优化：当前 Element Plus 为全量引入（构建后 `element` chunk 约 1.0MB / gzip 339KB），首版优先保证「装得上、跑得起来」。
> 需要压缩首屏时，改用 `unplugin-vue-components` + `ElementPlusResolver` 按需引入即可，业务代码零改动。

**部署检查清单**

- [ ] `.env.production` 中 `VITE_USE_MOCK=false`
- [ ] 后端 `CORSMiddleware` 放行前端域名（跨域部署时）
- [ ] 站点启用 HTTPS（否则摄像头无法授权）
- [ ] Nginx 对 `/api/` 关闭缓冲与 gzip
- [ ] 反向代理超时 > 模型最长回答时间（建议 ≥ 300s）

---

## 八、已实现页面与演示路径

### 1. 公开站点（无需登录）

| 页面 | 路由 | 亮点 |
| --- | --- | --- |
| 官网首页 | `/` | 独立 `SiteLayout`：72px 定宽导航（滚动时高亮当前分区，不做阴影/收缩）+ **9 个整屏分区**（首屏 / 七大模块 / 角色分工 / 课程流程 / 产品实拍 / 接口对接 / 应用场景 / 常见问题 / 结尾 CTA）。首屏左侧一句话定位 + 两个按钮 + 三个硬数据（7 模块 / 6 步骤 / 4 路视频），右侧是**七张实训现场实拍的自动轮播**（每 5s 交叉淡入，按一节课的时间顺序排：实训室全景 → 系围裙 → 教师看操作 → 切丝 → 翻炒 → 摆盘 → 端盘等评价），下方一条细线段表示第几张。鼠标悬停/聚焦即暂停，系统开了「减少动态效果」则不自动播 |
| 注册 | `/register` | 三步式：账号与身份（学生/教师角色卡片）→ 人脸照片（摄像头实拍 + 上传兜底 + 四角取景框，压缩到 480px JPEG）→ 提交审核。照片随注册一起入库，是后续人脸签到的底库 |

### 2. 三个角色：同一套系统，三条工作流

角色不是「功能开关」，是三种不同的日常。权限的唯一事实来源是 `src/config/permissions.ts`，侧栏、路由 `meta.roles`、页面内操作三处都读它，不在组件里各写一份 `if (role === 'teacher')`。

| 能力点 | 学生 | 教师 | 管理员 |
| --- | --- | --- | --- |
| 工作台 | 只看自己的（`/v1/dashboard/me`） | 班级签到率 + 模块进度 + 动态 | 再加账号构成与待处理 |
| 评价总览 | 不可见 | 可见 | 可见 |
| 模块内人工判定 / 扣分 | 只能自己操作 | 可扣分并留痕（`TeacherReview`） | 只看统计 |
| 班级名单与他人成绩 | **不可见**（页面明示边界） | 可见、可复核、可归档、可导出 | 可见 |
| 课程与菜谱 | 只读，可让 AI 讲难点 | 上传 PDF、布置实训 | 只读 |
| 用户管理 | — | — | 全量（学生 + 教师 + 管理员） |
| 通知发布 | — | — | 全量 |
| 浮空助手 | 有（学习助手） | 有（教学助手） | **无**（不渲染） |

落地方式：`config/permissions.ts` 定义能力点 → `composables/useRole()` 暴露 `isStudent / isTeacher / isAdmin / can(capability)` → `router/guard.ts` 拦越权访问（学生直接输 `/system/user` 会被弹回工作台）→ `AppSidebar` 按 `roles` 过滤并自动隐藏空分组（学生的「系统」整组不出现）。

这套分工在官网也讲了一遍（`sections/SiteRoles.vue`）：三列不用卡片，只用 1px 竖线分隔，每列除了「能做什么」还写明**「不能做什么」**——
学生看不到班级排名、教师不改模型分数、管理员不参与评分。边界写清楚，访客才信这套权限是真的做过的，而不是三张宣传卡。

### 3. 登录与控制台

| 页面 | 路由 | 亮点 |
| --- | --- | --- |
| 登录 | `/login` | 左右分栏：左侧实训现场实拍（压暗 + 去饱和，保证标题对比度）+ 三条能力点，右侧表单。表单校验、演示账号一键填充（学生 / 教师 / 管理员）、接口模式提示 |
| 工作台 | `/dashboard` | **一个路由三套内容**：学生看到「我的实训」（本节课 + 我的五环节得分 + 待办 + 只有自己的动态）；教师看到班级签到率、模块进度、近期动态；管理员在教师版之上多一张「账号构成」与管理员专属统计（教师账号 / 未录入人脸 / 停用账号） |
| 评价总览 | `/ai-eval` | **角色 × 模块权限矩阵**：上方三张角色卡（点一下切换视角），下方七行矩阵逐格给出「本人操作 / 复核扣分 / 全站管理 / 不参与」与职责说明，行末直接进入模块；当前登录角色标「当前登录」，非当前视角两列压暗 |
| 课程管理 | `/courses` | 教师：上传菜谱（PDF ≤20MB、指定班级与实训目标）、发布、已收录进度、删除；同一班级同一天只允许一节课 |
| 课程详情 | `/courses/:id` | 左：结构化菜谱（配料表 + 带关键控制点的操作步骤）；右：**AI 菜谱解读**——点「让 AI 读一遍」把难点（`difficulty`）与易错点（`pitfall`）标注到对应步骤上。学生看到的是标注结果，教师看到的是生成入口 |
| 人脸签到 | `/face-checkin` | 摄像头预览、Canvas 虚线圆角引导框 + 扫描线、1.5s 截帧比对、成功动效 + 通知、失败人性化提示、最近记录 |
| 智能 AI 老师 | `/chat` | 860px 居中窄栏、SSE 打字机 + 光标、Markdown 渲染（DOMPurify 消毒）、复制/重新生成、会话抽屉。**学生端是「智能 AI 老师」**：空态给三张入口卡（拍成品图 / 上传菜谱 PDF / 直接问工艺问题），支持拖拽、粘贴、选择文件三种方式加附件（图片与 PDF，单文件 ≤20MB、一次 ≤4 个），气泡内以缩略图/文件条展示；教师端同一页面叫「课程 AI 助教」，入口卡换成备课与扣分口径。管理员不开放此页（`meta.roles` 里没有 admin） |
| 用户管理 | `/system/user` | 搜索筛选 + 分页 + 表格（52px 行高）+ 新增/编辑弹窗 + 状态切换 + 删除确认；行内「补录照片」与档案抽屉里的「更换 / 补录人脸照片」都打开 `FaceCaptureDialog`（摄像头 + 上传兜底，压到 480px JPEG 后 `PUT /v1/users/{id}/face`）。管理员账号不参与签到，抽屉里直接不摆照片框 |
| 通知发布 | `/system/notice` | 已发布 / 草稿 / 置顶三态、阅读率统计、类型标签（系统公告 / 功能更新 / 维护通知）、发布对象（全站或指定角色）、编辑 / 撤回 / 删除 |

### 4. 七大模块接入页

七个模块各有一个独立页面，右边固定一块 **接口接入面板**（`ApiPanel`），把该模块的接口路径、请求体、响应体、`curl` 示例一次列全，左边是可交互的演示区。后端同学照着面板接就行，不用翻文档。

其中着装、食材、烹饪、成品、综合五页是「左操作区 + 右 340px 吸顶面板」；人脸签到与智能 AI 老师的主区已经排满（一个要留取景画面，一个是 860px 窄栏），面板改成页头「接口」按钮打开的抽屉（`ApiDrawer`），内容与右侧面板完全一致。

**教师端第一件事是选人。** 着装、食材、烹饪、成品四页顶部（`ModuleShell` 的最上方、所有其它控件之前）有一条 `StudentPicker`：
下拉筛选学生（人脸缩略图 + 姓名 + 学号后四位 + 未签到标记）、左右箭头快速上下一个、右侧给出 `已签到 x / y` 与「切人后，画面与判定结果一起切换」的提示。
选中的人存在 `stores/review.ts` 的 `activeStudentId` 里，是**全模块共享**的——一节课跟着人走，从着装切到成品不用重新选人；综合评价页例外，它自己就是一整张班级名单，再放一个选人器会让人不知道以哪个为准。

选完人之后，画面区不再是「自己的摄像头」，而是 `ReviewStage`——该生工位录像的替代画面（`/api/v1/camera/stream?student_id=` 的占位实现），
带播放/暂停、进度、签到/备菜/烹饪/装盘四个时间标记。这样教师看的是**这个学生的**操作，而不是自己对着镜头站着。
所有判定写入、扣分、归档都记在 `activeStudentId` 名下；学生端同一页面走原逻辑，开自己的摄像头。

着装、食材、烹饪、成品四页底部还挂了一块 **教师复核**（`TeacherReview`）：勾选违规项（每项带分值）→ 填一句说明 → 记一次扣分，记录随成绩一起归档。
学生看到的说明是「本环节由系统判定，如有异议联系任课教师」。

| 模块 | 路由 | 左侧演示区 | 对应接口 |
| --- | --- | --- | --- |
| 人脸签到 | `/face-checkin` | 摄像头 + 1.5s 截帧比对 | `POST /api/face/checkin`、`GET /api/face/records` |
| 着装规范 | `/modules/uniform` | 教师：在评学生录像 + 5 项判定；学生：摄像头 + 5 项判定，8s 自动复检。**未判定前显示 `—`**，不预先摆一个 100 分 | `POST /api/modules/uniform/analyze`、`GET /api/modules/uniform/records` |
| 食材切配 | `/modules/ingredient` | 切丝频率折线（SVG sparkline），1.5s 采样；教师看该生画面 | `POST /api/modules/ingredient/analyze`、`GET /api/modules/ingredient/frame` |
| 烹饪过程 | `/modules/cooking` | 4 路视频墙（ch.01 为在评学生，其余三格标「同一工位其他机位」）+ 6 步时序轨道 + 步骤判定表 | `WS /ws/cooking`、`GET /api/modules/cooking/segments` |
| 成品评分 | `/modules/dish` | 成品图预览 + 扫描线 + 5 维加权评分 + 评语；教师端上传入口上锁（不得替学生交作品），底部注明当前在评学生 | `POST /api/modules/dish/analyze`、`GET /api/modules/dish/rubric` |
| 综合评价 | `/modules/summary` | 教师：班级名单 + 右侧五环节得分条 + 归档导出；学生：只有自己那一份，页面顶部写明「班级排名与同学成绩不对学生开放」 | `GET /api/modules/summary/report`、`GET /api/modules/summary/class` |
| 智能 AI 老师 | `/chat` | 860px 窄栏流式对话 + 附件 | `POST /api/v1/chat`、`POST /api/v1/files`、`GET /api/v1/chat/sessions` |

统一由 `components/ModuleShell.vue` 承载：标题 + 状态徽标（Mock / 已对接）+ 左侧内容插槽 + 右侧吸顶面板。新增模块只需再写一个 `views/modules/xxx/index.vue` 套壳，把 `endpoints` 数组传进去。

### 5. 浮空球助手（按角色分库）

页面右下角常驻一颗 52px 深色圆球，点开是 372×552 的对话面板。定位是「系统向导」，**只做四件事**：找功能、解释规则、排查故障、汇总数据。

三个角色问的根本不是一类问题，所以知识库按角色分成两份（`src/utils/assistant.ts` 里用 `roles` 字段过滤，命中不到就走各自角色的兜底文案）：

| | 学生：学习助手 | 教师：教学助手 |
| --- | --- | --- |
| 副标题 | 菜谱 · 工艺 · 我的成绩 | 上传 · 扣分 · 归档 · 对接 |
| 能答 | 「这节课菜谱在哪」「红烧肉怎么收汁」「我的成绩在哪看」「成品照片怎么上传」「签不上怎么办」 | 「怎么上传菜谱」「扣分怎么留痕」「成绩怎么归档」「接口在哪看」「通知怎么发」 |
| 共通 | 摄像头黑屏、登录不了、有哪些模块 | 同左 |
| 明确拒答 | 「这道菜多少分」「切丝频率是多少」「着装是否合格」——属于模块识别结果，只给入口不编数值 | 同左 |

管理员整个组件不渲染（能力点 `assistant.use` 里没有 admin）。回答里给的通用工艺提示会**主动声明「具体以本节菜谱为准」**，并指向课程页的「AI 解析」——避免助手和模块给出两套口径。

**它和智能 AI 老师不是一件事**，边界写在 `utils/assistant.ts` 顶部的注释里，改的时候不要放宽：

| | 浮空助手（右下角圆球） | 智能 AI 老师（`/chat`） |
| --- | --- | --- |
| 回答什么 | **系统怎么用**：功能在哪、规则是什么、报错怎么办、数据在哪看 | **菜怎么做**：挂在哪一步、火候怎么控、这盘菜问题出在哪 |
| 能不能看附件 | 不能 | 能（成品图 / 菜谱 PDF） |
| 典型问题 | 「成绩怎么归档」「接口在哪看」 | 「这块挂糊是不是太厚了」「照这页菜谱第 4 步要注意什么」 |
| 共同底线 | 识别类的具体数值（分数、频率、是否合格）一律不给，只给模块入口 | 同左，回答末尾把评分问题引回 `AI 综合评价` |

### 6. 演示动线（约 6 分钟）

**教师线**：官网 `/` 看定位、七大模块与角色分工（导航会随滚动高亮当前分区）→ 登录 `teacher_chen` → 工作台看班级态势 → 课程管理上传 / 打开一节课 → 课程详情点「让 AI 读一遍」看难点标注 → 着装规范页**左上角选一个学生**，画面切到该生工位，做一次判定 → 食材切配页确认选人器里还是同一个人（不用重选）→ 底部教师复核扣分 → 成品分析页确认上传入口上锁 → 综合评价页归档 → 评价总览看角色矩阵 → 助手问「扣分怎么留痕」。

**学生线**：注册 `/register` 走完三步（含人脸拍照）→ 登录 `2023010101` → 工作台只有「我的实训」→ 打开本节课的菜谱看 AI 难点 → 成品分析上传自己的成品图 → 打开**智能 AI 老师**，把刚才那张成品图拖进对话框问「这盘菜的挂汁哪里不对」，再上传菜谱 PDF 问「第 4 步为什么要复炸」→ AI 综合评价只看自己那一份（顶部写明看不到同学成绩）→ 助手问「红烧肉怎么收汁」。

**管理员线**：登录 `admin` → 工作台看账号构成与未录入人脸数 → 用户管理点姓名看学生档案里注册时那张照片，或行内「补录照片」→ 通知发布新建一条 → 注意右下角**没有**浮空助手，左侧菜单也**没有**智能 AI 老师。

### 7. 图片素材清单

`frontend/src/assets/images/` 下的所有照片都是 **AI 生成的占位素材**，只用于演示版式与取景比例，正式上线请换成学校实拍。文件名即用途，替换时保持同名同比例即可：

| 文件 | 尺寸 | 用在哪 |
| --- | --- | --- |
| `kitchen-hero.jpg` | 1536×944 | 首屏轮播第 1 张、场景分区 |
| `uniform-students.jpg` | 1536×944 | 首屏第 2 张、登录页左侧 |
| `teacher-review.jpg` | 1536×960 | 首屏第 3 张 |
| `prep-cutting.jpg` | 1536×944 | 首屏第 4 张、课程流程分区 |
| `wok-frying.jpg` | 1536×960 | 首屏第 5 张 |
| `dish-plated.jpg` | 1536×944 | 首屏第 6 张、场景分区、成品分析默认图 |
| `tasting-line.jpg` | 1536×960 | 首屏第 7 张 |
| `screens/dashboard.png` | 1440×900 | 「产品实拍」分区的界面图（真实运行截图，浮空球助手临时隐藏后截的） |
| `faces/*.jpg` ×3 | 480×480 | 学生档案抽屉、在评学生选择器的演示头像 |

`docs/assets/summary.png`（综合评价页真实运行截图）不在代码里引用，放在 docs 下供论文与答辩直接取用，不占前端包体。

> 首屏曾摆过一张「评价进行中 08:36 / 着装规范 96 / 切丝均匀度 82」的悬浮卡，后来又换成工作台截图。
> 两者都不对：前者数字是编的，那堂课根本不存在；后者第一屏讲的是「后台长什么样」，而访客要先判断的是
> 「这门课真的在上」。现在改成七张现场实拍顺序播放，界面截图放回它该在的位置——往下滚一屏的「产品实拍」。


---

## 九、常见问题

**Q：页面提示「无法连接后端服务」？**
A：`VITE_USE_MOCK=false` 时需先启动 FastAPI（默认 8000 端口），或检查 `vite.config.ts` 的 proxy `target`。

**Q：点「开始识别」没反应？**
A：检查浏览器地址栏的摄像头权限；非 `localhost` / 非 HTTPS 时浏览器会直接拒绝，F12 Console 会提示 `NotAllowedError`。

**Q：SSE 在线上不流式，一次性出全文？**
A：99% 是 Nginx 缓冲导致，见第七节 `proxy_buffering off;` 与 `X-Accel-Buffering no`。

**Q：想改主色 / 圆角 / 间距？**
A：只改 `frontend/src/assets/styles/variables.scss`，Element Plus 与自定义组件会同步生效；改动前先看 `design-system/culinary-ai-process-evaluation/MASTER.md` 的约束。

**Q：为什么表格列宽、按钮高度不能单独调？**
A：统一由 `variables.scss` + `element-override.scss` 控制，逐页覆盖会让产品失去一致性（这是商业项目最常见的「廉价感」来源）。
