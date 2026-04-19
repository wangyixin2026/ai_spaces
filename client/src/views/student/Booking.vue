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
      <h1 style="font-size: 24px; margin-bottom: 30px;">预约课程</h1>

      <!-- Step 1: Course Selection -->
      <div class="card">
        <h3 class="card-title">
          <el-tag type="primary" size="small">步骤 1</el-tag>
          选择课程
        </h3>
        <el-select v-model="selectedCourse" placeholder="请选择课程" size="large" style="width: 100%;" @change="onCourseChange">
          <el-option v-for="course in courses" :key="course.id" :label="course.name" :value="course.id">
            <span>{{ course.name }}</span>
            <span style="color: #999; margin-left: 10px;">{{ getSubjectName(course.subject) }} - ¥{{ course.price }}/节</span>
          </el-option>
        </el-select>
        
        <!-- Course Info -->
        <div v-if="selectedCourseInfo" class="course-info-box">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="课程名称">{{ selectedCourseInfo.name }}</el-descriptions-item>
            <el-descriptions-item label="科目">{{ getSubjectName(selectedCourseInfo.subject) }}</el-descriptions-item>
            <el-descriptions-item label="课程时长">{{ selectedCourseInfo.duration }}分钟</el-descriptions-item>
            <el-descriptions-item label="单价">¥{{ selectedCourseInfo.price }}/节</el-descriptions-item>
            <el-descriptions-item label="适合年级">{{ selectedCourseInfo.grade_level || '不限' }}</el-descriptions-item>
            <el-descriptions-item label="上课形式">{{ selectedCourseInfo.max_students === 1 ? '一对一' : '小班课(最多' + selectedCourseInfo.max_students + '人)' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <!-- Step 2: Class Count -->
      <div v-if="selectedCourse" class="card">
        <h3 class="card-title">
          <el-tag type="primary" size="small">步骤 2</el-tag>
          选择课时数量
        </h3>
        <el-form label-width="100px">
          <el-form-item label="课时数量">
            <el-input-number v-model="bookingForm.classCount" :min="1" :max="999" size="large" />
            <span style="margin-left: 15px; color: #409eff; font-weight: bold;">
              总费用：¥{{ totalPrice }}
            </span>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 3: Date and Time -->
      <div v-if="selectedCourse && bookingForm.classCount > 0" class="card">
        <h3 class="card-title">
          <el-tag type="primary" size="small">步骤 3</el-tag>
          选择上课日期和时间
        </h3>
        
        <el-alert type="info" style="margin-bottom: 20px;">
          <template #title>提示</template>
          请为 {{ bookingForm.classCount }} 节课选择上课时间。您可以选择多个时间段。
        </el-alert>

        <el-calendar v-model="selectedDate" />
        
        <div v-if="slots.length > 0" style="margin-top: 20px;">
          <h4 style="margin-bottom: 16px;">{{ formatDate(selectedDate) }} 可预约时段</h4>
          <div class="time-slots-grid">
            <div 
              v-for="slot in slots" 
              :key="slot.id" 
              class="time-slot"
              :class="{ 
                'selected': selectedSlots.some(s => s.id === slot.id), 
                'disabled': slot.current_booked >= slot.max_capacity 
              }"
              @click="toggleSlot(slot)"
            >
              <p class="time">{{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}</p>
              <p class="capacity">剩余: {{ slot.max_capacity - slot.current_booked }}位</p>
              <el-icon v-if="selectedSlots.some(s => s.id === slot.id)" class="check-icon"><Check /></el-icon>
            </div>
          </div>
        </div>
        <el-empty v-else-if="selectedCourse" description="该日期暂无可预约时段，请选择其他日期或联系管理员添加排期" />
        
        <!-- Selected Slots Summary -->
        <div v-if="selectedSlots.length > 0" class="selected-slots-summary">
          <h4>已选择的时间段 ({{ selectedSlots.length }}/{{ bookingForm.classCount }})</h4>
          <el-tag 
            v-for="slot in selectedSlots" 
            :key="slot.id" 
            type="success" 
            closable 
            @close="removeSlot(slot)"
            style="margin: 5px;"
          >
            {{ formatDateTime(slot.start_time) }}
          </el-tag>
          <el-alert v-if="selectedSlots.length < bookingForm.classCount" type="warning" style="margin-top: 10px;">
            还需要选择 {{ bookingForm.classCount - selectedSlots.length }} 个时间段
          </el-alert>
        </div>
      </div>

      <!-- Step 4: Payment Method -->
      <div v-if="selectedSlots.length >= bookingForm.classCount && bookingForm.classCount > 0" class="card">
        <h3 class="card-title">
          <el-tag type="primary" size="small">步骤 4</el-tag>
          选择支付方式
        </h3>
        <el-radio-group v-model="bookingForm.paymentMethod" size="large">
          <el-radio-button label="cash">现金支付</el-radio-button>
          <el-radio-button label="wechat">微信支付</el-radio-button>
          <el-radio-button label="alipay">支付宝</el-radio-button>
          <el-radio-button label="bank">银行转账</el-radio-button>
        </el-radio-group>
        
        <div class="payment-info">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="课程">{{ selectedCourseInfo?.name }}</el-descriptions-item>
            <el-descriptions-item label="课时数量">{{ bookingForm.classCount }} 节</el-descriptions-item>
            <el-descriptions-item label="单价">¥{{ selectedCourseInfo?.price }}/节</el-descriptions-item>
            <el-descriptions-item label="总费用">
              <span style="color: #f56c6c; font-size: 18px; font-weight: bold;">¥{{ totalPrice }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ getPaymentMethodName(bookingForm.paymentMethod) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <!-- Step 5: Confirm Booking -->
      <div v-if="selectedSlots.length >= bookingForm.classCount && bookingForm.classCount > 0" class="card">
        <h3 class="card-title">
          <el-tag type="primary" size="small">步骤 5</el-tag>
          确认预约信息
        </h3>
        <el-form :model="bookingForm" label-width="100px">
          <el-form-item label="备注">
            <el-input v-model="bookingForm.notes" type="textarea" :rows="3" placeholder="如有特殊需求请填写（可选）" />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              @click="handleBooking"
              :loading="loading"
              :disabled="selectedSlots.length < bookingForm.classCount"
            >
              确认预约并提交
            </el-button>
            <el-button size="large" @click="resetForm">重新选择</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- Payment QR Code Dialog -->
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
          <span class="amount-value">¥{{ totalPrice }}</span>
        </div>
        
        <div class="payment-method-display">
          <el-icon v-if="bookingForm.paymentMethod === 'wechat'" style="color: #07C160; font-size: 24px;"><ChatDotRound /></el-icon>
          <el-icon v-else-if="bookingForm.paymentMethod === 'alipay'" style="color: #1677FF; font-size: 24px;"><Wallet /></el-icon>
          <span>{{ getPaymentMethodName(bookingForm.paymentMethod) }}</span>
        </div>

        <div v-if="paymentQrCode" class="qr-code-display">
          <el-image
            :src="paymentQrCode"
            fit="contain"
            style="width: 250px; height: 250px;"
          />
          <p class="qr-tip">请使用{{ getPaymentMethodName(bookingForm.paymentMethod) }}扫码支付</p>
        </div>
        <div v-else class="no-qr-code">
          <el-icon size="60" color="#ccc"><Picture /></el-icon>
          <p>管理员暂未配置{{ getPaymentMethodName(bookingForm.paymentMethod) }}收款码</p>
          <p>请联系管理员获取支付信息</p>
        </div>

        <!-- Payment Status Selection -->
        <div class="payment-status-section">
          <el-divider>支付状态</el-divider>
          <el-radio-group v-model="paymentStatus" size="large">
            <el-radio-button label="pending">待支付</el-radio-button>
            <el-radio-button label="paid">已支付</el-radio-button>
          </el-radio-group>
          <p v-if="paymentStatus === 'paid'" class="payment-note">
            <el-icon style="color: #67c23a;"><Check /></el-icon>
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
          @click="confirmPayment"
          :loading="paymentLoading"
          :disabled="paymentStatus !== 'paid'"
        >
          我已支付
        </el-button>
        <el-button type="primary" @click="goToAppointments">查看我的预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, ChatDotRound, Wallet, Picture } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const router = useRouter()

const courses = ref([])
const selectedCourse = ref(null)
const selectedDate = ref(new Date())
const slots = ref([])
const selectedSlots = ref([])
const loading = ref(false)
const showPaymentDialog = ref(false)
const paymentQrCode = ref(null)
const paymentStatus = ref('pending')
const paymentLoading = ref(false)
const bookedAppointmentIds = ref([])

const bookingForm = reactive({
  classCount: 1,
  paymentMethod: 'cash',
  notes: ''
})

const selectedCourseInfo = computed(() => {
  return courses.value.find(c => c.id === selectedCourse.value)
})

const totalPrice = computed(() => {
  return (selectedCourseInfo.value?.price || 0) * bookingForm.classCount
})

onMounted(async () => {
  await loadCourses()
})

watch(selectedDate, async () => {
  if (selectedCourse.value) {
    await loadSlots()
  }
})

// Also watch for course change to load slots
watch(selectedCourse, async () => {
  if (selectedCourse.value) {
    await loadSlots()
  }
})

function onCourseChange() {
  selectedSlots.value = []
  bookingForm.classCount = 1
  loadSlots()
}

async function loadCourses() {
  try {
    const response = await api.get('/courses')
    if (response.data.success) {
      courses.value = response.data.data.filter(c => c.status === 'active')
    }
  } catch (error) {
    console.error('获取课程失败:', error)
    ElMessage.error('获取课程列表失败')
  }
}

async function loadSlots() {
  try {
    slots.value = [] // Clear previous slots
    const dateStr = dayjs(selectedDate.value).format('YYYY-MM-DD')
    console.log('Loading slots for course:', selectedCourse.value, 'date:', dateStr)
    
    const response = await api.get(`/courses/${selectedCourse.value}/slots`, {
      params: { start_date: dateStr, end_date: dateStr }
    })
    
    console.log('Slots response:', response.data)
    
    if (response.data.success) {
      const availableSlots = response.data.data.filter(s => s.status === 'available')
      slots.value = availableSlots
      console.log('Available slots:', availableSlots.length)
      
      if (availableSlots.length === 0) {
        ElMessage.info('该日期暂无可预约时段，请选择4月14日或4月15日')
      }
    }
  } catch (error) {
    console.error('获取时间段失败:', error)
    slots.value = []
    ElMessage.error('获取时间段失败，请稍后重试')
  }
}

function toggleSlot(slot) {
  if (slot.max_capacity - slot.current_booked <= 0) {
    ElMessage.warning('该时段已满')
    return
  }
  
  const index = selectedSlots.value.findIndex(s => s.id === slot.id)
  if (index > -1) {
    selectedSlots.value.splice(index, 1)
  } else {
    if (selectedSlots.value.length >= bookingForm.classCount) {
      ElMessage.warning(`已选择足够的时间段（${bookingForm.classCount}节），如需更换请先取消已选时段`)
      return
    }
    selectedSlots.value.push(slot)
  }
}

function removeSlot(slot) {
  const index = selectedSlots.value.findIndex(s => s.id === slot.id)
  if (index > -1) {
    selectedSlots.value.splice(index, 1)
  }
}

function getSubjectName(subject) {
  const map = { math: '数学', english: '英语', chinese: '语文' }
  return map[subject] || subject
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

function formatDate(date) {
  return dayjs(date).format('YYYY年MM月DD日')
}

function formatTime(datetime) {
  return dayjs(datetime).format('HH:mm')
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

function resetForm() {
  selectedCourse.value = null
  selectedSlots.value = []
  bookingForm.classCount = 1
  bookingForm.paymentMethod = 'cash'
  bookingForm.notes = ''
}

async function handleBooking() {
  if (selectedSlots.value.length < bookingForm.classCount) {
    ElMessage.warning('请选择足够的时间段')
    return
  }
  
  try {
    loading.value = true
    
    // Create appointments for each selected slot
    const promises = selectedSlots.value.map(slot =>
      api.post('/appointments', {
        course_id: selectedCourse.value,
        time_slot_id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        notes: bookingForm.notes,
        payment_method: bookingForm.paymentMethod,
        total_amount: totalPrice.value,
        class_count: bookingForm.classCount
      })
    )
    
    const results = await Promise.all(promises)
    const successResults = results.filter(r => r.data.success)
    const successCount = successResults.length
    
    if (successCount > 0) {
      // Store booked appointment IDs for payment confirmation
      bookedAppointmentIds.value = successResults.map(r => r.data.data.id)
      
      ElMessage.success(`成功预约 ${successCount} 节课程！`)
      
      // If payment method is wechat or alipay, show QR code dialog
      if (bookingForm.paymentMethod === 'wechat' || bookingForm.paymentMethod === 'alipay') {
        paymentStatus.value = 'pending'
        await fetchPaymentQrCode(bookingForm.paymentMethod)
        showPaymentDialog.value = true
      } else {
        ElMessage.info(`总费用 ¥${totalPrice.value}，支付方式：${getPaymentMethodName(bookingForm.paymentMethod)}`)
        router.push('/appointments')
      }
    } else {
      ElMessage.error('预约失败，请稍后重试')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '预约失败')
  } finally {
    loading.value = false
  }
}

async function confirmPayment() {
  if (bookedAppointmentIds.value.length === 0) {
    ElMessage.warning('没有可更新的预约')
    return
  }
  
  try {
    paymentLoading.value = true
    
    // Update payment status for all booked appointments
    const promises = bookedAppointmentIds.value.map(id =>
      api.put(`/appointments/${id}/payment`, {
        payment_status: 'pending'
      })
    )
    
    const results = await Promise.all(promises)
    const successCount = results.filter(r => r.data.success).length
    
    if (successCount > 0) {
      ElMessage.success('支付状态已更新为"已支付，待确认"，老师将核实后确认')
      showPaymentDialog.value = false
      router.push('/appointments')
    } else {
      ElMessage.error('更新支付状态失败')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '更新支付状态失败')
  } finally {
    paymentLoading.value = false
  }
}

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

function goToAppointments() {
  showPaymentDialog.value = false
  router.push('/appointments')
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
  transition: background-color 0.3s;
}

.student-header .nav-link:hover {
  background-color: #f5f7fa;
}

.student-content {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 18px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.course-info-box {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.time-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.time-slot {
  background: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.time-slot:hover:not(.disabled) {
  border-color: #409eff;
  background: #ecf5ff;
}

.time-slot.selected {
  border-color: #67c23a;
  background: #f0f9eb;
}

.time-slot.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.time-slot .time {
  font-size: 14px;
  font-weight: bold;
  margin: 0 0 5px 0;
}

.time-slot .capacity {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

.time-slot .check-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  color: #67c23a;
  font-size: 16px;
}

.selected-slots-summary {
  margin-top: 20px;
  padding: 15px;
  background: #f0f9eb;
  border-radius: 8px;
  border: 1px solid #67c23a;
}

.selected-slots-summary h4 {
  margin: 0 0 10px 0;
  color: #67c23a;
}

.payment-info {
  margin-top: 20px;
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

@media (max-width: 768px) {
  .student-header {
    flex-direction: column;
    gap: 10px;
  }
  
  .student-header nav {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .time-slots-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>