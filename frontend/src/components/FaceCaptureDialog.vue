<script setup lang="ts">
/**
 * 人脸照片补录
 * ----------------------------------------------------------------------------
 * 用户管理里「补录 / 更换人脸照片」的弹窗。现场两种情况都有：
 * 学生本人到了就打开摄像头拍；学生不在，就上传一张证件照。
 * 两条路都压到 480px 宽 JPEG，和注册时的口径一致，避免底库照片规格不一。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { compressImage } from '@/utils/faceCapture'

const props = defineProps<{
  /** 用户姓名，用于弹窗标题 */
  name: string
  /** 现有照片，用于「更换」时先看一眼旧图 */
  photo?: string
}>()

const emit = defineEmits<{ saved: [dataUrl: string] }>()

const visible = defineModel<boolean>({ default: false })

const videoRef = ref<HTMLVideoElement>()
const stream = ref<MediaStream | null>(null)
const cameraOn = ref(false)
const cameraError = ref('')
const shot = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement>()

async function openCamera(): Promise<void> {
  cameraError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = '当前浏览器不支持摄像头，请改用上传照片'
    return
  }
  try {
    const media = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    stream.value = media
    cameraOn.value = true
    await new Promise((r) => setTimeout(r, 60))
    if (videoRef.value) {
      videoRef.value.srcObject = media
      await videoRef.value.play().catch(() => undefined)
    }
  } catch {
    cameraError.value = '无法打开摄像头，请检查权限或改用上传照片'
    cameraOn.value = false
  }
}

function closeCamera(): void {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  cameraOn.value = false
}

async function shoot(): Promise<void> {
  const video = videoRef.value
  if (!video || !video.videoWidth) {
    ElMessage.warning('画面还没准备好，请稍后再试')
    return
  }
  busy.value = true
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持截帧')
    // 预览是镜像的，落库要翻回真实方向
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    shot.value = await compressImage(canvas.toDataURL('image/jpeg', 0.9))
    closeCamera()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '拍照失败')
  } finally {
    busy.value = false
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  try {
    shot.value = await compressImage(file)
  } catch {
    ElMessage.error('图片读取失败，换一张试试')
  }
}

function confirm(): void {
  if (!shot.value) {
    ElMessage.warning('先拍一张或上传一张照片')
    return
  }
  emit('saved', shot.value)
  visible.value = false
}

/** 每次打开都恢复初始态，避免上次的残影 */
watch(visible, (open) => {
  if (open) {
    shot.value = ''
    cameraError.value = ''
  } else {
    closeCamera()
  }
})

onBeforeUnmount(closeCamera)
</script>

<template>
  <el-dialog v-model="visible" :title="`补录人脸照片 · ${name}`" width="520px" append-to-body>
    <div class="face-capture">
      <!-- 已有照片：先让人确认换的是谁 -->
      <div v-if="photo && !shot" class="existing">
        <img :src="photo" :alt="`${name}现有照片`" />
        <span>当前底库照片，重新采集后会覆盖</span>
      </div>

      <!-- 取景 / 结果 -->
      <div class="stage">
        <video v-show="cameraOn && !shot" ref="videoRef" class="stage__video" playsinline muted autoplay />
        <img v-if="shot" :src="shot" class="stage__shot" :alt="`${name}的新照片`" />

        <div v-if="!cameraOn && !shot" class="stage__placeholder">
          <span>打开摄像头拍摄，或上传一张正面照</span>
        </div>

        <template v-if="cameraOn && !shot">
          <span class="corner corner--tl" />
          <span class="corner corner--tr" />
          <span class="corner corner--bl" />
          <span class="corner corner--br" />
        </template>
      </div>

      <p v-if="cameraError" class="hint hint--error">{{ cameraError }}</p>
      <p v-else class="hint">要求：正面、免冠、光线均匀，面部占画面一半以上。</p>

      <div class="actions">
        <el-button v-if="!cameraOn && !shot" type="primary" @click="openCamera">
          <el-icon><Camera /></el-icon>
          打开摄像头
        </el-button>
        <el-button v-if="cameraOn" type="primary" :loading="busy" @click="shoot">拍下这张</el-button>
        <el-button v-if="cameraOn" @click="closeCamera">关闭摄像头</el-button>
        <el-button v-if="shot" @click="shot = ''">重拍</el-button>
        <el-button text @click="fileInput?.click()">
          {{ shot ? '换一张上传' : '上传照片' }}
        </el-button>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!shot" @click="confirm">保存为底库照片</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.face-capture {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.existing {
  display: flex;
  gap: $space-3;
  align-items: center;

  img {
    width: 56px;
    height: 70px;
    object-fit: cover;
    border-radius: $radius-sm;
  }

  span {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }
}

.stage {
  position: relative;
  display: grid;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, #1a1b1f 0%, #0c0d0f 72%);
  border-radius: $radius-md;
  place-items: center;

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    // 前置摄像头镜像，符合自拍直觉
    transform: scaleX(-1);
  }

  &__shot {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    padding: 0 $space-5;
    font-size: $font-size-xs;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
  }
}

.corner {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.6);

  &--tl {
    top: 16px;
    left: 16px;
    border-right: 0;
    border-bottom: 0;
  }

  &--tr {
    top: 16px;
    right: 16px;
    border-bottom: 0;
    border-left: 0;
  }

  &--bl {
    bottom: 16px;
    left: 16px;
    border-top: 0;
    border-right: 0;
  }

  &--br {
    right: 16px;
    bottom: 16px;
    border-top: 0;
    border-left: 0;
  }
}

.hint {
  margin: 0;
  font-size: 11.5px;
  color: $color-text-placeholder;

  &--error {
    color: $color-danger;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  align-items: center;
}
</style>
