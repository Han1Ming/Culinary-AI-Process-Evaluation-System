import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import {
  mockCameras,
  mockDeviceLogs,
  mockWorkstations,
  nextDeviceId,
  pushDeviceLog,
} from '@/mock/device'
import type {
  CameraDevice,
  DeviceLog,
  DeviceTestResult,
  Workstation,
  WorkstationForm,
  WorkstationStatus,
} from '@/types/device'

/**
 * 工位与摄像头设备管理
 * ----------------------------------------------------------------------------
 *   GET  /devices/workstations        工位列表
 *   POST /devices/workstations        新增工位
 *   PUT  /devices/workstations/{id}   编辑 / 状态变更
 *   GET  /devices/cameras             摄像头列表
 *   PUT  /devices/cameras/{id}/bind   绑定 / 解绑（workstationNo 为空即解绑）
 *   PUT  /devices/cameras/{id}/status 启停
 *   POST /devices/cameras/{id}/test   连接测试（同步返回结果）
 *   GET  /devices/logs                操作日志
 *
 * 所有写操作都落一条日志：设备操作必须可追溯到人。
 */

export async function fetchWorkstations(): Promise<Workstation[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return mockWorkstations.map((item) => ({ ...item, cameraIds: [...item.cameraIds] }))
  }
  return http.get<Workstation[]>('/devices/workstations')
}

export async function fetchCameras(): Promise<CameraDevice[]> {
  if (USE_MOCK) {
    await mockDelay(220)
    return mockCameras.map((item) => ({ ...item }))
  }
  return http.get<CameraDevice[]>('/devices/cameras')
}

export async function fetchDeviceLogs(limit = 20): Promise<DeviceLog[]> {
  if (USE_MOCK) {
    await mockDelay(180)
    return mockDeviceLogs.slice(0, limit).map((item) => ({ ...item }))
  }
  return http.get<DeviceLog[]>('/devices/logs', { limit })
}

export async function saveWorkstation(form: WorkstationForm, id?: string): Promise<Workstation> {
  if (USE_MOCK) {
    await mockDelay(300)
    if (id) {
      const found = mockWorkstations.find((item) => item.id === id)
      if (!found) throw new Error('工位不存在')
      Object.assign(found, form)
      pushDeviceLog({
        action: 'update',
        target: `工位 ${form.no}`,
        detail: `编辑工位信息（${form.room}，状态 ${form.status}）`,
        operator: '张明远',
      })
      return { ...found, cameraIds: [...found.cameraIds] }
    }
    if (mockWorkstations.some((item) => item.no === form.no)) {
      throw new Error(`工位号 ${form.no} 已存在`)
    }
    const created: Workstation = { id: nextDeviceId('ws'), ...form, cameraIds: [] }
    mockWorkstations.push(created)
    pushDeviceLog({
      action: 'create',
      target: `工位 ${form.no}`,
      detail: `新增工位（${form.room}）`,
      operator: '张明远',
    })
    return { ...created }
  }
  return id
    ? http.put<Workstation>(`/devices/workstations/${id}`, form)
    : http.post<Workstation>('/devices/workstations', form)
}

export async function setWorkstationStatus(
  id: string,
  status: WorkstationStatus,
  note: string,
): Promise<Workstation> {
  if (USE_MOCK) {
    await mockDelay(260)
    const found = mockWorkstations.find((item) => item.id === id)
    if (!found) throw new Error('工位不存在')
    found.status = status
    found.note = note || found.note
    pushDeviceLog({
      action: 'workstation_status',
      target: `工位 ${found.no}`,
      detail: `状态改为 ${status}${note ? `：${note}` : ''}`,
      operator: '张明远',
    })
    return { ...found, cameraIds: [...found.cameraIds] }
  }
  return http.put<Workstation>(`/devices/workstations/${id}/status`, { status, note })
}

/** workstationNo 传空字符串表示解绑 */
export async function bindCamera(cameraId: string, workstationNo: string): Promise<CameraDevice> {
  if (USE_MOCK) {
    await mockDelay(300)
    const camera = mockCameras.find((item) => item.id === cameraId)
    if (!camera) throw new Error('摄像头不存在')
    const previous = camera.workstationNo ?? '未绑定'

    if (workstationNo) {
      const target = mockWorkstations.find((item) => item.no === workstationNo)
      if (!target) throw new Error(`工位 ${workstationNo} 不存在`)
      if (!target.cameraIds.includes(camera.id)) target.cameraIds.push(camera.id)
    }
    const old = mockWorkstations.find((item) => item.no === camera.workstationNo)
    if (old) old.cameraIds = old.cameraIds.filter((id) => id !== camera.id)

    camera.workstationNo = workstationNo || undefined
    pushDeviceLog({
      action: workstationNo ? 'bind' : 'unbind',
      target: camera.no,
      detail: workstationNo
        ? `绑定工位 ${workstationNo}（原绑定：${previous}）`
        : `解绑工位 ${previous}`,
      operator: '张明远',
    })
    return { ...camera }
  }
  return http.put<CameraDevice>(`/devices/cameras/${cameraId}/bind`, { workstationNo })
}

export async function toggleCamera(cameraId: string, enabled: boolean): Promise<CameraDevice> {
  if (USE_MOCK) {
    await mockDelay(260)
    const camera = mockCameras.find((item) => item.id === cameraId)
    if (!camera) throw new Error('摄像头不存在')
    camera.status = enabled ? 'offline' : 'disabled'
    pushDeviceLog({
      action: enabled ? 'enable' : 'disable',
      target: camera.no,
      detail: enabled ? '启用设备，等待首次心跳' : '停用设备',
      operator: '张明远',
    })
    return { ...camera }
  }
  return http.put<CameraDevice>(`/devices/cameras/${cameraId}/status`, { enabled })
}

/** 连接测试：真实环境由后端发起一次拉流握手，前端只展示结果 */
export async function testCamera(cameraId: string): Promise<DeviceTestResult> {
  if (USE_MOCK) {
    await mockDelay(900)
    const camera = mockCameras.find((item) => item.id === cameraId)
    if (!camera) throw new Error('摄像头不存在')
    const testedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const ok = camera.status !== 'error' && camera.status !== 'disabled'
    const result: DeviceTestResult = ok
      ? {
          ok: true,
          latency: camera.latency ?? Math.round(150 + Math.random() * 120),
          message: '拉流握手成功，首帧解析正常',
          testedAt,
        }
      : {
          ok: false,
          message:
            camera.status === 'disabled'
              ? '设备已停用，启用后才能测试'
              : '拉流超时（8s），检查供电、网线与 IP 配置',
          testedAt,
        }
    pushDeviceLog({
      action: 'test',
      target: camera.no,
      detail: result.ok ? `连接测试通过（${result.latency}ms）` : `连接测试失败：${result.message}`,
      operator: '张明远',
    })
    return result
  }
  return http.post<DeviceTestResult>(`/devices/cameras/${cameraId}/test`)
}
