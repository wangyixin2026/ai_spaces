<template>
  <div class="course-detail-page">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <router-link to="/" class="logo">📚 课外培训约课系统</router-link>
        <nav class="nav-links">
          <router-link to="/courses" class="nav-link">课程列表</router-link>
          <router-link to="/teacher" class="nav-link">老师介绍</router-link>
          <template v-if="isLoggedIn">
            <router-link v-if="isAdmin" to="/admin" class="nav-link">管理后台</router-link>
            <router-link v-else to="/dashboard" class="nav-link">我的预约</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="nav-link">登录</router-link>
          </template>
        </nav>
      </div>
    </header>

    <div class="container" style="padding-top: 40px;">
      <el-skeleton v-if="loading" animated />
      
      <template v-else-if="course">
        <div class="course-header">
          <span :class="['course-subject', `subject-${course.subject}`]">{{ getSubjectName(course.subject) }}</span>
          <h1 style="font-size: 28px; margin: 16px 0;">{{ course.name }}</h1>
          <p style="color: #666; font-size: 16px;">{{ course.description || '暂无描述' }}</p>
          <p class="course-price" style="font-size: 32px;">¥{{ course.price }}/节</p>
        </div>

        <div class="course-info-grid">
          <div class="card">
            <h3 class="card-title">课程信息</h3>
            <p><strong>适合年级:</strong> {{ course.grade_level || '不限' }}</p>
            <p><strong>课程时长:</strong> {{ course.duration }}分钟</p>
            <p><strong>上课形式:</strong> {{ course.max_students === 1 ? '一对一' : '小班课(最多' + course.max_students + '人)' }}</p>
            <p><strong>课程状态:</strong> {{ course.status === 'active' ? '开放预约' : '暂停预约' }}</p>
          </div>

          <div class="card">
            <h3 class="card-title">预约须知</h3>
            <p>• 请提前24小时预约课程</p>
            <p>• 取消预约需提前12小时</p>
            <p>• 12小时内取消不退款</p>
            <p>• 请按时参加课程</p>
          </div>
        </div>

        <!-- Time Slots -->
        <div class="card" style="margin-top: 20px;">
          <h3 class="card-title">可预约时间段</h3>
          <el-calendar v-model="selectedDate" />
          
          <div v-if="timeSlots.length > 0" style="margin-top: 20px;">
            <h4 style="margin-bottom: 16px;">{{ formatDate(selectedDate) }} 可预约时段</h4>
            <div class="time-slots-grid">
              <div 
                v-for="slot in timeSlots" 
                :key="slot.id" 
                class="time-slot"
                :class="{ 'selected': selectedSlot?.id === slot.id }"
                @click="selectSlot(slot)"
              >
                <p class="time">{{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}</p>
                <p class="capacity">剩余: {{ slot.max_capacity - slot.current_booked }}位</p>
              </div>
            </div>
          </div>
          <el-empty v-else description="该日期暂无可预约时段" />
        </div>

        <!-- Booking Form -->
        <div v-if="isLoggedIn && !isAdmin && selectedSlot" class="card" style="margin-top: 20px;">
          <h3 class="card-title">确认预约</h3>
          <el-form :model="bookingForm" ref="bookingFormRef" label-width="100px">
            <el-form-item label="课程">
              <el-input :value="course.name" disabled />
            </el-form-item>
            <el-form-item label="时间">
              <el-input :value="formatDateTime(selectedSlot.start_time)" disabled />
            </el-form-item>
            <el-form-item label="时长">
              <el-input :value="course.duration + '分钟'" disabled />
            </el-form-item>
            <el-form-item label="费用">
              <el-input :value="'¥' + course.price" disabled />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="bookingForm.notes" type="textarea" placeholder="如有特殊需求请填写" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" @click="handleBooking" :loading="bookingLoading">
                确认预约
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div v-if="!isLoggedIn" class="card" style="margin-top: 20px; text-align: center;">
          <p style="margin-bottom: 16px;">请登录后预约课程</p>
          <router-link to="/login">
            <el-button type="primary">立即登录</el-button>
          </router-link>
        </div>
      </template>

      <el-empty v-else description="课程不存在" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAdmin = computed(() => authStore.isAdmin)

const loading = ref(true)
const bookingLoading = ref(false)
const course = ref(null)
const timeSlots = ref([])
const selectedDate = ref(new Date())
const selectedSlot = ref(null)
const bookingFormRef = ref()

const bookingForm = reactive({
  notes: ''
})

onMounted(async () => {
  await loadCourse()
})

watch(selectedDate, async () => {
  await loadTimeSlots()
})

async function loadCourse() {
  try {
    loading.value = true
    const response = await api.get(`/courses/${route.params.id}`)
    if (response.data.success) {
      course.value = response.data.data
      await loadTimeSlots()
    }
  } catch (error) {
    console.error('获取课程失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadTimeSlots() {
  try {
    const dateStr = dayjs(selectedDate.value).format('YYYY-MM-DD')
    const response = await api.get(`/courses/${route.params.id}/slots`, {
      params: { start_date: dateStr, end_date: dateStr }
    })
    if (response.data.success) {
      timeSlots.value = response.data.data.filter(s => s.status === 'available')
    }
  } catch (error) {
    console.error('获取时间段失败:', error)
  }
}

function getSubjectName(subject) {
  const map = {
    math: '数学',
    english: '英语',
    chinese: '语文'
  }
  return map[subject] || subject
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

function selectSlot(slot) {
  if (slot.max_capacity - slot.current_booked > 0) {
    selectedSlot.value = slot
  } else {
    ElMessage.warning('该时段已满')
  }
}

async function handleBooking() {
  try {
    bookingLoading.value = true
    const response = await api.post('/appointments', {
      course_id: course.value.id,
      time_slot_id: selectedSlot.value.id,
      notes: bookingForm.notes
    })
    
    if (response.data.success) {
      ElMessage.success('预约成功')
      router.push('/appointments')
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '预约失败')
  } finally {
    bookingLoading.value = false
  }
}
</script>

<style scoped>
.course-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.course-header {
  background: white;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.course-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.time-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.time-slot {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.time-slot:hover {
  background: #e6f7ff;
}

.time-slot.selected {
  background: #409eff;
  color: white;
}

.time-slot .time {
  font-weight: bold;
  margin-bottom: 8px;
}

.time-slot .capacity {
  font-size: 12px;
  color: #666;
}

.time-slot.selected .capacity {
  color: white;
}

@media (max-width: 768px) {
  .course-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>