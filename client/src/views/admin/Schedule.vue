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
        <li class="admin-menu-item active" @click="$router.push('/admin/schedule')">
          <el-icon><Calendar /></el-icon>
          <span>时间管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/students')">
          <el-icon><User /></el-icon>
          <span>学生管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/appointments')">
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
      <h1 style="font-size: 24px; margin-bottom: 30px;">时间管理</h1>

      <!-- Course Selection -->
      <div class="card">
        <h3 class="card-title">选择课程</h3>
        <el-select v-model="selectedCourse" placeholder="请选择课程" size="large" style="width: 300px;" @change="loadSlots">
          <el-option v-for="course in courses" :key="course.id" :label="course.name" :value="course.id" />
        </el-select>
        <el-button type="primary" style="margin-left: 20px;" @click="openAddDialog" :disabled="!selectedCourse">
          <el-icon><Plus /></el-icon>
          添加时间段
        </el-button>
      </div>

      <!-- Calendar View -->
      <div v-if="selectedCourse" class="card">
        <h3 class="card-title">可预约时间段</h3>
        <el-calendar v-model="selectedDate" />
        
        <div v-if="slots.length > 0" style="margin-top: 20px;">
          <h4 style="margin-bottom: 16px;">{{ formatDate(selectedDate) }} 的时间段</h4>
          <el-table :data="slots" stripe>
            <el-table-column label="开始时间">
              <template #default="{ row }">
                {{ formatTime(row.start_time) }}
              </template>
            </el-table-column>
            <el-table-column label="结束时间">
              <template #default="{ row }">
                {{ formatTime(row.end_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="max_capacity" label="最大人数" />
            <el-table-column prop="current_booked" label="已预约" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'available' ? 'success' : row.status === 'full' ? 'danger' : 'info'">
                  {{ row.status === 'available' ? '可预约' : row.status === 'full' ? '已满' : '已过期' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="handleDeleteSlot(row)" :disabled="row.current_booked > 0">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else description="该日期暂无时间段" />
      </div>
    </main>

    <!-- Add Slot Dialog -->
    <el-dialog v-model="addDialogVisible" title="添加时间段" width="500px">
      <el-form :model="slotForm" ref="slotFormRef" label-width="100px" :rules="slotRules">
        <el-form-item label="开始时间" prop="start_time">
          <el-date-picker v-model="slotForm.start_time" type="datetime" placeholder="选择开始时间" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="结束时间" prop="end_time">
          <el-date-picker v-model="slotForm.end_time" type="datetime" placeholder="选择结束时间" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="最大人数">
          <el-input-number v-model="slotForm.max_capacity" :min="1" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddSlot" :loading="addLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet, Plus } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const courses = ref([])
const selectedCourse = ref(null)
const selectedDate = ref(new Date())
const slots = ref([])
const addDialogVisible = ref(false)
const addLoading = ref(false)
const slotFormRef = ref()

const slotForm = reactive({
  start_time: '',
  end_time: '',
  max_capacity: 1
})

const slotRules = {
  start_time: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  end_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

onMounted(async () => {
  await loadCourses()
})

watch(selectedDate, async () => {
  if (selectedCourse.value) {
    await loadSlots()
  }
})

async function loadCourses() {
  try {
    const response = await api.get('/courses')
    if (response.data.success) {
      courses.value = response.data.data
    }
  } catch (error) {
    console.error('获取课程失败:', error)
  }
}

async function loadSlots() {
  try {
    const dateStr = dayjs(selectedDate.value).format('YYYY-MM-DD')
    const response = await api.get(`/courses/${selectedCourse.value}/slots`, {
      params: { start_date: dateStr, end_date: dateStr }
    })
    if (response.data.success) {
      slots.value = response.data.data
    }
  } catch (error) {
    console.error('获取时间段失败:', error)
  }
}

function formatDate(date) {
  return dayjs(date).format('YYYY年MM月DD日')
}

function formatTime(datetime) {
  return dayjs(datetime).format('HH:mm')
}

function openAddDialog() {
  slotForm.start_time = ''
  slotForm.end_time = ''
  slotForm.max_capacity = 1
  addDialogVisible.value = true
}

async function handleAddSlot() {
  try {
    await slotFormRef.value.validate()
    addLoading.value = true
    
    const response = await api.post(`/courses/${selectedCourse.value}/slots`, {
      start_time: dayjs(slotForm.start_time).format('YYYY-MM-DD HH:mm:ss'),
      end_time: dayjs(slotForm.end_time).format('YYYY-MM-DD HH:mm:ss'),
      max_capacity: slotForm.max_capacity
    })
    
    if (response.data.success) {
      ElMessage.success('时间段添加成功')
      addDialogVisible.value = false
      await loadSlots()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '添加失败')
  } finally {
    addLoading.value = false
  }
}

async function handleDeleteSlot(slot) {
  if (slot.current_booked > 0) {
    ElMessage.warning('该时间段已有预约，无法删除')
    return
  }
  
  try {
    await ElMessageBox.confirm('确定要删除这个时间段吗？', '删除时间段', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.delete(`/courses/${selectedCourse.value}/slots/${slot.id}`)
    if (response.data.success) {
      ElMessage.success('时间段删除成功')
      await loadSlots()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '删除失败')
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