<template>
  <div class="student-layout">
    <header class="student-header">
      <router-link to="/" class="logo">📚 课外培训约课系统</router-link>
      <nav>
        <router-link to="/dashboard" class="nav-link">我的主页</router-link>
        <router-link to="/booking" class="nav-link">预约课程</router-link>
        <router-link to="/appointments" class="nav-link">我的预约</router-link>
        <router-link to="/homework" class="nav-link">作业</router-link>
        <router-link to="/reports" class="nav-link">学习报告</router-link>
      </nav>
    </header>

    <div class="student-content">
      <h1 style="font-size: 24px; margin-bottom: 30px;">我的预约</h1>

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
          <el-table-column prop="payment_method" label="支付方式">
            <template #default="{ row }">
              {{ getPaymentMethodName(row.payment_method) }}
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
          <el-table-column label="请假状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.leave_status === 'pending'" type="warning">待审批</el-tag>
              <el-tag v-else-if="row.leave_status === 'approved'" type="success">已批准</el-tag>
              <el-tag v-else-if="row.leave_status === 'rejected'" type="danger">已拒绝</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280">
            <template #default="{ row }">
              <el-button
                v-if="(row.status === 'pending' || row.status === 'confirmed') && !row.leave_status"
                type="warning"
                size="small"
                @click="handleLeave(row)"
              >
                请假
              </el-button>
              <el-button
                v-if="row.status === 'pending' || row.status === 'confirmed'"
                type="primary"
                size="small"
                @click="handleChangeTime(row)"
              >
                改时间
              </el-button>
              <el-button
                v-if="row.status === 'pending' || row.status === 'confirmed'"
                type="danger"
                size="small"
                @click="handleCancel(row)"
              >
                取消
              </el-button>
              <el-button
                v-if="row.payment_status === 'unpaid' && row.status !== 'cancelled'"
                type="success"
                size="small"
                @click="handlePay(row)"
              >
                支付
              </el-button>
              <el-tag
                v-if="row.payment_status === 'pending'"
                type="warning"
                size="small"
              >
                待老师确认
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="appointments.length === 0" description="暂无预约记录" />
      </div>
    </div>

    <!-- Payment Dialog -->
    <el-dialog
      v-model="showPaymentDialog"
      title="在线支付"
      width="500px"
      center
      :close-on-click-modal="false"
    >
      <div class="payment-dialog-content">
        <div class="payment-amount">
          <span class="amount-label">支付金额：</span>
          <span class="amount-value">¥{{ currentAppointment?.amount }}</span>
        </div>
        
        <div class="payment-method-display">
          <span>{{ getPaymentMethodName(currentAppointment?.payment_method) }}</span>
        </div>

        <div v-if="paymentQrCode" class="qr-code-display">
          <el-image
            :src="paymentQrCode"
            fit="contain"
            style="width: 250px; height: 250px;"
          />
          <p class="qr-tip">请使用{{ getPaymentMethodName(currentAppointment?.payment_method) }}扫码支付</p>
        </div>
        <div v-else class="no-qr-code">
          <p>管理员暂未配置收款码</p>
          <p>请联系管理员获取支付信息</p>
        </div>

        <div class="payment-status-section">
          <el-divider>支付状态</el-divider>
          <el-radio-group v-model="paymentStatus" size="large">
            <el-radio-button label="pending">待支付</el-radio-button>
            <el-radio-button label="paid">已支付</el-radio-button>
          </el-radio-group>
          <p v-if="paymentStatus === 'paid'" class="payment-note">
            您已标记为"已支付"，老师将核实后确认
          </p>
        </div>

        <el-alert type="info" style="margin-top: 20px;">
          <template #title>支付说明</template>
          <ol style="margin: 0; padding-left: 20px;">
            <li>扫描上方二维码完成支付</li>
            <li>支付完成后点击"我已支付"按钮</li>
            <li>老师核实后将确认支付状态</li>
          </ol>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="showPaymentDialog = false">稍后支付</el-button>
        <el-button
          type="success"
          @click="confirmPaymentStatus"
          :loading="paymentLoading"
          :disabled="paymentStatus !== 'paid'"
        >
          我已支付
        </el-button>
      </template>
    </el-dialog>

    <!-- Change Time Dialog -->
    <el-dialog
      v-model="showChangeTimeDialog"
      title="修改预约时间"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="currentAppointment">
        <el-form :model="changeTimeForm" label-width="100px">
          <el-form-item label="当前课程">
            <el-input :value="currentAppointment.course_name" disabled />
          </el-form-item>
          <el-form-item label="当前时间">
            <el-input :value="formatDateTime(currentAppointment.start_time)" disabled />
          </el-form-item>
          <el-form-item label="选择日期">
            <el-date-picker
              v-model="changeTimeForm.date"
              type="date"
              placeholder="选择日期"
              style="width: 100%;"
              :disabled-date="disabledDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="选择时间段">
            <el-radio-group v-model="changeTimeForm.timeSlot">
              <el-radio label="0">上午 09:00-10:00</el-radio>
              <el-radio label="1">下午 14:00-15:00</el-radio>
              <el-radio label="2">晚上 18:00-19:00</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="修改原因">
            <el-input
              v-model="changeTimeForm.reason"
              type="textarea"
              placeholder="请填写修改原因（可选）"
              :rows="3"
            />
          </el-form-item>
        </el-form>

        <!-- Change Logs -->
        <el-divider>修改记录</el-divider>
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
          <el-table-column label="修改时间">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无修改记录" :image-size="60" />
      </div>

      <template #footer>
        <el-button @click="showChangeTimeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleChangeTimeSubmit" :loading="changeTimeLoading">
          确认修改
        </el-button>
      </template>
    </el-dialog>

    <!-- Leave Dialog -->
    <el-dialog
      v-model="showLeaveDialog"
      title="请假申请"
      width="500px"
      :close-on-click-modal="false"
    >
      <div v-if="currentAppointment">
        <el-form :model="leaveForm" label-width="100px">
          <el-form-item label="课程">
            <el-input :value="currentAppointment.course_name" disabled />
          </el-form-item>
          <el-form-item label="上课时间">
            <el-input :value="formatDateTime(currentAppointment.start_time)" disabled />
          </el-form-item>
          <el-form-item label="请假原因">
            <el-input
              v-model="leaveForm.reason"
              type="textarea"
              placeholder="请填写请假原因"
              :rows="4"
            />
          </el-form-item>
        </el-form>
        <el-alert type="warning" style="margin-top: 20px;">
          <template #title>请假说明</template>
          <p>请假申请提交后，管理员将审核您的请假请求。</p>
          <p>请假批准后，该预约将被取消。</p>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="showLeaveDialog = false">取消</el-button>
        <el-button type="warning" @click="handleLeaveSubmit" :loading="leaveLoading">
          提交请假
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../../utils/api'
import dayjs from 'dayjs'

const appointments = ref([])
const loading = ref(false)
const filterStatus = ref('')

// Change time related
const showChangeTimeDialog = ref(false)
const changeTimeLoading = ref(false)
const changeTimeForm = reactive({
  date: '',
  timeSlot: '0',
  reason: ''
})
const changeLogs = ref([])

// Leave related
const showLeaveDialog = ref(false)
const leaveLoading = ref(false)
const leaveForm = reactive({
  reason: ''
})

// Handle leave button click
function handleLeave(appointment) {
  currentAppointment.value = appointment
  leaveForm.reason = ''
  showLeaveDialog.value = true
}

// Submit leave request
async function handleLeaveSubmit() {
  if (!leaveForm.reason) {
    ElMessage.warning('请填写请假原因')
    return
  }
  
  try {
    leaveLoading.value = true
    const response = await api.put(`/appointments/${currentAppointment.value.id}/leave`, {
      leave_reason: leaveForm.reason
    })
    
    if (response.data.success) {
      ElMessage.success('请假申请已提交')
      showLeaveDialog.value = false
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '请假申请失败')
  } finally {
    leaveLoading.value = false
  }
}

// Disable past dates
function disabledDate(time) {
  return time.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

// Handle change time button click
async function handleChangeTime(appointment) {
  currentAppointment.value = appointment
  changeTimeForm.date = ''
  changeTimeForm.timeSlot = '0'
  changeTimeForm.reason = ''
  
  // Load change logs
  try {
    const response = await api.get(`/appointments/${appointment.id}/change-logs`)
    if (response.data.success) {
      changeLogs.value = response.data.data
    }
  } catch (error) {
    console.error('获取修改记录失败:', error)
    changeLogs.value = []
  }
  
  showChangeTimeDialog.value = true
}

// Submit time change
async function handleChangeTimeSubmit() {
  if (!changeTimeForm.date) {
    ElMessage.warning('请选择日期')
    return
  }
  
  try {
    changeTimeLoading.value = true
    
    // Build new time_slot_id: courseId-year-month-day-index
    const courseId = currentAppointment.value.course_id
    const dateParts = changeTimeForm.date.split('-')
    const newTimeSlotId = `${courseId}-${dateParts[0]}-${dateParts[1]}-${dateParts[2]}-${changeTimeForm.timeSlot}`
    
    const response = await api.put(`/appointments/${currentAppointment.value.id}/change-time`, {
      new_time_slot_id: newTimeSlotId,
      change_reason: changeTimeForm.reason
    })
    
    if (response.data.success) {
      ElMessage.success('预约时间已修改')
      showChangeTimeDialog.value = false
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '修改失败')
  } finally {
    changeTimeLoading.value = false
  }
}

onMounted(async () => {
  await loadAppointments()
})

async function loadAppointments() {
  try {
    loading.value = true
    const response = await api.get('/appointments')
    if (response.data.success) {
      appointments.value = response.data.data.filter(a => 
        filterStatus.value ? a.status === filterStatus.value : true
      )
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

async function handleCancel(appointment) {
  try {
    await ElMessageBox.confirm('确定要取消这个预约吗？开课前12小时内取消不退款。', '取消预约', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.put(`/appointments/${appointment.id}/cancel`)
    if (response.data.success) {
      ElMessage.success('预约已取消')
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '取消失败')
    }
  }
}

async function handlePay(appointment) {
  // Show payment dialog
  showPaymentDialog.value = true
  currentAppointment.value = appointment
  paymentStatus.value = 'pending'
  
  // Fetch QR code based on payment method
  if (appointment.payment_method === 'wechat' || appointment.payment_method === 'alipay') {
    await fetchPaymentQrCode(appointment.payment_method)
  } else {
    paymentQrCode.value = null
  }
}

const showPaymentDialog = ref(false)
const currentAppointment = ref(null)
const paymentStatus = ref('pending')
const paymentQrCode = ref(null)
const paymentLoading = ref(false)

async function fetchPaymentQrCode(paymentType) {
  try {
    const res = await api.get(`/payment/qrcode/${paymentType}`)
    if (res.data.success && res.data.data.qr_code) {
      paymentQrCode.value = res.data.data.qr_code
    } else {
      paymentQrCode.value = null
    }
  } catch (error) {
    console.error('获取支付二维码失败:', error)
    paymentQrCode.value = null
  }
}

async function confirmPaymentStatus() {
  if (!currentAppointment.value) return
  
  try {
    paymentLoading.value = true
    const response = await api.put(`/appointments/${currentAppointment.value.id}/payment`, {
      payment_status: 'pending'
    })
    if (response.data.success) {
      ElMessage.success('支付状态已更新为"已支付，待确认"，老师将核实后确认')
      showPaymentDialog.value = false
      await loadAppointments()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '更新支付状态失败')
  } finally {
    paymentLoading.value = false
  }
}

function getPaymentMethodName(method) {
  const map = {
    cash: '现金支付',
    wechat: '微信支付',
    alipay: '支付宝',
    bank: '银行转账'
  }
  return map[method] || method
}
</script>

<style scoped>
.student-layout {
  min-height: 100vh;
  background: #f5f7fa;
}

.student-header {
  background: white;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.student-header .logo {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  text-decoration: none;
}

.student-header nav {
  display: flex;
  gap: 16px;
}

.student-header .nav-link {
  color: #333;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 4px;
}

.student-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.payment-dialog-content {
  text-align: center;
}

.payment-amount {
  margin-bottom: 20px;
}

.payment-amount .amount-label {
  font-size: 16px;
  color: #666;
}

.payment-amount .amount-value {
  font-size: 28px;
  font-weight: bold;
  color: #f56c6c;
}

.payment-method-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
}

.qr-code-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.qr-code-display .qr-tip {
  margin-top: 15px;
  color: #666;
  font-size: 14px;
}

.no-qr-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #999;
}

.no-qr-code p {
  margin: 10px 0;
}

.payment-status-section {
  margin-top: 20px;
}

.payment-note {
  margin-top: 10px;
  color: #67c23a;
  font-size: 14px;
}
</style>