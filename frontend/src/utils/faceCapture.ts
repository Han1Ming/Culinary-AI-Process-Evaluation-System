import type { FaceCheckinResult, FaceRecord, FaceUser } from '@/types'

/**
 * 人脸采集工具
 * - captureFrame：从 <video> 截一帧为 JPEG Blob（送入后端 /api/face/checkin）
 * - mockCheckin：后端未就绪时的本地模拟，1.2s 后返回成功结果
 */

const MOCK_STUDENTS: FaceUser[] = [
  { id: 1001, name: '陈子豪', studentNo: '2023010101', className: '烹饪工艺与营养 2301' },
  { id: 1002, name: '李思影', studentNo: '2023010102', className: '烹饪工艺与营养 2301' },
  { id: 1003, name: '王皓然', studentNo: '2023010128', className: '西餐工艺 2302' },
]

export const MOCK_FACE_STUDENTS = MOCK_STUDENTS

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
 * ----------------------------------------------------------------------------
 * 注册时采集的人脸照片只用于比对，480px 宽足够，超过 200KB 的图会拖慢提交。
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

/**
 * Mock 签到：模拟 1.2s 网络延迟后返回成功结果
 * 用于后端人脸比对接口尚未就绪时的完整演示
 */
export function mockCheckin(delay = 1200): Promise<FaceCheckinResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const student = MOCK_STUDENTS[Math.floor(Math.random() * MOCK_STUDENTS.length)]
      resolve({
        success: true,
        user: student,
        timestamp: new Date().toISOString(),
        similarity: Number((0.92 + Math.random() * 0.06).toFixed(3)),
        message: '签到成功',
      })
    }, delay)
  })
}

/** 由签到结果生成一条记录，供列表展示 */
export function createRecordFromResult(result: FaceCheckinResult): FaceRecord {
  return {
    id: `rec_${Date.now()}`,
    name: result.user?.name ?? '未知用户',
    studentNo: result.user?.studentNo ?? '—',
    className: result.user?.className ?? '—',
    timestamp: result.timestamp,
    similarity: result.similarity,
    status: result.success ? 'success' : 'failed',
  }
}
