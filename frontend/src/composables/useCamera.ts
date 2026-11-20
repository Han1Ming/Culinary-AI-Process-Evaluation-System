import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import { FACE_ERROR_MESSAGES } from '@/types'

/**
 * useCamera：摄像头生命周期封装
 * - 前后摄像头切换（facingMode）
 * - 权限 / 设备异常统一转成中文提示
 * - 组件卸载自动关闭摄像头，避免指示灯常亮
 */

export interface UseCameraOptions {
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
}

export function useCamera(options: UseCameraOptions = {}) {
  const { width = 640, height = 480, facingMode = 'user' } = options

  const videoRef = ref<HTMLVideoElement | null>(null)
  const stream = shallowRef<MediaStream | null>(null)
  const active = ref(false)
  const error = ref<string | null>(null)

  async function start(): Promise<boolean> {
    if (active.value) return true

    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = '当前浏览器不支持摄像头调用，请使用 Chrome / Edge 最新版'
      return false
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: width }, height: { ideal: height } },
        audio: false,
      })
      stream.value = mediaStream
      active.value = true
      error.value = null

      const video = videoRef.value
      if (video) {
        video.srcObject = mediaStream
        await video.play().catch(() => {
          // 部分浏览器自动播放策略限制，用户点击后即可播放
        })
      }
      return true
    } catch (err) {
      const name = (err as { name?: string }).name ?? ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        error.value = FACE_ERROR_MESSAGES.camera_denied
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        error.value = FACE_ERROR_MESSAGES.camera_missing
      } else {
        error.value = '摄像头启动失败，请检查设备占用情况'
      }
      active.value = false
      return false
    }
  }

  function stop(): void {
    stream.value?.getTracks().forEach((track) => track.stop())
    stream.value = null
    active.value = false
    if (videoRef.value) videoRef.value.srcObject = null
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return { videoRef, stream, active, error, start, stop }
}
