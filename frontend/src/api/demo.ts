import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'

/**
 * 预约演示（官网留资）
 * ----------------------------------------------------------------------------
 * 这是官网唯一的转化出口，所以在 mock 分支里也保留完整校验与编号生成，
 * 让前端在没有后端时能演示「提交 → 拿到受理编号」的全过程。
 *
 * 后端契约：POST /api/v1/demo-requests
 *   请求：{ org, name, role, phone, scale, plan, want, note? }
 *   响应：{ requestNo } —— 形如 DEMO-20261121-0431，便于电话回访时报单号
 */

export interface DemoRequestPayload {
  /** 学校或机构名称 */
  org: string
  name: string
  /** 职务：专业负责人 / 实训教师 / 信息中心 / 其他 */
  role: string
  phone: string
  /** 工位规模 */
  scale: string
  /** 意向套餐 */
  plan: string
  /** 希望的演示形式 */
  want: string
  note?: string
}

export interface DemoRequestResult {
  requestNo: string
}

/** 受理编号：日期 + 4 位序号，后端未就绪时前端先生成 */
function buildRequestNo(): string {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const serial = String(Math.floor(Math.random() * 9000) + 1000)
  return `DEMO-${date}-${serial}`
}

export async function submitDemoRequest(payload: DemoRequestPayload): Promise<DemoRequestResult> {
  if (USE_MOCK) {
    await mockDelay(700)
    // 模拟后端拒绝：同一号码重复提交（后端按手机号 24 小时内去重）
    if (sessionStorage.getItem(`demo:${payload.phone}`)) {
      throw new Error('该手机号今天已提交过，我们会按首次提交的时间联系你')
    }
    sessionStorage.setItem(`demo:${payload.phone}`, '1')
    return { requestNo: buildRequestNo() }
  }
  return http.post<DemoRequestResult>('/demo-requests', payload)
}
