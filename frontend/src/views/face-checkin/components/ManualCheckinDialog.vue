<script setup lang="ts">
/**
 * 教师人工补签
 * ----------------------------------------------------------------------------
 * 补签不是「偷偷改数据」，而是留痕操作：补签人、补签时间、原因三项必须齐全，
 * 记录里以「教师补签」状态单独展示，不混进 AI 成功记录。
 */
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { manualCheckin } from '@/api/face'
import { mockStudents } from '@/mock/students'
import type { FaceRecord } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submitted: [record: FaceRecord]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const submitting = ref(false)
const formRef = ref()
const form = reactive({
  studentId: 0,
  at: '',
  reason: '',
})

const rules = {
  studentId: [{ required: true, message: '请选择学生', trigger: 'change' }],
  at: [{ required: true, message: '请选择补签时间', trigger: 'change' }],
  reason: [
    { required: true, message: '请填写补签原因', trigger: 'blur' },
    { min: 4, max: 200, message: '原因 4–200 字，便于事后追溯', trigger: 'blur' },
  ],
}

const selected = computed(() => mockStudents.find((stu) => stu.id === form.studentId))

function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/** 每次打开重置，避免上一次的选人与原因残留在下一次操作里 */
watch(visible, (open) => {
  if (!open) return
  form.studentId = 0
  form.at = nowLocal()
  form.reason = ''
  formRef.value?.clearValidate()
})

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const student = selected.value
  if (!student) return

  submitting.value = true
  try {
    const record = await manualCheckin({
      studentId: student.id,
      studentName: student.name,
      studentNo: student.studentNo,
      className: student.className,
      seat: student.seat,
      at: new Date(form.at).toISOString(),
      reason: form.reason.trim(),
    })
    ElMessage.success(`已为 ${student.name} 补签，操作已记录`)
    emit('submitted', record)
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '补签失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="人工补签" width="480px" :close-on-click-modal="false">
    <p class="tip">
      补签会以「教师补签」状态单独入库，并记录操作人、时间与原因；不覆盖任何 AI 识别结果。
    </p>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="学生" prop="studentId">
        <el-select v-model="form.studentId" filterable placeholder="按姓名或学号搜索" class="full">
          <el-option
            v-for="stu in mockStudents"
            :key="stu.id"
            :label="`${stu.name} · ${stu.studentNo} · ${stu.className}`"
            :value="stu.id"
          />
        </el-select>
      </el-form-item>

      <div class="row">
        <el-form-item label="补签时间" prop="at" class="row__item">
          <el-date-picker
            v-model="form.at"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择签到时间"
            class="full"
          />
        </el-form-item>
        <el-form-item label="工位" class="row__item">
          <el-input :model-value="selected?.seat ?? '—'" disabled />
        </el-form-item>
      </div>

      <el-form-item label="补签原因" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="例如：摄像头逆光连续三次识别失败，现场核对学生证后补签"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确认补签</el-button>
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
}

.row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: $space-3;
}

.full {
  width: 100%;
}
</style>
