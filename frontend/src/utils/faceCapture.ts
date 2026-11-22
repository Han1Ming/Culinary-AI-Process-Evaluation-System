/**
 * 人脸采集工具
 * ----------------------------------------------------------------------------
 * captureFrame —— 从 <video> 截一帧为 JPEG Blob（送入 /api/v1/face/checkin）
 * compressImage —— 注册 / 上传前把图压到 480px 宽、q0.82
 *
 * Mock 识别已移到 mock/face.ts：它要模拟多人同框、重复签到，
 * 比「随机返回一个学生」更接近真实联调场景。
 */

/**
 * 从视频元素截取一帧
 * @param video 已播放中的 <video>
 * @param quality JPEG 质量，默认 0.85
 */
export function captureFrame(video: HTMLVideoElement, quality = 0.85): Promise<Blob> {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('无法创建 Canvas 上下文，当前浏览器不支持截帧'))
  }

  // 画面上是镜像的，截帧保持原始方向交给后端比对，避免影响人脸特征
  ctx.drawImage(video, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('画面截取失败，请重试'))
      },
      'image/jpeg',
      quality,
    )
  })
}

/** 将 Blob 转成可直接用于 <img> 的地址（调试预览用） */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

/**
 * 把图片压缩成适合上传的 dataURL
 * @param source 图片 Blob 或原始 dataURL
 * @param maxWidth 输出最大宽度，默认 480
 * @param quality JPEG 质量，默认 0.82
 */
export function compressImage(source: Blob | string, maxWidth = 480, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('浏览器不支持图片压缩'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
      if (typeof source !== 'string') URL.revokeObjectURL(img.src)
    }

    img.onerror = () => reject(new Error('图片读取失败，请换一张试试'))

    if (typeof source === 'string') {
      img.src = source
    } else {
      img.src = URL.createObjectURL(source)
    }
  })
}
