<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'

import ApiDrawer from '@/components/ApiDrawer.vue'
import type { EndpointSpec } from '@/components/ApiPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useCamera } from '@/composables/useCamera'
import { useFaceStore } from '@/stores/face'
import { captureFrame } from '@/utils/faceCapture'
import { formatDateTime, formatSimilarity } from '@/utils/format'
import { USE_MOCK } from '@/utils/env'
import { FACE_ERROR_MESSAGES } from '@/types'
import type { FaceCheckinResult } from '@/types'

/**
 * 人脸签到（演示级完整闭环）
 * ----------------------------------------------------------------------------
 * 采集 → 每 1.5s 截帧 → POST /api/face/checkin → 展示结果
 * 后端未就绪时由 VITE_USE_MOCK 切到本地模拟（mockCheckin，1.2s）
 */
const faceStore = useFaceStore()
const { videoRef, active, error: cameraError, start: startCamera, stop: stopCamera } = useCamera({
  width: 640,
  height: 480,
})

const scanning = ref(false)
const overlayRef = ref<HTMLCanvasElement | null>(null)
const successFlash = ref(false)
const apiVisible = ref(false)

/** 右列被状态卡与记录占满，接口说明收进抽屉（见 ApiDrawer 注释） */
const endpoints: EndpointSpec[] = [
  {
    name: '人脸签到',
    method: 'POST',
    path: '/api/face/checkin',
    request: `multipart/form-data
  file:    <JPEG 二进制>   必填，前端每 1.5s 截一帧
  user_id: <int>           可选，指定比对目标`,
    response: `{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "user": {
      "id": 1001,
      "name": "陈子豪",
      "studentNo": "2023010101",
      "className": "烹饪工艺与营养 2301"
    },
    "timestamp": "2026-11-20T08:12:31",
    "similarity": 0.964
  }
}`,
    note: '失败时 success=false，message 用枚举值：no_face / low_light / multi_face / low_similarity，前端已映射中文提示。比对底库取注册时留存的 facePhoto。',
  },
  {
    name: '签到记录',
    method: 'GET',
    path: '/api/face/records',
    request: `GET /api/face/records?limit=8`,
    response: `{
  "code": 0,
  "data": [
    {
      "id": 9001,
      "name": "陈子豪",
      "className": "烹饪工艺与营养 2301",
      "similarity": 0.964,
      "status": "success",
      "timestamp": "2026-11-20T08:12:31"
    }
  ]
}`,
    note: 'status 为 success / failed，失败记录同样落到列表里，便于教师追查异常。',
  },
]

let intervalId: number | null = null
let rafId: number | null = null
let busy = false

const latest = computed(() => faceStore.latest)
const status = computed(() => faceStore.status)
const errorText = computed(() => humanize(faceStore.errorMessage))

const statusLabel = computed(() => {
  if (cameraError.value) return '摄像头异常'
  if (status.value === 'success') return '签到成功'
  if (status.value === 'failed') return '识别未通过'
  if (status.value === 'scanning') return '正在识别'
  return active.value ? '取景就绪' : '待机中'
})

const statusTone = computed(() => {
  if (status.value === 'success') return 'success'
  if (status.value === 'failed' || cameraError.value) return 'danger'
  if (status.value === 'scanning') return 'primary'
  return 'info'
})

function humanize(key: string): string {
  return FACE_ERROR_MESSAGES[key] ?? key
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

  // 扫描线（仅识别中）
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

  // 文案（摄像头未启用时由占位层提示，避免重复）
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
      // 网络/接口异常，store 已写入错误信息
      stopScan()
      ElMessage.error(errorText.value || '签到失败，请稍后重试')
      return
    }

    if (result.success) {
      handleSuccess(result)
    } else {
      handleFailure(result)
    }
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

  ElNotification({
    title: '签到成功',
    message: `${result.user?.name ?? '同学'}，相似度 ${formatSimilarity(result.similarity)}，已记录本次签到。`,
    type: 'success',
    duration: 3600,
    position: 'top-right',
  })
}

function handleFailure(result: FaceCheckinResult): void {
  // 识别失败保持循环，给出温和提示，不打断用户重试
  if (result.message) faceStore.errorMessage = humanize(result.message)
}

async function handleStart(): Promise<void> {
  const ready = await startCamera()
  if (!ready) {
    ElMessage.error(cameraError.value ?? '摄像头启动失败')
    return
  }
  if (scanning.value) return

  faceStore.reset()
  scanning.value = true

  // 先挂定时器再触发首次识别：成功后 handleSuccess 里的 stopScan 才能清掉它，
  // 避免「首次识别成功后又自动开始第二轮」的问题
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

onMounted(() => {
  void faceStore.loadRecords(8)
  loop()
})

onBeforeUnmount(() => {
  stopScan()
  if (rafId !== null) window.cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="face-page">
    <PageHeader title="人脸签到" subtitle="实训现场身份核验，签到记录自动归档">
      <template #actions>
        <span v-if="USE_MOCK" class="face-page__mock">
          <span class="status-dot status-dot--warning" />
          Mock 模拟识别
        </span>
        <el-button @click="faceStore.loadRecords(8)">
          <el-icon><Refresh /></el-icon>
          刷新记录
        </el-button>
        <el-button @click="apiVisible = true">
          <el-icon><Connection /></el-icon>
          接口
        </el-button>
      </template>
    </PageHeader>

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
            <p>摄像头未启用</p>
            <span>点击下方「开始识别」，浏览器会请求摄像头权限</span>
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
              {{ status === 'success' ? '重新识别' : '开始识别' }}
            </el-button>
          </div>
        </div>
      </section>

      <div class="face-side">
        <!-- 签到状态 -->
        <section class="app-card status-card">
          <div class="card-head">
            <h2 class="card-head__title">签到状态</h2>
            <span class="status-card__state" :class="`is-${statusTone}`">
              <span class="status-dot" :class="`status-dot--${statusTone === 'info' ? '' : statusTone}`" />
              {{ statusLabel }}
            </span>
          </div>

          <!-- 成功 -->
          <div v-if="status === 'success' && latest?.user" class="status-card__body">
            <p class="status-card__name">{{ latest.user.name }}</p>
            <p class="status-card__class">{{ latest.user.className }}</p>

            <dl class="status-meta">
              <div>
                <dt>学号</dt>
                <dd class="num">{{ latest.user.studentNo }}</dd>
              </div>
              <div>
                <dt>相似度</dt>
                <dd class="num is-strong">{{ formatSimilarity(latest.similarity) }}</dd>
              </div>
              <div>
                <dt>时间</dt>
                <dd class="num">{{ formatDateTime(latest.timestamp, 'HH:mm:ss') }}</dd>
              </div>
            </dl>

            <p class="status-card__note">签到记录已同步到实训考勤。</p>
          </div>

          <!-- 失败 -->
          <div v-else-if="status === 'failed'" class="status-card__body">
            <p class="status-card__error">{{ errorText || '人脸比对未通过' }}</p>
            <p class="status-card__note">请调整位置与光线后重试；连续失败请联系实训教师。</p>
            <el-button type="primary" plain class="status-card__btn" @click="handleStart">
              重新识别
            </el-button>
          </div>

          <!-- 待机 / 识别中 -->
          <div v-else class="status-card__body">
            <p class="status-card__idle">
              {{ scanning ? '正在比对人脸…' : '尚未开始识别' }}
            </p>
            <ul class="status-tips">
              <li>保持面部完整位于虚线框内</li>
              <li>光线均匀，避免逆光与强反光</li>
              <li>识别成功后自动写入签到记录</li>
            </ul>
          </div>
        </section>

        <!-- 最近签到 -->
        <section class="app-card records-card">
          <div class="card-head">
            <h2 class="card-head__title">最近签到</h2>
            <span class="records-card__count num">近 {{ faceStore.records.length }} 条</span>
          </div>

          <ul v-loading="faceStore.loadingRecords" class="records">
            <li v-for="record in faceStore.records" :key="record.id" class="record">
              <span class="record__avatar" :class="{ 'is-failed': record.status === 'failed' }">
                {{ record.name.slice(0, 1) }}
              </span>
              <div class="record__body">
                <p class="record__name">
                  {{ record.name }}
                  <span v-if="record.status === 'failed'" class="record__flag">未通过</span>
                </p>
                <span class="record__meta">{{ record.className }}</span>
              </div>
              <div class="record__right">
                <span class="record__score num">{{ formatSimilarity(record.similarity) }}</span>
                <span class="record__time num">{{ formatDateTime(record.timestamp, 'MM-DD HH:mm') }}</span>
              </div>
            </li>
            <li v-if="!faceStore.records.length" class="records__empty">暂无签到记录</li>
          </ul>
        </section>
      </div>
    </div>

    <ApiDrawer v-model="apiVisible" :endpoints="endpoints" title="人脸签到 · 后端接入" />
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

.face-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 308px;
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
    // 前置摄像头镜像，符合自拍直觉
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
    text-align: center;

    p {
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: rgba(255, 255, 255, 0.78);
    }

    span {
      font-size: $font-size-xs;
      color: rgba(255, 255, 255, 0.36);
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

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    letter-spacing: -0.01em;
    color: $color-text-primary;
  }

  &__class {
    margin-top: 2px;
    font-size: $font-size-xs;
    color: $color-text-secondary;
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
  }

  &__btn {
    width: 100%;
    margin-top: $space-4;
  }
}

.status-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  padding: $space-3 0;
  margin: $space-4 0 0;
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

    &.is-strong {
      font-weight: $font-weight-semibold;
    }
  }
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

// ---------- 签到记录 ----------
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
  border-top: 1px solid $color-border-light;

  &:first-child {
    padding-top: 2px;
    border-top: none;
  }

  &:last-child {
    padding-bottom: 0;
  }

  &__avatar {
    display: inline-flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-regular;
    background: $color-bg-subtle;
    border-radius: $radius-pill;

    &.is-failed {
      color: $color-text-placeholder;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  &__flag {
    font-size: 10px;
    color: $color-danger;
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
    grid-template-columns: minmax(0, 1fr) 288px;
  }
}

@media (max-width: $breakpoint-lg) {
  .face-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
