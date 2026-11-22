import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import { FACE_ERROR_MESSAGES } from '@/types'
import type { FaceDeviceInfo } from '@/types'

/**
 * useCamera：摄像头生命周期封装
 * - 设备选择（enumerateDevices）+ 前后摄像头兜底（facingMode）
 * - 权限 / 设备 / 占用异常统一转成中文提示
 * - 组件卸载自动关闭摄像头，避免指示灯常亮
 *
 * 注意：浏览器在拿到权限前不返回设备 label，所以设备列表要等首次 start() 成功后再刷新。
 */

export interface UseCameraOptions {
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
  /** 首选设备，为空时按 facingMode 取默认 */
  deviceId?: string
}

export function useCamera(options: UseCameraOptions = {}) {
  const { width = 640, height = 480, facingMode = 'user', deviceId = '' } = options

  const videoRef = ref<HTMLVideoElement | null>(null)
  const stream = shallowRef<MediaStream | null>(null)
  const active = ref(false)
  const error = ref<string | null>(null)
  const devices = ref<FaceDeviceInfo[]>([])
  const currentDeviceId = ref(deviceId)

  function mapError(err: unknown): string {
    const name = (err as { name?: string }).name ?? ''
    if (name === 'NotAllowedError' || name === 'SecurityError') return FACE_ERROR_MESSAGES.camera_denied
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return FACE_ERROR_MESSAGES.camera_missing
    if (name === 'NotReadableError' || name === 'AbortError') return FACE_ERROR_MESSAGES.camera_busy
    return '摄像头启动失败，请检查设备占用情况'
  }

  async function refreshDevices(): Promise<FaceDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return devices.value
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      devices.value = list
        .filter((item) => item.kind === 'videoinput')
        .map((item, index) => ({
          deviceId: item.deviceId,
          // 未授权时 label 为空，用序号兜底，避免下拉出现一排空白
          label: item.label || `摄像头 ${index + 1}`,
          kind: 'videoinput' as const,
        }))
    } catch {
      // 枚举失败不影响主流程
    }
    return devices.value
  }

  function stop(): void {
    stream.value?.getTracks().forEach((track) => track.stop())
    stream.value = null
    active.value = false
    if (videoRef.value) videoRef.value.srcObject = null
  }

  async function start(nextDeviceId?: string): Promise<boolean> {
    if (active.value) {
      if (nextDeviceId && nextDeviceId !== currentDeviceId.value) {
        stop()
      } else {
        return true
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = '当前浏览器不支持摄像头调用，请使用 Chrome / Edge 最新版'
      return false
    }

    const target = nextDeviceId ?? currentDeviceId.value
    const constraints: MediaStreamConstraints = {
      video: target
        ? { deviceId: { exact: target }, width: { ideal: width }, height: { ideal: height } }
        : { facingMode, width: { ideal: width }, height: { ideal: height } },
      audio: false,
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      stream.value = mediaStream
      active.value = true
      error.value = null
      currentDeviceId.value = target

      const video = videoRef.value
      if (video) {
        video.srcObject = mediaStream
        await video.play().catch(() => {
          // 部分浏览器自动播放策略限制，用户点击后即可播放
        })
      }
      void refreshDevices()
      return true
    } catch (err) {
      error.value = mapError(err)
      active.value = false
      return false
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return { videoRef, stream, active, error, devices, currentDeviceId, start, stop, refreshDevices }
}
