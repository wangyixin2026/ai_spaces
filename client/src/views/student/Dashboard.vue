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
        <el-dropdown @command="handleCommand">
          <span class="nav-link">{{ user?.username }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>
    </header>

    <div class="student-content">
      <h1 style="font-size: 24px; margin-bottom: 30px;">欢迎回来，{{ user?.username }}</h1>
      
      <!-- Admin notice -->
      <el-alert v-if="user?.role === 'admin'" type="info" style="margin-bottom: 20px;">
        <template #title>管理员提示</template>
        您当前以管理员身份登录。如需测试学生功能，请先注册一个学生账户或为学生创建学生档案。
      </el-alert>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalAppointments || 0 }}</div>
          <div class="stat-label">总预约课程</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.completedAppointments || 0 }}</div>
          <div class="stat-label">已完成课程</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.averageScore || 0 }}</div>
          <div class="stat-label">平均作业得分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.pendingHomework?.length || 0 }}</div>
          <div class="stat-label">待完成作业</div>
        </div>
      </div>

      <!-- Upcoming Appointments -->
      <div class="card">
        <h3 class="card-title">即将上课</h3>
        <el-table v-if="upcomingAppointments.length > 0" :data="upcomingAppointments" stripe>
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
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">{{ getStatusName(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无即将上课的预约" />
      </div>

      <!-- Pending Homework -->
      <div class="card">
        <h3 class="card-title">待完成作业</h3>
        <el-table v-if="pendingHomeworkList.length > 0" :data="pendingHomeworkList" stripe>
          <el-table-column prop="title" label="作业标题" />
          <el-table-column prop="course_name" label="课程" />
          <el-table-column label="截止日期">
            <template #default="{ row }">
              {{ row.deadline ? formatDateTime(row.deadline) : '无截止日期' }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="goToHomework(row.id)">提交作业</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无待完成作业" />
      </div>

      <!-- Recent Reports -->
      <div class="card">
        <h3 class="card-title">最近学习报告</h3>
        <el-table v-if="stats.recentReports?.length > 0" :data="stats.recentReports" stripe>
          <el-table-column prop="title" label="报告标题" />
          <el-table-column prop="report_type" label="类型">
            <template #default="{ row }">
              {{ getReportTypeName(row.report_type) }}
            </template>
          </el-table-column>
          <el-table-column label="生成时间">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="goToReport(row.id)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无学习报告" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import api from '../../utils/api'
import dayjs from 'dayjs'

const router = useRouter()
const authStore = useAuthStore()
const user = computed(() => authStore.user)

const stats = ref({})
const upcomingAppointments = ref([])
const pendingHomeworkList = ref([])

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  try {
    const response = await api.get('/dashboard/student')
    if (response.data.success) {
      stats.value = response.data.data.stats || {}
      upcomingAppointments.value = response.data.data.upcomingAppointments || []
      pendingHomeworkList.value = response.data.data.pendingHomework || []
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
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

function getReportTypeName(type) {
  const map = { weekly: '周报', monthly: '月报', custom: '自定义' }
  return map[type] || type
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

function goToHomework(id) {
  router.push(`/homework`)
}

function goToReport(id) {
  router.push(`/reports`)
}

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    authStore.logout()
    router.push('/')
  }
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>