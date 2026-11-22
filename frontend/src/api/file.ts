import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'

/**
 * 文件上传
 * ----------------------------------------------------------------------------
 * 后端契约：POST /api/v1/files，multipart/form-data，字段 file
 * 返回：{ fileId, url, name, size }
 *
 * 上传进度由 utils/request.ts 的 onUploadProgress 推进；mock 下用定时器模拟
 * 同样的节奏，保证「上传中 xx% → 完成 → 失败可重试」这条交互能被演示和验收。
 */

export interface UploadedFile {
  fileId: string
  /** 可公开访问的地址，mock 下为空串（预览仍用本地 objectURL） */
  url: string
  name: string
  size: number
}

export interface UploadFileOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export async function uploadFile(file: File, options: UploadFileOptions = {}): Promise<UploadedFile> {
  const { onProgress, signal } = options

  if (USE_MOCK) {
    for (const percent of [12, 34, 58, 76, 92, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 110))
      if (signal?.aborted) throw new Error('已取消上传')
      onProgress?.(percent)
    }
    return {
      fileId: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url: '',
      name: file.name,
      size: file.size,
    }
  }

  const form = new FormData()
  form.append('file', file, file.name)
  return http.upload<UploadedFile>('/files', form, { onProgress, signal, timeout: 120000 })
}
