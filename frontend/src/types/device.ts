/** 工位与摄像头设备管理（/system/device） */

export type WorkstationStatus = 'idle' | 'in_use' | 'maintenance' | 'disabled'

export const WORKSTATION_STATUS_META: Record<
  WorkstationStatus,
  { label: string; tone: 'success' | 'primary' | 'warning' | 'idle' }
> = {
  idle: { label: '空闲', tone: 'idle' },
  in_use: { label: '使用中', tone: 'primary' },
  maintenance: { label: '维护中', tone: 'warning' },
  disabled: { label: '已停用', tone: 'idle' },
}

export interface Workstation {
  id: string
  /** 工位号，与签到记录里的 seat 一致 */
  no: string
  /** 实训室 */
  room: string
  status: WorkstationStatus
  /** 绑定的摄像头 id 列表 */
  cameraIds: string[]
  /** 备注，如「靠窗，逆光」 */
  note?: string
}

export type DeviceStatus = 'online' | 'offline' | 'error' | 'disabled'

export const DEVICE_STATUS_META: Record<
  DeviceStatus,
  { label: string; tone: 'success' | 'danger' | 'warning' | 'idle' }
> = {
  online: { label: '在线', tone: 'success' },
  offline: { label: '离线', tone: 'idle' },
  error: { label: '异常', tone: 'danger' },
  disabled: { label: '已停用', tone: 'idle' },
}

export interface CameraDevice {
  id: string
  /** 设备编号，全站唯一，事件里用它定位机位 */
  no: string
  name: string
  model: string
  ip: string
  status: DeviceStatus
  /** 绑定的工位号，未绑定为空 */
  workstationNo?: string
  /** 最近一次心跳 */
  lastSeenAt?: string
  fps?: number
  latency?: number
}

export type DeviceAction =
  | 'create'
  | 'update'
  | 'bind'
  | 'unbind'
  | 'enable'
  | 'disable'
  | 'test'
  | 'workstation_status'

export const DEVICE_ACTION_LABEL: Record<DeviceAction, string> = {
  create: '新增',
  update: '编辑',
  bind: '绑定工位',
  unbind: '解绑',
  enable: '启用',
  disable: '停用',
  test: '连接测试',
  workstation_status: '工位状态变更',
}

export interface DeviceLog {
  id: string
  action: DeviceAction
  /** 操作对象：摄像头编号 / 工位号 */
  target: string
  detail: string
  operator: string
  at: string
}

export interface DeviceTestResult {
  ok: boolean
  latency?: number
  message: string
  testedAt: string
}

export interface WorkstationForm {
  no: string
  room: string
  status: WorkstationStatus
  note?: string
}
