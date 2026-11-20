<script setup lang="ts">
/**
 * 申请开通（注册）
 * ----------------------------------------------------------------------------
 * 分三步：填身份信息 → 采集人脸照片 → 提交等待审核。
 * 人脸照片是能走「人脸识别签到」的前提，所以在注册阶段就采集，
 * 管理员在用户管理里能直接看到这张照片，用于人工核验。
 *
 * 采集方式两种：摄像头现场拍（推荐，光照与角度可控）、本地上传（补录用）。
 * 照片统一压到 480px 宽再提交，避免把几 MB 的原图塞进请求体。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

import AppLogo from '@/components/AppLogo.vue'
import { registerAccount } from '@/api/auth'
import { compressImage } from '@/utils/faceCapture'
import type { RegisterPayload, UserRole } from '@/types'

const router = useRouter()

// ---------- 步骤 ----------
const STEP_TITLES = ['账号与身份', '人脸照片', '提交审核']
const step = ref(0)

// ---------- 表单 ----------
const formRef = ref<FormInstance>()
const form = reactive({
  name: '',
  username: '',
  password: '',
  confirmPassword: '',
  role: 'student' as UserRole,
  department: '',
  studentNo: '',
  phone: '',
})

const rules = computed<FormRules<typeof form>>(() => ({
  name: [{ required: true, message: '请填写真实姓名', trigger: 'blur' }],
  username: [
    { required: true, message: '请设置登录账号', trigger: 'blur' },
    { min: 4, message: '账号至少 4 位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字与下划线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请设置密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  department: [{ required: true, message: '请填写班级或教研室', trigger: 'blur' }],
  studentNo: [
    {
      validator: (_rule, value, callback) => {
        if (form.role === 'student' && !value) callback(new Error('学生需填写学号'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  phone: [
    { required: true, message: '请填写手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
}))

const roleOptions = [
  { value: 'student' as UserRole, label: '学生', hint: '参加实训、查看自己的成绩' },
  { value: 'teacher' as UserRole, label: '教师', hint: '管理班级、确认成绩' },
]

// ---------- 人脸采集 ----------
const videoRef = ref<HTMLVideoElement>()
const stream = ref<MediaStream | null>(null)
const cameraOn = ref(false)
const cameraError = ref('')
const facePhoto = ref('')
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
    // 预览是镜像的，存下来的照片翻转回真实方向，避免和身份证照片左右相反
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    facePhoto.value = await compressImage(canvas.toDataURL('image/jpeg', 0.9))
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
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  busy.value = true
  try {
    facePhoto.value = await compressImage(file)
    closeCamera()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '图片处理失败')
  } finally {
    busy.value = false
    input.value = ''
  }
}

function retake(): void {
  facePhoto.value = ''
}

// ---------- 步骤流转 ----------
async function nextFromForm(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  step.value = 1
}

async function nextFromFace(): Promise<void> {
  if (!facePhoto.value) {
    ElMessage.warning('请先拍摄或上传一张人脸照片')
    return
  }
  busy.value = true
  try {
    const payload: RegisterPayload = {
      name: form.name,
      username: form.username,
      password: form.password,
      role: form.role,
      phone: form.phone,
      department: form.department,
      studentNo: form.role === 'student' ? form.studentNo : undefined,
      facePhoto: facePhoto.value,
    }
    await registerAccount(payload)
    step.value = 2
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

function back(): void {
  if (step.value === 1) closeCamera()
  step.value = Math.max(0, step.value - 1)
}

function goLogin(): void {
  void router.push('/login')
}

onBeforeUnmount(closeCamera)
</script>

<template>
  <div class="register">
    <div class="register__logo">
      <AppLogo />
    </div>

    <header class="register__head">
      <h1>申请开通</h1>
      <p>填写身份信息并采集一张人脸照片，提交后由学校管理员审核。</p>
    </header>

    <!-- 步骤条 -->
    <ol class="steps">
      <li
        v-for="(title, i) in STEP_TITLES"
        :key="title"
        class="steps__item"
        :class="{ 'is-active': step === i, 'is-done': step > i }"
      >
        <span class="steps__num">{{ step > i ? '✓' : i + 1 }}</span>
        <span class="steps__label">{{ title }}</span>
      </li>
    </ol>

    <!-- 第一步 -->
    <el-form
      v-if="step === 0"
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="register__form"
      @submit.prevent="nextFromForm"
    >
      <el-form-item label="身份" prop="role">
        <div class="role-group">
          <button
            v-for="opt in roleOptions"
            :key="opt.value"
            type="button"
            class="role"
            :class="{ 'is-active': form.role === opt.value }"
            @click="form.role = opt.value"
          >
            <strong>{{ opt.label }}</strong>
            <span>{{ opt.hint }}</span>
          </button>
        </div>
      </el-form-item>

      <div class="register__row">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="与身份证一致" maxlength="20" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="用于接收审核结果" maxlength="11" />
        </el-form-item>
      </div>

      <el-form-item :label="form.role === 'student' ? '班级' : '教研室'" prop="department">
        <el-input
          v-model="form.department"
          :placeholder="form.role === 'student' ? '如：烹饪工艺与营养 2301' : '如：烹饪工艺教研室'"
        />
      </el-form-item>

      <el-form-item v-if="form.role === 'student'" label="学号" prop="studentNo">
        <el-input v-model="form.studentNo" placeholder="10 位学号" maxlength="20" />
      </el-form-item>

      <div class="register__row">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" placeholder="字母、数字或下划线" maxlength="24" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
      </div>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再输入一次" />
      </el-form-item>

      <button type="submit" class="register__submit" :disabled="busy">下一步：采集人脸</button>
    </el-form>

    <!-- 第二步：人脸采集 -->
    <div v-else-if="step === 1" class="face">
      <div class="face__stage">
        <video v-show="cameraOn && !facePhoto" ref="videoRef" class="face__video" muted playsinline />

        <img v-if="facePhoto" :src="facePhoto" alt="已采集的人脸照片预览" class="face__shot" />

        <div v-if="!cameraOn && !facePhoto" class="face__empty">
          <p>尚未采集照片</p>
          <span>建议在光线均匀的墙面前拍摄，正脸、不戴帽子与口罩</span>
        </div>

        <!-- 取景引导框：只在摄像头开启时出现 -->
        <div v-if="cameraOn && !facePhoto" class="face__guide" aria-hidden="true">
          <span class="face__corner face__corner--tl" />
          <span class="face__corner face__corner--tr" />
          <span class="face__corner face__corner--bl" />
          <span class="face__corner face__corner--br" />
        </div>
      </div>

      <p v-if="cameraError" class="face__error">{{ cameraError }}</p>

      <div class="face__actions">
        <template v-if="facePhoto">
          <button type="button" class="btn btn--ghost" @click="retake">重新采集</button>
          <button type="button" class="btn btn--primary" :disabled="busy" @click="nextFromFace">
            {{ busy ? '提交中…' : '提交审核' }}
          </button>
        </template>

        <template v-else-if="cameraOn">
          <button type="button" class="btn btn--ghost" @click="closeCamera">关闭摄像头</button>
          <button type="button" class="btn btn--primary" :disabled="busy" @click="shoot">拍摄照片</button>
        </template>

        <template v-else>
          <button type="button" class="btn btn--primary" @click="openCamera">打开摄像头</button>
          <button type="button" class="btn btn--ghost" @click="fileInput?.click()">上传照片</button>
        </template>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="face__file"
        @change="onFileChange"
      />

      <p class="face__note">
        照片仅用于实训签到时的身份比对，保存在学校服务器，不做其他用途。
      </p>

      <button type="button" class="register__back" @click="back">返回上一步</button>
    </div>

    <!-- 第三步：提交完成 -->
    <div v-else class="done">
      <span class="done__mark" aria-hidden="true">✓</span>
      <h2>已提交，等待审核</h2>
      <p>
        管理员审核通过后即可用账号
        <strong>{{ form.username }}</strong>
        登录。审核结果会通过短信发送到 {{ form.phone }}。
      </p>
      <button type="button" class="btn btn--primary" @click="goLogin">返回登录</button>
    </div>

    <p v-if="step !== 2" class="register__foot">
      已有账号？<button type="button" @click="goLogin">直接登录</button>
    </p>
  </div>
</template>

<style scoped lang="scss">
.register {
  width: 100%;
  max-width: 480px;

  &__logo {
    display: none;
    margin-bottom: $space-6;
  }

  &__head {
    margin-bottom: $space-6;

    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
      letter-spacing: -0.02em;
    }

    p {
      margin: 8px 0 0;
      font-size: $font-size-sm;
      line-height: 1.7;
      color: $color-text-secondary;
    }
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
  }

  &__form {
    :deep(.el-form-item) {
      margin-bottom: $space-4;
    }

    :deep(.el-form-item__label) {
      padding-bottom: 4px;
      font-size: $font-size-sm;
      color: $color-text-regular;
    }
  }

  &__submit {
    width: 100%;
    height: 44px;
    margin-top: $space-2;
    font-family: inherit;
    font-size: 15px;
    font-weight: $font-weight-medium;
    color: #fff;
    cursor: pointer;
    background: $color-primary;
    border: 0;
    border-radius: $radius-md;
    transition: background-color $duration-fast $ease-standard;

    &:hover {
      background: $color-primary-hover;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__back {
    display: block;
    margin-top: $space-4;
    font-family: inherit;
    font-size: $font-size-sm;
    color: $color-text-secondary;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: $color-text-primary;
    }
  }

  &__foot {
    margin: $space-5 0 0;
    font-size: $font-size-sm;
    color: $color-text-secondary;
    text-align: center;

    button {
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      color: $color-primary;
      cursor: pointer;
      background: none;
      border: 0;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

// ---------- 步骤条 ----------
.steps {
  display: flex;
  gap: $space-2;
  padding: 0;
  margin: 0 0 $space-6;
  list-style: none;

  &__item {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: center;
    padding-top: 10px;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
    border-top: 2px solid $color-border-light;
    transition:
      color $duration-fast $ease-standard,
      border-color $duration-fast $ease-standard;

    &.is-active {
      color: $color-text-primary;
      border-top-color: $color-primary;
    }

    &.is-done {
      color: $color-text-regular;
      border-top-color: $color-border-strong;
    }
  }

  &__num {
    display: grid;
    width: 18px;
    height: 18px;
    font-family: $font-family-mono;
    font-size: 10px;
    background: $color-bg-subtle;
    border-radius: 50%;
    place-items: center;
  }

  &__item.is-active &__num {
    color: #fff;
    background: $color-primary;
  }

  &__label {
    white-space: nowrap;
  }
}

// ---------- 身份选择 ----------
.role-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-2;
  width: 100%;
}

.role {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: $color-bg-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  transition:
    border-color $duration-fast $ease-standard,
    background-color $duration-fast $ease-standard;

  strong {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  span {
    font-size: 11px;
    color: $color-text-secondary;
  }

  &:hover {
    border-color: $color-border-strong;
  }

  &.is-active {
    background: $color-primary-soft;
    border-color: $color-primary;
  }
}

// ---------- 人脸采集 ----------
.face {
  &__stage {
    position: relative;
    overflow: hidden;
    background: #101012;
    border-radius: $radius-lg;
    aspect-ratio: 4 / 3;
  }

  &__video,
  &__shot {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__video {
    // 预览镜像，符合照镜子的直觉；存储时已经翻回真实方向
    transform: scaleX(-1);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 $space-6;
    text-align: center;

    p {
      margin: 0;
      font-size: $font-size-sm;
      color: rgba(255, 255, 255, 0.72);
    }

    span {
      font-size: $font-size-xs;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.36);
    }
  }

  &__guide {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 58%;
    height: 74%;
    pointer-events: none;
    border-radius: 24px;
    transform: translate(-50%, -50%);
  }

  &__corner {
    position: absolute;
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.85);

    &--tl {
      top: 0;
      left: 0;
      border-right: 0;
      border-bottom: 0;
      border-radius: 8px 0 0;
    }

    &--tr {
      top: 0;
      right: 0;
      border-bottom: 0;
      border-left: 0;
      border-radius: 0 8px 0 0;
    }

    &--bl {
      bottom: 0;
      left: 0;
      border-top: 0;
      border-right: 0;
      border-radius: 0 0 0 8px;
    }

    &--br {
      right: 0;
      bottom: 0;
      border-top: 0;
      border-left: 0;
      border-radius: 0 0 8px;
    }
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-2;
    margin-top: $space-3;
  }

  &__file {
    display: none;
  }

  &__error {
    margin: $space-2 0 0;
    font-size: $font-size-xs;
    color: $color-danger;
  }

  &__note {
    margin: $space-3 0 0;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: $color-text-placeholder;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 $space-4;
  font-family: inherit;
  font-size: 14px;
  font-weight: $font-weight-medium;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: $radius-md;
  transition:
    background-color $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard;

  &--primary {
    color: #fff;
    background: $color-primary;
    border-color: $color-primary;

    &:hover {
      background: $color-primary-hover;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &--ghost {
    color: $color-text-primary;
    background: $color-bg-surface;
    border-color: $color-border;

    &:hover {
      border-color: $color-border-strong;
    }
  }
}

// ---------- 完成 ----------
.done {
  padding: $space-6 0;
  text-align: center;

  &__mark {
    display: grid;
    width: 48px;
    height: 48px;
    margin: 0 auto $space-4;
    font-size: 22px;
    color: $color-success;
    background: $color-success-soft;
    border-radius: 50%;
    place-items: center;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  p {
    margin: $space-3 0 $space-6;
    font-size: $font-size-sm;
    line-height: 1.8;
    color: $color-text-secondary;
  }

  .btn {
    width: 100%;
  }
}

@media (max-width: $breakpoint-lg) {
  .register {
    max-width: none;

    &__logo {
      display: block;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .register__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .steps__label {
    display: none;
  }

  .steps__item {
    justify-content: center;
  }
}
</style>
