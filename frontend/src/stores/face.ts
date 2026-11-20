import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { checkinFace, fetchFaceRecords } from '@/api/face'
import { createRecordFromResult } from '@/utils/faceCapture'
import type { FaceCheckinResult, FaceRecord, FaceScanStatus } from '@/types'

/** 人脸签到状态机与记录 */
export const useFaceStore = defineStore('face', () => {
  const status = ref<FaceScanStatus>('idle')
  const latest = ref<FaceCheckinResult | null>(null)
  const records = ref<FaceRecord[]>([])
  const loadingRecords = ref(false)
  const errorMessage = ref('')

  const similarityText = computed(() =>
    latest.value ? `${(latest.value.similarity * 100).toFixed(1)}%` : '—',
  )

  async function loadRecords(limit = 8): Promise<void> {
    loadingRecords.value = true
    try {
      records.value = await fetchFaceRecords(limit)
    } catch {
      // 记录为弱依赖，失败不阻塞签到
    } finally {
      loadingRecords.value = false
    }
  }

  function markScanning(): void {
    status.value = 'scanning'
    errorMessage.value = ''
  }

  async function checkin(frame: Blob, userId?: number): Promise<FaceCheckinResult | null> {
    status.value = 'scanning'
    errorMessage.value = ''
    try {
      const result = await checkinFace(frame, userId)
      latest.value = result
      if (result.success) {
        status.value = 'success'
        records.value = [createRecordFromResult(result), ...records.value].slice(0, 12)
      } else {
        status.value = 'failed'
        errorMessage.value = result.message || '人脸比对未通过，请重试'
        records.value = [createRecordFromResult(result), ...records.value].slice(0, 12)
      }
      return result
    } catch (error) {
      status.value = 'failed'
      errorMessage.value = error instanceof Error ? error.message : '签到失败，请稍后重试'
      return null
    }
  }

  function reset(): void {
    status.value = 'idle'
    latest.value = null
    errorMessage.value = ''
  }

  return {
    status,
    latest,
    records,
    loadingRecords,
    errorMessage,
    similarityText,
    loadRecords,
    markScanning,
    checkin,
    reset,
  }
})
