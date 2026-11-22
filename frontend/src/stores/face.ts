import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'

import { checkinFace, fetchFaceRecords } from '@/api/face'
import type { FaceCheckinResult, FaceRecord, FaceRecordQuery, FaceScanStatus } from '@/types'

/**
 * 人脸签到状态机与记录
 * ----------------------------------------------------------------------------
 * 分页与筛选条件也放在 store：教师从筛选后的列表点进详情、切到别的模块再回来，
 * 条件不应该被重置（甲方要求「按业务需要恢复查询条件」，会话内切页面同理）。
 */
const DEFAULT_QUERY: FaceRecordQuery = {
  page: 1,
  pageSize: 8,
  keyword: '',
  studentKeyword: '',
  className: '',
  status: '',
  dateStart: '',
  dateEnd: '',
}

export const useFaceStore = defineStore('face', () => {
  const status = ref<FaceScanStatus>('idle')
  const latest = ref<FaceCheckinResult | null>(null)
  const records = ref<FaceRecord[]>([])
  const total = ref(0)
  const loadingRecords = ref(false)
  const recordError = ref('')
  const query = reactive<FaceRecordQuery>({ ...DEFAULT_QUERY })
  /**
   * 数据范围：学生只能看自己的记录。
   * 放在 store 而不是页面，是因为签到成功后 store 内部也会刷新列表，
   * 只在页面模板上做 v-if 挡不住这条路径，会把全班记录又拉回来。
   */
  const scopeStudentId = ref<number | null>(null)

  function setScope(studentId: number | null): void {
    scopeStudentId.value = studentId
    query.studentId = studentId ?? undefined
  }

  const similarityText = computed(() =>
    latest.value ? `${(latest.value.similarity * 100).toFixed(1)}%` : '—',
  )

  /** 多人同框结果；单人时也是长度为 1 的数组，模板不用写两套分支 */
  const matches = computed(() => latest.value?.matches ?? [])

  async function loadRecords(params: Partial<FaceRecordQuery> = {}): Promise<void> {
    Object.assign(query, params)
    // 范围是硬约束：任何调用方（含签到成功后的自动刷新）都覆盖不掉
    if (scopeStudentId.value) query.studentId = scopeStudentId.value
    loadingRecords.value = true
    recordError.value = ''
    try {
      const result = await fetchFaceRecords({ ...query })
      records.value = result.list
      total.value = result.total
    } catch (error) {
      recordError.value = error instanceof Error ? error.message : '签到记录加载失败'
      records.value = []
      total.value = 0
    } finally {
      loadingRecords.value = false
    }
  }

  function resetQuery(): void {
    Object.assign(query, DEFAULT_QUERY)
  }

  function markScanning(): void {
    status.value = 'scanning'
  }

  async function checkin(frame: Blob, userId?: number): Promise<FaceCheckinResult | null> {
    status.value = 'scanning'
    try {
      const result = await checkinFace(frame, userId)
      latest.value = result
      // 重复签到与未注册都算「未通过」，但文案不同——由 message 枚举决定
      status.value = result.success ? 'success' : 'failed'
      if (result.success) void loadRecords({ page: 1 })
      return result
    } catch (error) {
      status.value = 'failed'
      latest.value = {
        success: false,
        user: null,
        timestamp: new Date().toISOString(),
        similarity: 0,
        message: error instanceof Error && error.message.includes('超时') ? 'timeout' : 'network',
      }
      return null
    }
  }

  function reset(): void {
    status.value = 'idle'
    latest.value = null
  }

  return {
    status,
    latest,
    matches,
    records,
    total,
    query,
    loadingRecords,
    recordError,
    similarityText,
    scopeStudentId,
    setScope,
    loadRecords,
    resetQuery,
    markScanning,
    checkin,
    reset,
  }
})
