<script setup lang="ts">
/**
 * 摄像头与工位绑定
 * ----------------------------------------------------------------------------
 * 现场最容易出错的一步：换机位后没改绑定，事件就记到了别人名下。
 * 所以这里除了改名字和工位，还要把「当前绑定」写在标题下方让教师核对。
 */
import { computed, reactive, watch } from 'vue'

import type { CameraChannel } from '@/types/cooking'

const props = defineProps<{ modelValue: boolean; channel: CameraChannel | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [patch: { name: string; station: string }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const form = reactive({ name: '', station: '' })

watch(visible, (open) => {
  if (!open || !props.channel) return
  form.name = props.channel.name
  form.station = props.channel.station
})

function submit(): void {
  if (!props.channel) return
  emit('save', { name: form.name.trim() || props.channel.name, station: form.station.trim() })
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" title="摄像头绑定" width="440px" :close-on-click-modal="false">
    <p class="tip">
      通道 {{ channel?.id }} 当前绑定工位 <strong>{{ channel?.station }}</strong>。
      改动后该通道后续的识别事件都会记到新工位名下，操作会写入设备日志。
    </p>

    <el-form label-position="top">
      <el-form-item label="通道名称">
        <el-input v-model="form.name" maxlength="24" placeholder="如：工位 02 · 正前方" />
      </el-form-item>
      <el-form-item label="绑定工位">
        <el-input v-model="form.station" maxlength="8" placeholder="如：02" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存绑定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.tip {
  padding: 8px 10px;
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-sm;

  strong {
    color: $color-text-primary;
  }
}
</style>
