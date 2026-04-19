<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="logo">📚 管理后台</div>
      <ul class="admin-menu">
        <li class="admin-menu-item" @click="$router.push('/admin')">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/courses')">
          <el-icon><Reading /></el-icon>
          <span>课程管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/schedule')">
          <el-icon><Calendar /></el-icon>
          <span>时间管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/students')">
          <el-icon><User /></el-icon>
          <span>学生管理</span>
        </li>
        <li class="admin-menu-item active" @click="$router.push('/admin/appointments')">
          <el-icon><Clock /></el-icon>
          <span>预约管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/homework')">
          <el-icon><Document /></el-icon>
          <span>作业管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/reports')">
          <el-icon><TrendCharts /></el-icon>
          <span>学习报告</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/payment')">
          <el-icon><Wallet /></el-icon>
          <span>支付设置</span>
        </li>
      </ul>
    </aside>

    <main class="admin-content">
      <h1 style="font-size: 24px; margin-bottom: 30px;">预约管理</h1>

      <!-- Filters -->
      <div class="card">
        <el-radio-group v-model="filterStatus" @change="loadAppointments">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="pending">待确认</el-radio-button>
          <el-radio-button label="confirmed">已确认</el-radio-button>
          <el-radio-button label="completed">已完成</el-radio-button>
          <el-radio-button label="cancelled">已取消</el-radio-button>
        </el-radio-group>
      </div>

      <!-- Appointments List -->
      <div class="card">
        <el-table :data="appointments" stripe v-loading="loading">
          <el-table-column prop="student_name" label="学生" />
          <el-table-column prop="course_name" label="课程" />
          <el-table-column prop="course_subject" label="科目">
            <template #default="{ row }">
              <el-tag>{{ getSubjectName(row.course_subject) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上课时间">
            <template #default="{ row }">
              {{ formatDateTime(row.start_time) }}
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="费用">
            <template #default="{ row }">
              ¥{{ row.amount }}
            </template>
          </el-table-column>
          <el-table-column prop="payment_status" label="支付状态">
            <template #default="{ row }">
              <el-tag :type="getPaymentStatusType(row.payment_status)">
                {{ getPaymentStatusName(row.payment_status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ getStatusName(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="请假状态" width="120">
            <template #default="{ row }">
              <template v-if="row.leave_status">
                <el-tag :type="getLeaveStatusType(row.leave_status)">
                  {{ getLeaveStatusName(row.leave_status) }}
                </el-tag>
              </template>
              <span v-else style="color: #999;">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="450">
            <template #default="{ row }">
              <el-button type="info" size="small" @click="viewChangeLogs(row)">
                修改记录
              </el-button>
              <el-button v-if="row.leave_status === 'pending'" type="warning" size="small" @click="viewLeaveDetail(row)">
                请假审批
              </el-button>
              <el-button v-if="row.leave_status && row.leave_status !== 'pending'" type="info" size="small" @click="viewLeaveDetail(row)">
                请假详情
              </el-button>
              <el-button v-if="row.status === 'pending'" type="success" size="small" @click="handleConfirm(row)">
                确认
              </el-button>
              <el-button v-if="row.status === 'confirmed'" type="primary" size="small" @click="handleComplete(row)">
                完成
              </el-button>
              <el-button v-if="row.payment_status === 'unpaid' && row.status !== 'cancelled'" type="warning" size="small" @click="handlePay(row)">
                标记支付
              </el-button>
              <el-button v-if="row.payment_status === 'pending' && row.status !== 'cancelled'" type="success" size="small" @click="handleConfirmPayment(row)">
                确认支付
              </el-button>
              <el-button v-if="row.status === 'pending' || row.status === 'confirmed'" type="danger" size="small" @click="handleCancel(row)">
                取消
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- Change Logs Dialog -->
    <el-dialog
      v-model="showChangeLogsDialog"
      title="预约修改记录"
      width="600px"
    >
      <div v-if="currentAppointment">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="学生">{{ currentAppointment.student_name }}</el-descriptions-item>
          <el-descriptions-item label="课程">{{ currentAppointment.course_name }}</el-descriptions-item>
          <el-descriptions-item label="当前时间">{{ formatDateTime(currentAppointment.start_time) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentAppointment.status)">{{ getStatusName(currentAppointment.status) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>修改历史</el-divider>
        <el-table :data="changeLogs" stripe size="small" v-if="changeLogs.length > 0">
          <el-table-column label="原时间">
            <template #default="{ row }">
              {{ formatDateTime(row.old_start_time) || '未知' }}
            </template>
          </el-table-column>
          <el-table-column label="新时间">
            <template #default="{ row }">
              {{ formatDateTime(row.new_start_time) || '未知' }}
            </template>
          </el-table-column>
          <el-table-column prop="change_reason" label="修改原因" />
          <el-table-column label="修改人">
            <template #default="{ row }">
              {{ row.changed_by_name }} ({{ row.changed_by_role === 'student' ? '学生' : '管理员' }})
            </template>
          </el-table-column>
          <el-table-column label="修改时间">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无修改记录" :image-size="60" />
      </div>
    </el-dialog>

    <!-- Leave Detail Dialog -->
    <el-dialog
      v-model="showLeaveDialog"
      title="请假详情"
      width="500px"
    >
      <div v-if="currentAppointment">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="学生">{{ currentAppointment.student_name }}</el-descriptions-item>
          <el-descriptions-item label="课程">{{ currentAppointment.course_name }}</el-descriptions-item>
          <el-descriptions-item label="上课时间">{{ formatDateTime(currentAppointment.start_time) }}</el-descriptions-item>
          <el-descriptions-item label="请假状态">
            <el-tag :type="getLeaveStatusType(currentAppointment.leave_status)">
              {{ getLeaveStatusName(currentAppointment.leave_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="请假原因">{{ currentAppointment.leave_reason || '无' }}</el-descriptions-item>
          <el-descriptions-item label="请假时间">{{ formatDateTime(currentAppointment.leave_time) || '无' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentAppointment.leave_status === 'pending'" style="margin-top: 20px; text-align: right;">
          <el-button @click="showLeaveDialog = false">取消</el-button>
          <el-button type="danger" @click="handleLeaveApprove(currentAppointment, false)" :loading="leaveLoading">
            拒绝请假
          </el-button>
          <el-button type="success" @click="handleLeaveApprove(currentAppointment, true)" :loading="leaveLoading">
            批准请假
          </el-button>
        </div>
        <div v-else style="margin-top: 20px; text-align: right;">
          <el-button @click="showLeaveDialog = false">关闭</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const route = useRoute()
const loading = ref(false)
const appointments = ref([])
const filterStatus = ref('')
const filterPaymentStatus = ref('')

// Change logs related
const showChangeLogsDialog = ref(false)
const currentAppointment = ref(null)
const changeLogs = ref([])

// Leave related
const showLeaveDialog = ref(false)
const leaveLoading = ref(false)

// View change logs
async function viewChangeLogs(appointment) {
  currentAppointment.value = appointment
  
  try {
    const response = await api.get(`/appointments/${appointment.id}/change-logs`)
    if (response.data.success) {
      changeLogs.value = response.data.data
    }
  } catch (error) {
    console.error('获取修改记录失败:', error)
    changeLogs.value = []
  }
  
  showChangeLogsDialog.value = true
}

// Leave status functions
function getLeaveStatusName(status) {
  const map = { pending: '待审批', approved: '已批准', rejected: '已拒绝' }
  return map[status] || status
}

function getLeaveStatusType(status) {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

// View leave detail
function viewLeaveDetail(appointment) {
  currentAppointment.value = appointment
  showLeaveDialog.value = true
}

// Handle leave approval
async function handleLeaveApprove(appointment, approved) {
  try {
    leaveLoading.value = true
    const actionText = approved ? '批准' : '拒绝'
    await ElMessageBox.confirm(`确定要${actionText}该学生的请假申请吗？`, '请假审批', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.put(`/appointments/${appointment.id}/leave-approve`, { approved })
    if (response.data.success) {
      ElMessage.success(`请假已${actionText}`)
      showLeaveDialog.value = false
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  } finally {
    leaveLoading.value = false
  }
}

// 处理URL参数过滤
function applyUrlFilter() {
  const filter = route.query.filter
  if (filter) {
    if (filter === 'pending') {
      filterStatus.value = 'pending'
    } else if (filter === 'completed') {
      filterStatus.value = 'completed'
    } else if (filter === 'unpaid') {
      filterPaymentStatus.value = 'unpaid'
    } else if (filter === 'thisMonth') {
      // 本月预约 - 不设置状态过滤，在loadAppointments中处理
    }
  }
}

onMounted(async () => {
  applyUrlFilter()
  await loadAppointments()
})

// 监听路由变化
watch(() => route.query.filter, () => {
  applyUrlFilter()
  loadAppointments()
})

async function loadAppointments() {
  try {
    loading.value = true
    const response = await api.get('/appointments')
    if (response.data.success) {
      let data = response.data.data
      
      // 本月预约过滤
      if (route.query.filter === 'thisMonth') {
        const now = dayjs()
        const startOfMonth = now.startOf('month').format('YYYY-MM-DD')
        const endOfMonth = now.endOf('month').format('YYYY-MM-DD')
        data = data.filter(a => {
          const appointmentDate = dayjs(a.start_time).format('YYYY-MM-DD')
          return appointmentDate >= startOfMonth && appointmentDate <= endOfMonth
        })
      }
      
      // 状态过滤
      if (filterStatus.value) {
        data = data.filter(a => a.status === filterStatus.value)
      }
      
      // 支付状态过滤
      if (filterPaymentStatus.value) {
        data = data.filter(a => a.payment_status === filterPaymentStatus.value)
      }
      
      appointments.value = data
    }
  } catch (error) {
    console.error('获取预约失败:', error)
  } finally {
    loading.value = false
  }
}

function getSubjectName(subject) {
  const map = { math: '数学', english: '英语', chinese: '语文' }
  return map[subject] || subject
}

function getStatusName(status) {
  const map = { pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

function getStatusType(status) {
  const map = { pending: 'warning', confirmed: 'success', completed: 'info', cancelled: 'danger' }
  return map[status] || 'info'
}

function getPaymentStatusName(status) {
  const map = { unpaid: '未支付', pending: '已支付，待确认', paid: '已支付', confirmed: '已确认', refunded: '已退款' }
  return map[status] || status
}

function getPaymentStatusType(status) {
  const map = { unpaid: 'danger', pending: 'warning', paid: 'success', confirmed: 'success', refunded: 'info' }
  return map[status] || 'info'
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

async function handleConfirm(appointment) {
  try {
    const response = await api.put(`/appointments/${appointment.id}/status`, { status: 'confirmed' })
    if (response.data.success) {
      ElMessage.success('预约已确认')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  }
}

async function handleComplete(appointment) {
  try {
    const response = await api.put(`/appointments/${appointment.id}/status`, { status: 'completed' })
    if (response.data.success) {
      ElMessage.success('课程已完成')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  }
}

async function handlePay(appointment) {
  try {
    await ElMessageBox.confirm('确定标记为已支付吗？', '标记支付', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    
    const response = await api.put(`/appointments/${appointment.id}/payment`, {
      payment_status: 'paid',
      payment_method: '线下支付'
    })
    if (response.data.success) {
      ElMessage.success('已标记为支付')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  }
}

async function handleConfirmPayment(appointment) {
  try {
    await ElMessageBox.confirm('确定确认该学生的支付吗？', '确认支付', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    
    const response = await api.put(`/appointments/${appointment.id}/confirm-payment`)
    if (response.data.success) {
      ElMessage.success('支付已确认')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  }
}

async function handleCancel(appointment) {
  try {
    await ElMessageBox.confirm('确定要取消这个预约吗？', '取消预约', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.put(`/appointments/${appointment.id}/status`, { status: 'cancelled' })
    if (response.data.success) {
      ElMessage.success('预约已取消')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '操作失败')
    }
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-sidebar {
  width: 240px;
  background: #2c3e50;
  padding: 20px 0;
  flex-shrink: 0;
}

.admin-sidebar .logo {
  padding: 20px;
  text-align: center;
  color: white;
  font-size: 20px;
  font-weight: bold;
}

.admin-menu {
  list-style: none;
  padding: 0;
}

.admin-menu-item {
  padding: 12px 20px;
  color: #ecf0f1;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-menu-item:hover {
  background-color: #34495e;
}

.admin-menu-item.active {
  background-color: #3498db;
}

.admin-content {
  flex: 1;
  padding: 20px;
  background: #f5f7fa;
  overflow-y: auto;
}
</style>