<script setup lang="ts">
/**
 * 工位与设备管理
 * ----------------------------------------------------------------------------
 * 管理员维护的三件事：工位、摄像头、设备操作记录。核心约束——
 *   1. 摄像头必须绑定工位，事件才能记到人；
 *   2. 停用 / 解绑 / 维护都要二次确认，且写入操作日志；
 *   3. 连接测试结果只显示后端真实返回，测不通就写「失败」，不给假在线。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import StateView from '@/components/StateView.vue'
import {
  bindCamera,
  fetchCameras,
  fetchDeviceLogs,
  fetchWorkstations,
  saveWorkstation,
  setWorkstationStatus,
  testCamera,
  toggleCamera,
} from '@/api/device'
import { useRole } from '@/composables/useRole'
import { askReason, confirmAction } from '@/utils/confirm'
import { formatDateTime } from '@/utils/format'
import {
  DEVICE_ACTION_LABEL,
  DEVICE_STATUS_META,
  WORKSTATION_STATUS_META,
} from '@/types/device'
import type {
  CameraDevice,
  DeviceLog,
  DeviceTestResult,
  Workstation,
  WorkstationForm,
  WorkstationStatus,
} from '@/types/device'

const { can } = useRole()
const canManage = computed(() => can('device.manage'))

const loading = ref(true)
const error = ref('')
const tab = ref<'workstation' | 'camera' | 'log'>('workstation')

const workstations = ref<Workstation[]>([])
const cameras = ref<CameraDevice[]>([])
const logs = ref<DeviceLog[]>([])

/* ------------------------------ 汇总 ------------------------------ */

const stats = computed(() => [
  { label: '工位总数', value: workstations.value.length, unit: '个' },
  { label: '使用中', value: workstations.value.filter((item) => item.status === 'in_use').length, unit: '个' },
  { label: '摄像头在线', value: cameras.value.filter((item) => item.status === 'online').length, unit: '路' },
  {
    label: '离线 / 异常',
    value: cameras.value.filter((item) => item.status === 'offline' || item.status === 'error').length,
    unit: '路',
  },
])

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [ws, cams, records] = await Promise.all([
      fetchWorkstations(),
      fetchCameras(),
      fetchDeviceLogs(30),
    ])
    workstations.value = ws
    cameras.value = cams
    logs.value = records
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设备数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ------------------------------ 工位 ------------------------------ */

const wsDialog = ref(false)
const wsEditing = ref<Workstation | null>(null)
const wsForm = reactive<WorkstationForm>({ no: '', room: '', status: 'idle', note: '' })
const wsSaving = ref(false)

function openWsForm(target?: Workstation): void {
  wsEditing.value = target ?? null
  wsForm.no = target?.no ?? ''
  wsForm.room = target?.room ?? ''
  wsForm.status = target?.status ?? 'idle'
  wsForm.note = target?.note ?? ''
  wsDialog.value = true
}

async function submitWs(): Promise<void> {
  if (!wsForm.no.trim() || !wsForm.room.trim()) {
    ElMessage.warning('工位号与实训室不能为空')
    return
  }
  wsSaving.value = true
  try {
    const saved = await saveWorkstation({ ...wsForm }, wsEditing.value?.id)
    const index = workstations.value.findIndex((item) => item.id === saved.id)
    if (index >= 0) workstations.value[index] = saved
    else workstations.value.push(saved)
    wsDialog.value = false
    ElMessage.success(wsEditing.value ? '工位已更新' : '工位已新增')
    logs.value = await fetchDeviceLogs(30)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    wsSaving.value = false
  }
}

async function changeWsStatus(target: Workstation, status: WorkstationStatus): Promise<void> {
  const label = WORKSTATION_STATUS_META[status].label
  const ok = await confirmAction({
    title: `工位状态改为「${label}」`,
    message:
      status === 'disabled'
        ? `停用后工位 ${target.no} 不再接收实训任务，已绑定的摄像头需要另行解绑。`
        : `工位 ${target.no} 的状态将改为「${label}」，变更会写入设备操作日志。`,
    confirmText: '确认变更',
    dangerous: status === 'disabled' || status === 'maintenance',
  })
  if (!ok) return

  const note = status === 'maintenance' ? await askReason({ title: '维护原因', placeholder: '例如：下水堵塞，待维修' }) : ''
  if (status === 'maintenance' && !note) return

  try {
    const updated = await setWorkstationStatus(target.id, status, note ?? '')
    Object.assign(target, updated)
    ElMessage.success(`工位 ${target.no} 已改为「${label}」`)
    logs.value = await fetchDeviceLogs(30)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '状态变更失败')
  }
}

/* ------------------------------ 摄像头 ------------------------------ */

const bindDialog = ref(false)
const bindingCamera = ref<CameraDevice | null>(null)
const bindTarget = ref('')
const binding = ref(false)

function openBind(camera: CameraDevice): void {
  bindingCamera.value = camera
  bindTarget.value = camera.workstationNo ?? ''
  bindDialog.value = true
}

async function submitBind(): Promise<void> {
  const camera = bindingCamera.value
  if (!camera) return

  const unbind = !bindTarget.value
  if (unbind) {
    const ok = await confirmAction({
      title: '解绑摄像头',
      message: `${camera.no} 解绑后，该机位不再参与任何工位的评价，历史事件保留。`,
      confirmText: '确认解绑',
      dangerous: true,
    })
    if (!ok) return
  }

  binding.value = true
  try {
    const updated = await bindCamera(camera.id, bindTarget.value)
    Object.assign(camera, updated)
    bindDialog.value = false
    ElMessage.success(unbind ? '已解绑' : `已绑定到工位 ${bindTarget.value}`)
    workstations.value = await fetchWorkstations()
    logs.value = await fetchDeviceLogs(30)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '绑定失败')
  } finally {
    binding.value = false
  }
}

async function toggle(camera: CameraDevice): Promise<void> {
  const disable = camera.status !== 'disabled'
  const ok = await confirmAction({
    title: disable ? '停用摄像头' : '启用摄像头',
    message: disable
      ? `${camera.no} 停用后不再推流，四路画面里会显示「离线」。`
      : `${camera.no} 启用后需要等待首次心跳，未通电时仍会显示离线。`,
    confirmText: disable ? '确认停用' : '确认启用',
    dangerous: disable,
  })
  if (!ok) return
  try {
    const updated = await toggleCamera(camera.id, !disable)
    Object.assign(camera, updated)
    ElMessage.success(disable ? '已停用' : '已启用')
    logs.value = await fetchDeviceLogs(30)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

/* ------------------------------ 连接测试 ------------------------------ */

const testDialog = ref(false)
const testing = ref(false)
const testingCamera = ref<CameraDevice | null>(null)
const testResult = ref<DeviceTestResult | null>(null)

async function runTest(camera: CameraDevice): Promise<void> {
  testingCamera.value = camera
  testResult.value = null
  testDialog.value = true
  testing.value = true
  try {
    testResult.value = await testCamera(camera.id)
    logs.value = await fetchDeviceLogs(30)
  } catch (err) {
    testResult.value = {
      ok: false,
      message: err instanceof Error ? err.message : '测试请求失败',
      testedAt: new Date().toISOString(),
    }
  } finally {
    testing.value = false
  }
}

/** 工位下拉：绑定摄像头时只能选未停用的工位 */
const workstationOptions = computed(() =>
  workstations.value.map((item) => ({
    value: item.no,
    label: `工位 ${item.no} · ${item.room}`,
    disabled: item.status === 'disabled',
  })),
)

function onWsCommand(row: Workstation, command: string | number | object): void {
  void changeWsStatus(row, command as WorkstationStatus)
}
</script>

<template>
  <div>
    <PageHeader title="工位与设备" subtitle="工位、摄像头与绑定关系；所有变更写操作日志">
      <template #actions>
        <el-button v-if="canManage" type="primary" @click="openWsForm()">
          <el-icon><Plus /></el-icon>
          新增工位
        </el-button>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <StateView v-if="loading" state="loading" />
    <StateView v-else-if="error" state="error" :description="error" @retry="load" />

    <template v-else>
      <div class="stats">
        <div v-for="item in stats" :key="item.label" class="stat">
          <span class="stat__label">{{ item.label }}</span>
          <p class="stat__value num">
            {{ item.value }}<small>{{ item.unit }}</small>
          </p>
        </div>
      </div>

      <el-tabs v-model="tab" class="tabs">
        <!-- 工位 -->
        <el-tab-pane label="工位" name="workstation">
          <section class="app-card">
            <el-table :data="workstations" size="small" class="table">
              <el-table-column label="工位号" width="90">
                <template #default="{ row }">
                  <strong class="num">{{ row.no }}</strong>
                </template>
              </el-table-column>
              <el-table-column prop="room" label="实训室" min-width="150" />
              <el-table-column label="状态" width="96">
                <template #default="{ row }">
                  <span class="state" :class="`is-${WORKSTATION_STATUS_META[row.status as WorkstationStatus].tone}`">
                    {{ WORKSTATION_STATUS_META[row.status as WorkstationStatus].label }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="绑定摄像头" min-width="200">
                <template #default="{ row }">
                  <span v-if="!row.cameraIds.length" class="muted">未绑定</span>
                  <span v-else class="num cam-list">{{ row.cameraIds.join(' / ') }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="note" label="备注" min-width="140">
                <template #default="{ row }">
                  <span class="muted">{{ row.note || '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="canManage" text size="small" @click="openWsForm(row)">编辑</el-button>
                  <el-dropdown v-if="canManage" trigger="click" @command="(cmd) => onWsCommand(row, cmd)">
                    <el-button text size="small">状态<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="idle">空闲</el-dropdown-item>
                        <el-dropdown-item command="in_use">使用中</el-dropdown-item>
                        <el-dropdown-item command="maintenance">维护中</el-dropdown-item>
                        <el-dropdown-item command="disabled">停用</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <!-- 摄像头 -->
        <el-tab-pane label="摄像头" name="camera">
          <section class="app-card">
            <el-table :data="cameras" size="small" class="table">
              <el-table-column label="设备编号" width="120">
                <template #default="{ row }">
                  <span class="num">{{ row.no }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
              <el-table-column prop="model" label="型号" width="130" show-overflow-tooltip />
              <el-table-column prop="ip" label="IP" width="120">
                <template #default="{ row }">
                  <span class="num">{{ row.ip }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <span class="state" :class="`is-${DEVICE_STATUS_META[row.status as keyof typeof DEVICE_STATUS_META].tone}`">
                    {{ DEVICE_STATUS_META[row.status as keyof typeof DEVICE_STATUS_META].label }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="绑定工位" width="96">
                <template #default="{ row }">
                  <span v-if="row.workstationNo" class="num">{{ row.workstationNo }}</span>
                  <span v-else class="muted">未绑定</span>
                </template>
              </el-table-column>
              <el-table-column label="心跳 / 帧率" width="150">
                <template #default="{ row }">
                  <span class="num">
                    {{ formatDateTime(row.lastSeenAt, 'MM-DD HH:mm:ss') }}
                    <template v-if="row.fps"> · {{ row.fps }}fps</template>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button text size="small" @click="runTest(row)">测试</el-button>
                  <el-button v-if="canManage" text size="small" @click="openBind(row)">绑定</el-button>
                  <el-button v-if="canManage" text size="small" @click="toggle(row)">
                    {{ row.status === 'disabled' ? '启用' : '停用' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <!-- 操作记录 -->
        <el-tab-pane label="操作记录" name="log">
          <section class="app-card">
            <StateView v-if="!logs.length" state="empty" compact description="还没有设备操作记录" />
            <el-table v-else :data="logs" size="small" class="table">
              <el-table-column label="时间" width="160">
                <template #default="{ row }">
                  <span class="num">{{ formatDateTime(row.at, 'YYYY-MM-DD HH:mm:ss') }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="110">
                <template #default="{ row }">{{ DEVICE_ACTION_LABEL[row.action as keyof typeof DEVICE_ACTION_LABEL] }}</template>
              </el-table-column>
              <el-table-column prop="target" label="对象" width="130" />
              <el-table-column prop="detail" label="说明" min-width="260" show-overflow-tooltip />
              <el-table-column prop="operator" label="操作人" width="100" />
            </el-table>
          </section>
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 工位表单 -->
    <el-dialog v-model="wsDialog" :title="wsEditing ? '编辑工位' : '新增工位'" width="440px">
      <el-form label-position="top">
        <div class="form-row">
          <el-form-item label="工位号" class="form-row__item">
            <el-input v-model="wsForm.no" maxlength="8" placeholder="如 02" />
          </el-form-item>
          <el-form-item label="实训室" class="form-row__item">
            <el-input v-model="wsForm.room" maxlength="24" placeholder="如 中餐实训室 A" />
          </el-form-item>
        </div>
        <el-form-item label="状态">
          <el-select v-model="wsForm.status" class="full">
            <el-option label="空闲" value="idle" />
            <el-option label="使用中" value="in_use" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="wsForm.note" maxlength="60" placeholder="选填，如「靠窗，逆光」" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wsDialog = false">取消</el-button>
        <el-button type="primary" :loading="wsSaving" @click="submitWs">保存</el-button>
      </template>
    </el-dialog>

    <!-- 绑定 -->
    <el-dialog v-model="bindDialog" title="摄像头绑定" width="440px">
      <p class="dialog-tip">
        {{ bindingCamera?.no }} 当前绑定
        <strong>{{ bindingCamera?.workstationNo || '未绑定' }}</strong
        >；绑定关系变更会写入设备日志。
      </p>
      <el-form label-position="top">
        <el-form-item label="绑定工位">
          <el-select v-model="bindTarget" clearable placeholder="解绑请留空" class="full">
            <el-option
              v-for="opt in workstationOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              :disabled="opt.disabled"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialog = false">取消</el-button>
        <el-button type="primary" :loading="binding" @click="submitBind">保存</el-button>
      </template>
    </el-dialog>

    <!-- 测试结果 -->
    <el-dialog v-model="testDialog" title="连接测试" width="420px">
      <div class="test">
        <p class="test__target num">{{ testingCamera?.no }} · {{ testingCamera?.name }}</p>
        <template v-if="testing">
          <p class="test__loading">正在握手并解析首帧…</p>
        </template>
        <template v-else-if="testResult">
          <p class="test__result" :class="testResult.ok ? 'is-ok' : 'is-fail'">
            {{ testResult.ok ? '连接成功' : '连接失败' }}
          </p>
          <p class="test__msg">{{ testResult.message }}</p>
          <p class="test__meta num">
            <template v-if="testResult.latency">延迟 {{ testResult.latency }} ms · </template>
            {{ formatDateTime(testResult.testedAt, 'YYYY-MM-DD HH:mm:ss') }}
          </p>
        </template>
      </div>
      <template #footer>
        <el-button @click="testDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-3;
  margin-bottom: $space-4;
}

.stat {
  padding: 14px 16px;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__label {
    font-size: $font-size-xs;
    color: $color-text-secondary;
  }

  &__value {
    display: flex;
    gap: 3px;
    align-items: baseline;
    margin: 6px 0 0;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;

    small {
      font-size: 11px;
      font-weight: $font-weight-regular;
      color: $color-text-placeholder;
    }
  }
}

.tabs {
  :deep(.el-tabs__header) {
    margin-bottom: $space-3;
  }
}

.app-card {
  padding: 0;
  overflow: hidden;
}

.table {
  width: 100%;
}

.state {
  font-size: 11px;

  &.is-success {
    color: $color-success;
  }

  &.is-primary {
    color: $color-primary;
  }

  &.is-warning {
    color: $color-warning;
  }

  &.is-danger {
    color: $color-danger;
  }

  &.is-idle {
    color: $color-text-secondary;
  }
}

.muted {
  font-size: $font-size-xs;
  color: $color-text-placeholder;
}

.cam-list {
  font-size: $font-size-xs;
  color: $color-text-secondary;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: $space-3;
}

.full {
  width: 100%;
}

.dialog-tip {
  padding: 8px 10px;
  margin: 0 0 $space-4;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $color-text-secondary;
  background: $color-bg-subtle;
  border-radius: $radius-sm;

  strong {
    color: $color-text-primary;
  }
}

.test {
  &__target {
    margin: 0;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__loading {
    margin: $space-4 0 0;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__result {
    margin: $space-4 0 0;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;

    &.is-ok {
      color: $color-success;
    }

    &.is-fail {
      color: $color-danger;
    }
  }

  &__msg {
    margin: 6px 0 0;
    font-size: $font-size-sm;
    line-height: 1.7;
    color: $color-text-regular;
  }

  &__meta {
    margin: $space-3 0 0;
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

@media (max-width: $breakpoint-md) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
