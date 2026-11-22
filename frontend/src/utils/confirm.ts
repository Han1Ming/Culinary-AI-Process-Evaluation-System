import { ElMessageBox } from 'element-plus'

/**
 * 二次确认 / 填写原因
 * ----------------------------------------------------------------------------
 * 甲方要求：删除、归档、成绩确认、驳回等操作必须二次确认；教师修改 AI 结果
 * 必须填写原因。两件事全站都走这里，避免每页各写一份 ElMessageBox 参数：
 *   - 危险操作统一红色确认按钮 + 说明后果；
 *   - 需要留痕的操作统一弹输入框，原因少于 4 个字不予提交。
 */

export interface ConfirmOptions {
  /** 标题，写「做什么」而不是「请确认」 */
  title: string
  /** 一句话说明影响范围与是否可撤销 */
  message: string
  confirmText?: string
  cancelText?: string
  /** 危险操作：确认按钮用危险色，并默认聚焦在取消上 */
  dangerous?: boolean
}

/** 返回 true 表示用户确认；取消 / 关闭返回 false，不抛异常 */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmText = '确认', cancelText = '取消', dangerous = false } = options
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      type: dangerous ? 'warning' : 'info',
      confirmButtonClass: dangerous ? 'el-button--danger' : undefined,
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
      autofocus: false,
    })
    return true
  } catch {
    return false
  }
}

export interface ReasonOptions {
  title: string
  message?: string
  placeholder?: string
  /** 原因最少字数，默认 4 */
  minLength?: number
  confirmText?: string
}

/**
 * 填写原因后返回文本，取消返回 null。
 * 用于：教师驳回 AI 判定、修改分数、人工补签、归档异常成绩。
 */
export async function askReason(options: ReasonOptions): Promise<string | null> {
  const { title, message = '', placeholder = '写清依据，例如：画面遮挡导致误判', minLength = 4, confirmText = '提交' } = options
  try {
    const result = await ElMessageBox.prompt(message, title, {
      confirmButtonText: confirmText,
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: placeholder,
      inputValidator: (value: string) => {
        const text = (value ?? '').trim()
        if (text.length < minLength) return `请至少填写 ${minLength} 个字，便于事后追溯`
        if (text.length > 200) return '原因不超过 200 字'
        return true
      },
      closeOnClickModal: false,
    })
    return (result.value ?? '').trim()
  } catch {
    return null
  }
}
