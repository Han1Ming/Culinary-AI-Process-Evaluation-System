/**
 * 工位 / 摄像头 Mock
 * ----------------------------------------------------------------------------
 * 设备状态故意有在线的、离线的、异常的、停用的四种，
 * 因为「一键全在线」的设备列表在验收时最容易被追问。
 */
import type { CameraDevice, DeviceLog, Workstation } from '@/types/device'

export const mockWorkstations: Workstation[] = [
  { id: 'ws_01', no: '02', room: '中餐实训室 A', status: 'in_use', cameraIds: ['cam_01', 'cam_02', 'cam_03', 'cam_04'] },
  { id: 'ws_02', no: '05', room: '中餐实训室 A', status: 'in_use', cameraIds: ['cam_05'] },
  { id: 'ws_03', no: '09', room: '西餐实训室 B', status: 'idle', cameraIds: ['cam_06'] },
  { id: 'ws_04', no: '12', room: '中餐实训室 A', status: 'in_use', cameraIds: ['cam_07'] },
  { id: 'ws_05', no: '15', room: '西餐实训室 B', status: 'maintenance', cameraIds: [], note: '下水堵塞，待维修' },
  { id: 'ws_06', no: '18', room: '中餐实训室 A', status: 'idle', cameraIds: ['cam_08'] },
]

export const mockCameras: CameraDevice[] = [
  {
    id: 'cam_01',
    no: 'CAM-A-001',
    name: '工位 02 · 正前方',
    model: 'HK-DS2CD3T46',
    ip: '192.168.10.21',
    status: 'online',
    workstationNo: '02',
    lastSeenAt: '2026-11-21T08:56:20',
    fps: 25,
    latency: 180,
  },
  {
    id: 'cam_02',
    no: 'CAM-A-002',
    name: '工位 02 · 俯拍砧板',
    model: 'HK-DS2CD3T46',
    ip: '192.168.10.22',
    status: 'online',
    workstationNo: '02',
    lastSeenAt: '2026-11-21T08:56:19',
    fps: 24,
    latency: 210,
  },
  {
    id: 'cam_03',
    no: 'CAM-A-003',
    name: '工位 02 · 侧方',
    model: 'DH-IPC-HFW2439',
    ip: '192.168.10.23',
    status: 'offline',
    workstationNo: '02',
    lastSeenAt: '2026-11-21T08:56:02',
  },
  {
    id: 'cam_04',
    no: 'CAM-A-004',
    name: '工位 02 · 灶台',
    model: 'DH-IPC-HFW2439',
    ip: '192.168.10.24',
    status: 'error',
    workstationNo: '02',
    lastSeenAt: '2026-11-21T08:51:47',
  },
  {
    id: 'cam_05',
    no: 'CAM-A-005',
    name: '工位 05 · 正前方',
    model: 'HK-DS2CD3T46',
    ip: '192.168.10.25',
    status: 'online',
    workstationNo: '05',
    lastSeenAt: '2026-11-21T08:56:18',
    fps: 25,
    latency: 195,
  },
  {
    id: 'cam_06',
    no: 'CAM-B-001',
    name: '工位 09 · 正前方',
    model: 'HK-DS2CD3T46',
    ip: '192.168.20.11',
    status: 'offline',
    lastSeenAt: '2026-11-20T17:02:11',
  },
  {
    id: 'cam_07',
    no: 'CAM-A-006',
    name: '工位 12 · 正前方',
    model: 'HK-DS2CD3T46',
    ip: '192.168.10.26',
    status: 'online',
    workstationNo: '12',
    lastSeenAt: '2026-11-21T08:56:21',
    fps: 25,
    latency: 168,
  },
  {
    id: 'cam_08',
    no: 'CAM-A-007',
    name: '工位 18 · 正前方',
    model: 'DH-IPC-HFW2439',
    ip: '192.168.10.27',
    status: 'disabled',
    workstationNo: '18',
    lastSeenAt: '2026-11-18T09:30:00',
  },
]

export const mockDeviceLogs: DeviceLog[] = [
  {
    id: 'log_01',
    action: 'test',
    target: 'CAM-A-004',
    detail: '连接测试失败：拉流超时 8s，已通知设备管理员',
    operator: '张明远',
    at: '2026-11-21 08:52:10',
  },
  {
    id: 'log_02',
    action: 'bind',
    target: 'CAM-A-003',
    detail: '绑定工位 02（原绑定：未绑定）',
    operator: '张明远',
    at: '2026-11-20 16:40:22',
  },
  {
    id: 'log_03',
    action: 'workstation_status',
    target: '工位 15',
    detail: '状态改为「维护中」：下水堵塞，待维修',
    operator: '张明远',
    at: '2026-11-20 15:12:07',
  },
  {
    id: 'log_04',
    action: 'disable',
    target: 'CAM-A-007',
    detail: '停用：镜头进水，待更换',
    operator: '张明远',
    at: '2026-11-19 10:05:44',
  },
]

let seq = 20

export function nextDeviceId(prefix: string): string {
  seq += 1
  return `${prefix}_${seq}`
}

export function pushDeviceLog(log: Omit<DeviceLog, 'id' | 'at'>): DeviceLog {
  const record: DeviceLog = {
    ...log,
    id: nextDeviceId('log'),
    at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }
  mockDeviceLogs.unshift(record)
  return record
}
