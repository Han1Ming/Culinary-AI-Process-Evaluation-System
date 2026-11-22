/**
 * 文件校验与图片压缩
 * ----------------------------------------------------------------------------
 * 甲方要求「文件上传校验类型、大小和数量」「上传显示进度和失败原因」。
 * 校验规则集中在这里，页面只声明自己要哪一类，不要各自写 if (size > ...)。
 */

export interface FileRule {
  /** 允许的 MIME 前缀或精确值，如 'image/' 'application/pdf' */
  accept: string[]
  /** 单文件上限（MB） */
  maxSizeMB: number
  /** 一次最多几个文件，不传表示单文件 */
  maxCount?: number
  /** 展示给用户的类型说明，如「JPG / PNG」 */
  typeLabel: string
}

export const IMAGE_RULE: FileRule = {
  accept: ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeMB: 4,
  maxCount: 1,
  typeLabel: 'JPG / PNG / WebP',
}

export const FACE_RULE: FileRule = {
  accept: ['image/jpeg', 'image/png'],
  maxSizeMB: 2,
  maxCount: 1,
  typeLabel: 'JPG / PNG',
}

export const ATTACHMENT_RULE: FileRule = {
  accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxSizeMB: 10,
  maxCount: 3,
  typeLabel: 'JPG / PNG / WebP / PDF',
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function typeMatches(file: File, accept: string[]): boolean {
  const type = file.type || ''
  const name = file.name.toLowerCase()
  return accept.some((item) => {
    if (item.endsWith('/')) return type.startsWith(item)
    if (item === 'application/pdf') return type === item || name.endsWith('.pdf')
    return type === item
  })
}

/** 校验单个文件，通过返回 null，不通过返回一句可直接展示的中文原因 */
export function validateFile(file: File, rule: FileRule): string | null {
  if (!typeMatches(file, rule.accept)) {
    return `「${file.name}」格式不支持，仅接受 ${rule.typeLabel}`
  }
  if (file.size > rule.maxSizeMB * 1024 * 1024) {
    return `「${file.name}」为 ${formatFileSize(file.size)}，超过 ${rule.maxSizeMB} MB 上限`
  }
  if (file.size === 0) return `「${file.name}」是空文件`
  return null
}

/** 批量校验：一次返回可用的文件与全部错误，页面统一提示，不做「选中即静默丢弃」 */
export function validateFiles(
  files: File[],
  rule: FileRule,
): { accepted: File[]; errors: string[] } {
  const errors: string[] = []
  const max = rule.maxCount ?? 1

  if (files.length > max) {
    errors.push(`一次最多上传 ${max} 个文件，已保留前 ${max} 个`)
  }

  const accepted: File[] = []
  files.slice(0, max).forEach((file) => {
    const error = validateFile(file, rule)
    if (error) errors.push(error)
    else accepted.push(file)
  })

  return { accepted, errors }
}

/**
 * 图片压缩为 Blob（等比缩放，不裁切）
 * 成品照、签到截图上传前统一压到长边 1600 / q0.82，单张约 200–400KB。
 */
export function compressImageBlob(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('浏览器不支持图片压缩'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('图片压缩失败，请换一张试试'))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，可能已损坏'))
    }

    img.src = url
  })
}
