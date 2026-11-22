<script setup lang="ts">
/**
 * 人脸信息管理
 * ----------------------------------------------------------------------------
 * 甲方要求：提供人脸注册、更新、注销的管理入口，并展示用途、授权与数据管理提示。
 * 三条纪律：
 *   1. 采集前先看到用途与撤销方式（个人信息保护法「告知—同意」）；
 *   2. 更新和注销都要二次确认，注销必须写原因；
 *   3. 页面只展示「是否已注册」，不展示特征值，也不提供批量导出。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { fetchFaceProfiles, registerFace, revokeFace } from '@/api/face'
import { compressImage } from '@/utils/faceCapture'
import { askReason, confirmAction } from '@/utils/confirm'
import { formatDateTime } from '@/utils/format'
import { FACE_RULE, validateFile } from '@/utils/upload'
import type { FaceProfile } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const error = ref('')
const profiles = ref<FaceProfile[]>([])
const busyId = ref(0)
const fileInput = ref<HTMLInputElement>()
const pendingUserId = ref(0)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    profiles.value = await fetchFaceProfiles()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '人脸底库加载失败'
  } finally {
    loading.value = false
  }
}

watch(visible, (open) => {
  if (open) void load()
})

function pickFor(userId: number): void {
  pendingUserId.value = userId
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const invalid = validateFile(file, FACE_RULE)
  if (invalid) {
    ElMessage.warning(invalid)
    return
  }

  busyId.value = pendingUserId.value
  try {
    const photo = await compressImage(file, 480, 0.82)
    const updated = await registerFace(pendingUserId.value, photo)
    const index = profiles.value.findIndex((item) => item.userId === updated.userId)
    if (index >= 0) profiles.value[index] = updated
    else profiles.value.unshift(updated)
    ElMessage.success(`${updated.name} 的人脸已更新`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '人脸更新失败')
  } finally {
    busyId.value = 0
  }
}

async function revoke(profile: FaceProfile): Promise<void> {
  const ok = await confirmAction({
    title: '注销人脸',
    message: `注销后 ${profile.name} 将无法刷脸签到，历史签到记录保留。重新注册需要现场重新采集。`,
    confirmText: '确认注销',
    dangerous: true,
  })
  if (!ok) return

  const reason = await askReason({
    title: '注销原因',
    message: '原因会写入操作日志，用于个人信息处理的合规审计。',
    placeholder: '例如：学生申请撤回授权',
  })
  if (!reason) return

  busyId.value = profile.userId
  try {
    await revokeFace(profile.userId)
    profile.photo = undefined
    profile.status = 'revoked'
    profile.registeredAt = undefined
    ElMessage.success(`已注销 ${profile.name} 的人脸信息（原因：${reason}）`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '注销失败')
  } finally {
    busyId.value = 0
  }
}

const registeredCount = computed(() => profiles.value.filter((p) => p.status === 'active').length)
</script>

<template>
  <el-dialog v-model="visible" title="人脸信息管理" width="720px" :close-on-click-modal="false">
    <section class="notice">
      <h4>用途与授权</h4>
      <p>
        人脸仅用于本节课的签到身份核验，不用于考勤之外的分析，不对外提供。采集前需学生本人在
        「个人信息告知书」上确认；学生可随时申请注销，注销后底库立即失效，历史签到记录保留但不含人脸特征。
      </p>
    </section>

    <header class="head">
      <span class="head__count num">已注册 {{ registeredCount }} / {{ profiles.length }} 人</span>
      <el-button size="small" :loading="loading" @click="load">刷新</el-button>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <ul v-loading="loading" class="list">
      <li v-for="profile in profiles" :key="profile.userId" class="row">
        <el-avatar :size="34" :src="profile.photo">{{ profile.name.slice(0, 1) }}</el-avatar>

        <div class="row__body">
          <p class="row__name">
            {{ profile.name }}
            <span class="row__state" :class="`is-${profile.status}`">
              {{ profile.status === 'active' ? '已注册' : profile.status === 'revoked' ? '已注销' : '未注册' }}
            </span>
          </p>
          <span class="row__meta num">
            {{ profile.studentNo }} · {{ profile.className }}
            <template v-if="profile.registeredAt"> · 采集于 {{ formatDateTime(profile.registeredAt) }}</template>
          </span>
        </div>

        <div class="row__actions">
          <el-button size="small" :loading="busyId === profile.userId" @click="pickFor(profile.userId)">
            {{ profile.status === 'active' ? '更新' : '注册' }}
          </el-button>
          <el-button
            v-if="profile.status === 'active'"
            size="small"
            text
            type="danger"
            :loading="busyId === profile.userId"
            @click="revoke(profile)"
          >
            注销
          </el-button>
        </div>
      </li>
    </ul>

    <input ref="fileInput" type="file" accept="image/jpeg,image/png" class="hidden" @change="onFile" />

    <template #footer>
      <p class="foot">采集要求：正面免冠、光线均匀、不戴帽子与口罩；单张 ≤ {{ FACE_RULE.maxSizeMB }}MB。</p>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.notice {
  padding: $space-3 $space-4;
  margin-bottom: $space-4;
  background: $color-bg-subtle;
  border-radius: $radius-md;

  h4 {
    margin: 0 0 4px;
    font-size: $font-size-xs;
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

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: $space-2;
  border-bottom: 1px solid $color-border-light;

  &__count {
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

.error {
  padding: $space-3;
  margin: $space-3 0 0;
  font-size: $font-size-xs;
  color: $color-danger;
  background: $color-danger-soft;
  border-radius: $radius-sm;
}

.list {
  max-height: 420px;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.row {
  display: flex;
  gap: $space-3;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
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

  &__state {
    font-size: 10px;

    &.is-active {
      color: $color-success;
    }

    &.is-revoked {
      color: $color-danger;
    }

    &.is-none {
      color: $color-text-placeholder;
    }
  }

  &__meta {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}

.hidden {
  display: none;
}

.foot {
  margin: 0;
  font-size: 11px;
  color: $color-text-placeholder;
  text-align: left;
}
</style>
