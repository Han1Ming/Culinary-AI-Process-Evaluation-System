<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'

import ApiDrawer from '@/components/ApiDrawer.vue'
import type { EndpointSpec } from '@/components/ApiPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import { useCamera } from '@/composables/useCamera'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth'
import { useFaceStore } from '@/stores/face'
import { mockStudents } from '@/mock/students'
import { captureFrame } from '@/utils/faceCapture'
import { formatDateTime, formatSimilarity } from '@/utils/format'
import { USE_MOCK } from '@/utils/env'
import { CHECKIN_STATUS_META, FACE_ERROR_MESSAGES } from '@/types'
import type { FaceCheckinResult, FaceRecordQuery } from '@/types'

import FaceProfileDialog from './components/FaceProfileDialog.vue'
import ManualCheckinDialog from './components/ManualCheckinDialog.vue'
import RecordDetailDrawer from './components/RecordDetailDrawer.vue'

/**
 * 人脸签到
 * ----------------------------------------------------------------------------
 * 采集 → 每 1.5s 截帧 → POST /api/v1/face/checkin → 展示结果 / 多人同框列表。
 * 教师侧多三件事：人工补签、人脸底库管理、按班/日期/学生查签到记录。
 *
 * 失败不做「猜」：网络断了就明确说未提交，接口超时就建议查记录，
 * 绝不在前端伪造一次成功签到。
 */
const faceStore = useFaceStore()
const { can, isStudent } = useRole()
const auth = useAuthStore()

/**
 * 学生只能看自己的记录。
 * 用花名册 id 而不是学号做范围：服务端也该按这个 id 校验。
 * 拿不到本人档案时置 0 —— 宁可查空，也不能退化成「查全班」。
 */
const selfId = computed(() => {
  const no = auth.user?.studentNo
  if (!no) return 0
  return mockStudents.find((stu) => stu.studentNo === no)?.id ?? 0
})

const {
  videoRef,
  active,
  error: cameraError,
  devices,
  currentDeviceId,
  start: startCamera,
  stop: stopCamera,
} = useCamera({ width: 640, height: 480 })

const scanning = ref(false)
const overlayRef = ref<HTMLCanvasElement | null>(null)
const successFlash = ref(false)
const apiVisible = ref(false)
const manualVisible = ref(false)
const profileVisible = ref(false)
const privacyVisible = ref(false)
const detailVisible = ref(false)
const detailId = ref('')

/** 记录筛选 */
const classOptions = computed(() => {
  const set = new Set<string>()
  mockStudents.forEach((stu) => set.add(stu.className))
  return [...set]
})
const statusOptions = Object.entries(CHECKIN_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))
const dateRange = ref<[string, string] | null>(null)

const endpoints: EndpointSpec[] = [
  {
    name: '人脸签到',
    method: 'POST',
    path: '/api/v1/face/checkin',
    request: `multipart/form-data
  file:    <JPEG 二进制>   必填，前端每 1.5s 截一帧
  user_id: <int>           可选，指定比对目标`,
    response: `{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "user": { "id": 1001, "name": "陈子豪", "studentNo": "2023010101", "className": "烹饪工艺与营养 2301" },
    "timestamp": "2026-11-21T08:12:31",
    "similarity": 0.964,
    "snapshot": "https://oss.example.com/face/ck_008.jpg",
    "matches": [
      { "userId": 1001, "name": "陈子豪", "similarity": 0.964, "status": "success" },
      { "userId": 1002, "name": "李思影", "similarity": 0.912, "status": "success" }
    ]
  }
}`,
    note: '多人同框时 matches 返回全部命中的人；重复签到 success=false、message=duplicate，并带上已签到时间。失败枚举：no_face / low_light / multi_face / low_similarity / duplicate / unregistered。',
  },
  {
    name: '签到记录',
    method: 'GET',
    path: '/api/v1/face/records',
    request: `GET /api/v1/face/records?page=1&pageSize=8
    &className=烹饪工艺与营养 2301
    &dateStart=2026-11-01&dateEnd=2026-11-21
    &studentKeyword=陈&status=success`,
    response: `{
  "code": 0,
  "data": {
    "total": 38,
    "page": 1,
    "pageSize": 8,
    "list": [
      {
        "id": "ck_20261121_008",
        "name": "陈子豪",
        "studentNo": "2023010101",
        "className": "烹饪工艺与营养 2301",
        "seat": "02",
        "courseTitle": "《中式热菜制作》—— 糖醋里脊",
        "timestamp": "2026-11-21T08:12:31",
        "similarity": 0.964,
        "status": "success",
        "source": "ai",
        "snapshot": "https://oss.example.com/face/ck_008.jpg",
        "deviceName": "USB 广角 · 工位 02"
      }
    ]
  }
}`,
    note: 'status：success / failed / duplicate / manual；source：ai / manual。失败与补签记录同样入库，教师才追得动异常。',
  },
  {
    name: '人工补签',
    method: 'POST',
    path: '/api/v1/face/checkin/manual',
    request: `{
  "studentId": 1004,
  "at": "2026-11-21T08:04:00",
  "reason": "学生刘海遮挡，识别失败三次，核对学生证后补签"
}`,
    response: `{ "code": 0, "data": { "id": "ck_manual_...", "status": "manual", "operator": "陈立群" } }`,
    note: '补签必须带操作人（后端从 Token 取）与原因，写入审计日志；不覆盖 AI 记录。',
  },
  {
    name: '人脸底库',
    method: 'GET',
    path: '/api/v1/face/profiles',
    request: `GET /api/v1/face/profiles
PUT    /api/v1/face/profiles/{userId}   { "photo": "<dataURL 或对象存储 key>" }
DELETE /api/v1/face/profiles/{userId}   { "reason": "学生申请撤回授权" }`,
    response: `{
  "code": 0,
  "data": [
    { "userId": 1001, "name": "陈子豪", "status": "active", "registeredAt": "2026-09-03 10:12", "consentAt": "2026-09-03 10:10" }
  ]
}`,
    note: '只返回注册状态与照片地址，不返回特征值；注销后底库失效，历史记录保留。',
  },
]

let intervalId: number | null = null
let rafId: number | null = null
let busy = false

const latest = computed(() => faceStore.latest)
const status = computed(() => faceStore.status)
const errorText = computed(() => humanize(faceStore.latest?.message ?? ''))
const matches = computed(() => faceStore.matches)

const statusLabel = computed(() => {
  if (cameraError.value) return '摄像头异常'
  if (status.value === 'success') return matches.value.length > 1 ? `${matches.value.length} 人同时签到` : '签到成功'
  if (status.value === 'failed') return latest.value?.duplicate ? '已签到' : '识别未通过'
  if (status.value === 'scanning') return '正在识别'
  return active.value ? '取景就绪' : '待机中'
})

const statusTone = computed(() => {
  if (status.value === 'success') return 'success'
  if (status.value === 'failed' || cameraError.value) return 'danger'
  if (status.value === 'scanning') return 'primary'
  return 'info'
})

/** 网络 / 超时：明确说「未提交」，并给重试入口，不做静默失败 */
const recoverable = computed(() => {
  const key = latest.value?.message
  return key === 'network' || key === 'timeout'
})

function humanize(key: string): string {
  return FACE_ERROR_MESSAGES[key] ?? key
}

function currentTime(): string {
  return new Date().toISOString()
}

/* ---------------- 画布引导框 ---------------- */

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** 绘制虚线圆角矩形引导框 + 四角强调线 + 扫描线 */
function drawOverlay(): void {
  const canvas = overlayRef.value
  if (!canvas) return

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return

  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const boxW = Math.min(width * 0.5, height * 0.56)
  const boxH = boxW * 1.26
  const x = (width - boxW) / 2
  const y = (height - boxH) / 2
  const radius = 18

  // 深色画面上用高亮度描边，识别中转为浅蓝以提示状态切换
  const accent = scanning.value ? 'rgba(138, 180, 255, 0.95)' : 'rgba(255, 255, 255, 0.78)'

  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.setLineDash([10, 8])
  ctx.lineDashOffset = scanning.value ? -(performance.now() / 32) % 18 : 0
  roundRectPath(ctx, x, y, boxW, boxH, radius)
  ctx.stroke()
  ctx.restore()

  // 四角实线，强化取景范围
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  const corner = 16
  const corners: Array<[number, number, number, number]> = [
    [x, y + radius + corner, x, y + radius],
    [x + radius, y, x + radius + corner, y],
    [x + boxW - radius - corner, y, x + boxW - radius, y],
    [x + boxW, y + radius, x + boxW, y + radius + corner],
    [x + boxW, y + boxH - radius - corner, x + boxW, y + boxH - radius],
    [x + boxW - radius - corner, y + boxH, x + boxW - radius, y + boxH],
    [x + radius, y + boxH, x + radius + corner, y + boxH],
    [x, y + boxH - radius, x, y + boxH - radius - corner],
  ]
  for (const [x1, y1, x2, y2] of corners) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()

  if (scanning.value) {
    const progress = (performance.now() % 2200) / 2200
    const lineY = y + 12 + (boxH - 24) * progress
    const gradient = ctx.createLinearGradient(x, lineY, x + boxW, lineY)
    gradient.addColorStop(0, 'rgba(138, 180, 255, 0)')
    gradient.addColorStop(0.5, 'rgba(138, 180, 255, 0.8)')
    gradient.addColorStop(1, 'rgba(138, 180, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x + 8, lineY, boxW - 16, 1.5)
  }

  if (active.value) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
    ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      scanning.value ? '请正对摄像头，保持面部在框内' : '取景就绪',
      width / 2,
      y + boxH + 28,
    )
    ctx.restore()
  }
}

function loop(): void {
  drawOverlay()
  rafId = window.requestAnimationFrame(loop)
}

/* ---------------- 识别流程 ---------------- */

function stopScan(): void {
  scanning.value = false
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

async function recognizeOnce(): Promise<void> {
  const video = videoRef.value
  if (!video || video.readyState < 2 || busy) return

  busy = true
  try {
    faceStore.markScanning()
    const frame = await captureFrame(video, 0.85)
    const result = await faceStore.checkin(frame)
    if (!result) {
      stopScan()
      return
    }
    if (result.success) handleSuccess(result)
    else handleFailure(result)
  } catch (error) {
    stopScan()
    ElMessage.error(error instanceof Error ? error.message : '识别过程发生异常')
  } finally {
    busy = false
  }
}

function handleSuccess(result: FaceCheckinResult): void {
  stopScan()
  successFlash.value = true
  window.setTimeout(() => (successFlash.value = false), 900)

  const people = result.matches ?? []
  const names = people.map((item) => item.name).join('、')
  ElNotification({
    title: people.length > 1 ? `${people.length} 人签到成功` : '签到成功',
    message:
      people.length > 1
        ? `${names} 已完成签到，各自记入本人记录。`
        : `${names || result.user?.name || '同学'}，相似度 ${formatSimilarity(result.similarity)}，已记录本次签到。`,
    type: 'success',
    duration: 3800,
    position: 'top-right',
  })
}

function handleFailure(result: FaceCheckinResult): void {
  // 重复签到 / 未注册：停下来，避免每 1.5s 刷一次同样的提示
  if (result.duplicate || result.message === 'duplicate' || result.message === 'unregistered') {
    stopScan()
    ElMessage.warning(humanize(result.message ?? 'duplicate'))
    return
  }
  // 网络 / 超时：停止并给出「未提交」的恢复入口
  if (result.message === 'network' || result.message === 'timeout') {
    stopScan()
    return
  }
  // 没检测到人脸 / 光线不足：保持循环，温和提示
  if (result.message) ElMessage.warning(humanize(result.message))
}

async function handleStart(): Promise<void> {
  const ready = await startCamera(currentDeviceId.value || undefined)
  if (!ready) {
    ElMessage.error(cameraError.value ?? '摄像头启动失败')
    return
  }
  if (scanning.value) return

  faceStore.reset()
  scanning.value = true

  // 先挂定时器再触发首次识别：成功后 handleSuccess 里的 stopScan 才能清掉它
  intervalId = window.setInterval(() => {
    void recognizeOnce()
  }, 1500)
  await recognizeOnce()
}

function handleStop(): void {
  stopScan()
  faceStore.reset()
}

function handleLeave(): void {
  stopScan()
  stopCamera()
}

/** 切换设备：先停流再按新 deviceId 重启，旧流必须 getTracks().stop() 否则指示灯不灭 */
async function onDeviceChange(deviceId: string): Promise<void> {
  const wasScanning = scanning.value
  stopScan()
  if (!active.value) return
  const ok = await startCamera(deviceId)
  if (!ok) {
    ElMessage.error(cameraError.value ?? '切换摄像头失败')
    return
  }
  if (wasScanning) await handleStart()
}

/* ---------------- 记录筛选 ---------------- */

function applyFilters(patch: Partial<FaceRecordQuery> = {}): void {
  void faceStore.loadRecords({ ...patch, page: patch.page ?? 1 })
}

watch(dateRange, (range) => {
  applyFilters({ dateStart: range?.[0] ?? '', dateEnd: range?.[1] ?? '' })
})

function resetFilters(): void {
  dateRange.value = null
  faceStore.resetQuery()
  void faceStore.loadRecords()
}

function openDetail(id: string): void {
  detailId.value = id
  detailVisible.value = true
}

function filterStudent(name: string): void {
  detailVisible.value = false
  applyFilters({ studentKeyword: name })
}

function onManualSubmitted(): void {
  void faceStore.loadRecords({ page: 1 })
}

onMounted(() => {
  // 先划范围再取数：学生进页面第一帧就不会看到别人的记录
  faceStore.setScope(isStudent.value ? selfId.value : null)
  void faceStore.loadRecords()
  loop()
})

onBeforeUnmount(() => {
  stopScan()
  if (rafId !== null) window.cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="face-page">
    <PageHeader title="人脸识别签到" subtitle="实训现场身份核验，签到记录自动归档">
      <template #actions>
        <span v-if="USE_MOCK" class="face-page__mock">
          <span class="status-dot status-dot--warning" />
          Mock 模拟识别
        </span>
        <el-select
          v-model="currentDeviceId"
          size="default"
          class="device-select"
          placeholder="选择摄像头"
          @change="onDeviceChange"
        >
          <el-option label="默认摄像头" value="" />
          <el-option v-for="dev in devices" :key="dev.deviceId" :label="dev.label" :value="dev.deviceId" />
        </el-select>
        <el-button v-if="can('face.manual')" @click="manualVisible = true">
          <el-icon><EditPen /></el-icon>
          人工补签
        </el-button>
        <el-button v-if="can('face.profile')" @click="profileVisible = true">
          <el-icon><User /></el-icon>
          人脸管理
        </el-button>
        <el-button @click="applyFilters({ page: 1 })">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button @click="apiVisible = true">
          <el-icon><Connection /></el-icon>
          接口
        </el-button>
      </template>
    </PageHeader>

    <!-- 个人信息告知：一行常驻，点开看全文，不做成一次性弹窗 -->
    <p class="privacy-line">
      <span class="status-dot" />
      人脸仅用于本节课签到身份核验，采集前需本人确认；学生可随时申请注销。
      <button type="button" class="privacy-line__link" @click="privacyVisible = true">查看授权说明</button>
    </p>

    <div class="face-grid">
      <!-- 取景区 -->
      <section class="stage-card">
        <div class="stage" :class="{ 'is-active': active }">
          <video ref="videoRef" class="stage__video" playsinline muted autoplay />
          <canvas ref="overlayRef" class="stage__overlay" />

          <div v-if="!active" class="stage__placeholder">
            <span class="stage__placeholder-icon">
              <el-icon><VideoCamera /></el-icon>
            </span>
            <p>{{ cameraError || '摄像头未启用' }}</p>
            <span>
              {{
                cameraError
                  ? '检查设备连接与浏览器权限后点「重新打开摄像头」'
                  : '点击下方「开始识别」，浏览器会请求摄像头权限'
              }}
            </span>
          </div>

          <div class="stage__status" :class="`is-${statusTone}`">
            <span class="stage__status-dot" />
            {{ statusLabel }}
          </div>

          <transition name="flash">
            <div v-if="successFlash" class="stage__flash" />
          </transition>
        </div>

        <div class="stage-card__bar">
          <span class="stage-card__hint">
            <el-icon><InfoFilled /></el-icon>
            <template v-if="cameraError">{{ cameraError }}</template>
            <template v-else>每 1.5 秒比对一次，单帧约 40KB</template>
          </span>

          <div class="stage-card__actions">
            <el-button v-if="active" @click="handleLeave">
              <el-icon><SwitchButton /></el-icon>
              关闭摄像头
            </el-button>
            <el-button v-if="scanning" @click="handleStop">
              <el-icon><VideoPause /></el-icon>
              停止
            </el-button>
            <el-button v-else type="primary" @click="handleStart">
              <el-icon><Camera /></el-icon>
              {{ status === 'success' ? '继续识别下一位' : active ? '开始识别' : '打开摄像头' }}
            </el-button>
          </div>
        </div>
      </section>

      <div class="face-side">
        <!-- 签到状态 -->
        <section class="app-card status-card">
          <div class="card-head">
            <h2 class="card-head__title">
              {{ matches.length > 1 ? `同时识别到 ${matches.length} 人` : '签到状态' }}
            </h2>
            <span class="status-card__state" :class="`is-${statusTone}`">
              <span class="status-dot" :class="`status-dot--${statusTone === 'info' ? '' : statusTone}`" />
              {{ statusLabel }}
            </span>
          </div>

          <!-- 成功：单人 / 多人同框共用一套列表 -->
          <div v-if="status === 'success' && matches.length" class="status-card__body">
            <ul class="match-list">
              <li v-for="match in matches" :key="match.userId" class="match">
                <span class="match__avatar">{{ match.name.slice(0, 1) }}</span>
                <div class="match__body">
                  <p class="match__name">
                    {{ match.name }}
                    <span v-if="match.status === 'success'" class="match__tag is-ok">签到成功</span>
                    <span v-else-if="match.status === 'duplicate'" class="match__tag is-warn">已签到</span>
                    <span v-else class="match__tag is-danger">未注册</span>
                  </p>
                  <span class="match__meta num">{{ match.studentNo }} · {{ match.className }}</span>
                </div>
                <span class="match__score num">{{ formatSimilarity(match.similarity) }}</span>
              </li>
            </ul>

            <dl class="status-meta">
              <div>
                <dt>识别时间</dt>
                <dd class="num">{{ formatDateTime(latest?.timestamp ?? currentTime(), 'HH:mm:ss') }}</dd>
              </div>
              <div>
                <dt>本次人数</dt>
                <dd class="num">{{ matches.length }} 人</dd>
              </div>
              <div>
                <dt>记录</dt>
                <dd class="num">已归档</dd>
              </div>
            </dl>

            <img v-if="latest?.snapshot" :src="latest.snapshot" alt="本次识别截图" class="snap" />
            <p class="status-card__note">签到记录已同步到实训考勤，教师可在下方记录中查看截图。</p>
          </div>

          <!-- 失败 -->
          <div v-else-if="status === 'failed'" class="status-card__body">
            <p class="status-card__error">{{ errorText || '人脸比对未通过' }}</p>

            <template v-if="recoverable">
              <p class="status-card__note">
                本次签到<strong>未提交</strong>，不会产生半条记录。恢复网络后重试即可；
                也可以先请教师人工补签。
              </p>
              <el-button type="primary" plain class="status-card__btn" @click="handleStart">重试</el-button>
            </template>
            <template v-else>
              <p class="status-card__note">请调整位置与光线后重试；连续失败请联系实训教师补签。</p>
              <el-button type="primary" plain class="status-card__btn" @click="handleStart">重新识别</el-button>
            </template>
          </div>

          <!-- 待机 / 识别中 -->
          <div v-else class="status-card__body">
            <p class="status-card__idle">{{ scanning ? '正在比对人脸…' : '尚未开始识别' }}</p>
            <ul class="status-tips">
              <li>保持面部完整位于虚线框内</li>
              <li>光线均匀，避免逆光与强反光</li>
              <li>多人同时入镜时，识别结果会逐人列出</li>
            </ul>
          </div>
        </section>

        <!-- 最近签到 -->
        <section class="app-card records-card">
          <div class="card-head">
            <h2 class="card-head__title">最近签到</h2>
            <span class="records-card__count num">共 {{ faceStore.total }} 条</span>
          </div>

          <ul v-loading="faceStore.loadingRecords" class="records">
            <li
              v-for="record in faceStore.records.slice(0, 5)"
              :key="record.id"
              class="record"
              @click="openDetail(record.id)"
            >
              <span class="record__avatar" :class="`is-${CHECKIN_STATUS_META[record.status].tone}`">
                {{ record.name.slice(0, 1) }}
              </span>
              <div class="record__body">
                <p class="record__name">
                  {{ record.name }}
                  <span class="record__flag" :class="`is-${CHECKIN_STATUS_META[record.status].tone}`">
                    {{ CHECKIN_STATUS_META[record.status].label }}
                  </span>
                </p>
                <span class="record__meta">{{ record.className }}</span>
              </div>
              <div class="record__right">
                <span class="record__score num">
                  {{ record.source === 'manual' ? '人工' : formatSimilarity(record.similarity) }}
                </span>
                <span class="record__time num">{{ formatDateTime(record.timestamp, 'MM-DD HH:mm') }}</span>
              </div>
            </li>
            <li v-if="!faceStore.loadingRecords && !faceStore.records.length" class="records__empty">
              暂无签到记录
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- 签到记录：筛选 + 分页 -->
    <section class="app-card record-card">
      <header class="record-card__head">
        <div>
          <h2>{{ isStudent ? '我的签到记录' : '签到记录' }}</h2>
          <p>
            {{
              isStudent
                ? '只展示你本人的签到记录；漏签请联系任课教师补录'
                : '按班级、日期与状态筛选；点击任意一行查看识别截图与详情'
            }}
          </p>
        </div>
        <div v-if="!isStudent" class="filters">
          <el-input
            v-model="faceStore.query.studentKeyword"
            size="small"
            placeholder="姓名 / 学号"
            clearable
            class="filters__input"
            @change="applyFilters({ studentKeyword: faceStore.query.studentKeyword ?? '' })"
          />
          <el-select
            v-model="faceStore.query.className"
            size="small"
            placeholder="全部班级"
            clearable
            class="filters__select"
            @change="applyFilters({ className: faceStore.query.className })"
          >
            <el-option v-for="name in classOptions" :key="name" :label="name" :value="name" />
          </el-select>
          <el-select
            v-model="faceStore.query.status"
            size="small"
            placeholder="全部状态"
            clearable
            class="filters__select"
            @change="applyFilters({ status: faceStore.query.status })"
          >
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            size="small"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            class="filters__date"
          />
          <el-button size="small" @click="resetFilters">重置</el-button>
        </div>
      </header>

      <StateView
        v-if="faceStore.recordError"
        state="error"
        compact
        :description="faceStore.recordError"
        @retry="applyFilters({ page: 1 })"
      />
      <StateView
        v-else-if="!faceStore.loadingRecords && !faceStore.records.length"
        state="empty"
        compact
        description="当前筛选条件下没有签到记录"
        @retry="resetFilters"
      />
      <template v-else>
        <el-table
          v-loading="faceStore.loadingRecords"
          :data="faceStore.records"
          size="small"
          class="table"
          @row-click="(row: { id: string }) => openDetail(row.id)"
        >
          <el-table-column label="学生" min-width="150">
            <template #default="{ row }">
              <div class="cell-student">
                <span class="cell-student__name">{{ row.name }}</span>
                <span class="cell-student__no num">{{ row.studentNo }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="className" label="班级" min-width="150" show-overflow-tooltip />
          <el-table-column prop="seat" label="工位" width="70" />
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              <span class="num">{{ formatDateTime(row.timestamp, 'MM-DD HH:mm:ss') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <span class="state-tag" :class="`is-${CHECKIN_STATUS_META[row.status as keyof typeof CHECKIN_STATUS_META].tone}`">
                {{ CHECKIN_STATUS_META[row.status as keyof typeof CHECKIN_STATUS_META].label }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="90">
            <template #default="{ row }">{{ row.source === 'manual' ? '教师补签' : 'AI 识别' }}</template>
          </el-table-column>
          <el-table-column label="相似度" width="90">
            <template #default="{ row }">
              <span class="num">{{ row.source === 'manual' ? '—' : formatSimilarity(row.similarity) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" @click.stop="openDetail(row.id)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          class="pager"
          layout="total, prev, pager, next"
          :total="faceStore.total"
          :page-size="faceStore.query.pageSize"
          :current-page="faceStore.query.page"
          @current-change="(page: number) => applyFilters({ page })"
        />
      </template>
    </section>

    <ApiDrawer v-model="apiVisible" :endpoints="endpoints" title="人脸签到 · 后端接入" />
    <ManualCheckinDialog v-model="manualVisible" @submitted="onManualSubmitted" />
    <FaceProfileDialog v-model="profileVisible" />
    <RecordDetailDrawer
      v-model="detailVisible"
      :record-id="detailId"
      @filter-student="filterStudent"
    />

    <!-- 授权说明 -->
    <el-dialog v-model="privacyVisible" title="人脸信息授权说明" width="560px">
      <div class="privacy">
        <h4>1. 采集什么</h4>
        <p>签到瞬间的一张人脸照片，用于与底库比对；不采集声纹、指纹、位置轨迹。</p>
        <h4>2. 用来做什么</h4>
        <p>仅用于本节课的签到身份核验与考勤留痕，不用于成绩评判，不用于任何商业分析。</p>
        <h4>3. 存多久、给谁看</h4>
        <p>
          识别截图随签到记录保存至本学期教学档案结束；任课教师与教务管理员可查看，
          不向第三方提供。底库只存注册照片，比对在服务端完成。
        </p>
        <h4>4. 怎么撤回</h4>
        <p>
          学生可向任课教师或信息中心提出注销申请，注销后底库立即失效；历史签到记录保留，
          但不再包含人脸特征。注销后仍可通过教师人工补签完成考勤。
        </p>
      </div>
      <template #footer>
        <el-button type="primary" @click="privacyVisible = false">我已知晓</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.face-page {
  &__mock {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin-right: $space-1;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.device-select {
  width: 190px;
}

.privacy-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px 12px;
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-md;

  &__link {
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    color: $color-primary;
    cursor: pointer;
    background: none;
    border: 0;
  }
}

.face-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.face-side {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  min-width: 0;
}

// ---------- 取景区 ----------
.stage-card {
  overflow: hidden;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__bar {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid $color-border-light;
  }

  &__hint {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__actions {
    display: flex;
    gap: $space-2;
  }
}

.stage {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, #1a1b1f 0%, #0c0d0f 72%);

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }

  &__overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  &__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 0 $space-6;
    text-align: center;

    p {
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: rgba(255, 255, 255, 0.78);
    }

    span {
      max-width: 300px;
      font-size: $font-size-xs;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.4);
    }
  }

  &__placeholder-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin-bottom: 6px;
    font-size: 20px;
    color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: $radius-lg;
  }

  &__status {
    position: absolute;
    top: 12px;
    left: 12px;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 4px 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.86);
    background: rgba(0, 0, 0, 0.46);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: $radius-pill;
  }

  &__status-dot {
    width: 5px;
    height: 5px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;

    .is-primary & {
      background: #8ab4ff;
      animation: app-pulse-dot 1.6s $ease-standard infinite;
    }

    .is-success & {
      background: #4ade80;
    }

    .is-danger & {
      background: #f87171;
    }
  }

  &__flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle, rgba(74, 222, 128, 0.24), transparent 62%);
  }
}

// ---------- 状态卡 ----------
.status-card {
  &__state {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  &__error {
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-danger;
  }

  &__idle {
    font-size: $font-size-base;
    color: $color-text-regular;
  }

  &__note {
    margin-top: $space-3;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-placeholder;

    strong {
      color: $color-text-regular;
    }
  }

  &__btn {
    width: 100%;
    margin-top: $space-4;
  }
}

.match-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  margin: 0;
  list-style: none;
}

.match {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid $color-border-light;

  &:first-child {
    padding-top: 0;
  }

  &__avatar {
    display: inline-flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-pill;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__tag {
    font-size: 10px;

    &.is-ok {
      color: $color-success;
    }

    &.is-warn {
      color: $color-warning;
    }

    &.is-danger {
      color: $color-danger;
    }
  }

  &__meta {
    display: block;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__score {
    flex-shrink: 0;
    font-size: $font-size-xs;
    color: $color-text-regular;
  }
}

.status-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  padding: $space-3 0;
  margin: $space-3 0 0;
  border-top: 1px solid $color-border-light;
  border-bottom: 1px solid $color-border-light;

  div + div {
    border-left: 1px solid $color-border-light;
  }

  div {
    text-align: center;
  }

  dt {
    font-size: 11px;
    color: $color-text-placeholder;
  }

  dd {
    margin: 3px 0 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }
}

.snap {
  width: 100%;
  margin-top: $space-3;
  border-radius: $radius-sm;
}

.status-tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: $space-3;

  li {
    position: relative;
    padding-left: 12px;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $color-text-secondary;

    &::before {
      position: absolute;
      top: 7px;
      left: 0;
      width: 3px;
      height: 3px;
      content: '';
      background: $color-text-placeholder;
      border-radius: 50%;
    }
  }
}

// ---------- 最近签到 ----------
.records-card {
  &__count {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.records {
  &__empty {
    padding: $space-5 0;
    font-size: $font-size-sm;
    color: $color-text-placeholder;
    text-align: center;
  }
}

.record {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 0;
  cursor: pointer;
  border-top: 1px solid $color-border-light;

  &:first-child {
    padding-top: 2px;
    border-top: none;
  }

  &__avatar {
    display: inline-flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-pill;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__flag {
    font-size: 10px;

    &.is-success {
      color: $color-success;
    }

    &.is-danger {
      color: $color-danger;
    }

    &.is-warning {
      color: $color-warning;
    }

    &.is-primary {
      color: $color-primary;
    }
  }

  &__meta {
    display: block;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__right {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 1px;
    align-items: flex-end;
  }

  &__score {
    font-size: $font-size-xs;
    color: $color-text-regular;
  }

  &__time {
    font-size: 10px;
    color: $color-text-placeholder;
  }
}

// ---------- 记录表 ----------
.record-card {
  margin-top: $space-4;

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: $space-3;

    h2 {
      margin: 0;
      font-size: $font-size-base;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: $font-size-xs;
      color: $color-text-placeholder;
    }
  }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  align-items: center;

  &__input {
    width: 130px;
  }

  &__select {
    width: 138px;
  }

  &__date {
    width: 230px;
  }
}

.table {
  width: 100%;
  cursor: pointer;
}

.cell-student {
  display: flex;
  flex-direction: column;

  &__name {
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__no {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.state-tag {
  font-size: 11px;

  &.is-success {
    color: $color-success;
  }

  &.is-danger {
    color: $color-danger;
  }

  &.is-warning {
    color: $color-warning;
  }

  &.is-primary {
    color: $color-primary;
  }
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: $space-3;
}

.privacy {
  h4 {
    margin: $space-4 0 4px;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  p {
    margin: 0;
    font-size: $font-size-xs;
    line-height: 1.8;
    color: $color-text-secondary;
  }
}

.flash-enter-active,
.flash-leave-active {
  transition: opacity $duration-slow $ease-standard;
}

.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}

@media (max-width: 1360px) {
  .face-grid {
    grid-template-columns: minmax(0, 1fr) 292px;
  }
}

@media (max-width: $breakpoint-lg) {
  .face-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
