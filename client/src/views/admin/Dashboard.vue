<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="logo">📚 管理后台</div>
      <ul class="admin-menu">
        <li class="admin-menu-item active" @click="$router.push('/admin')">
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
      <div style="padding: 20px; text-align: center;">
        <el-button type="danger" size="small" @click="handleLogout">退出登录</el-button>
      </div>
    </aside>

    <main class="admin-content">
      <h1 style="font-size: 24px; margin-bottom: 30px;">数据概览</h1>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card clickable" @click="$router.push('/admin/students')">
          <div class="stat-value">{{ stats.stats?.totalStudents || 0 }}</div>
          <div class="stat-label">学生总数</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
        <div class="stat-card clickable" @click="$router.push('/admin/courses')">
          <div class="stat-value">{{ stats.stats?.totalCourses || 0 }}</div>
          <div class="stat-label">活跃课程</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
        <div class="stat-card clickable" @click="$router.push('/admin/appointments?filter=thisMonth')">
          <div class="stat-value">{{ stats.stats?.appointmentsThisMonth || 0 }}</div>
          <div class="stat-label">本月预约</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
        <div class="stat-card clickable" @click="$router.push('/admin/appointments?filter=pending')">
          <div class="stat-value">{{ stats.stats?.pendingAppointments || 0 }}</div>
          <div class="stat-label">待确认预约</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
      </div>

      <!-- Revenue -->
      <div class="stats-grid" style="margin-bottom: 30px;">
        <div class="stat-card clickable" @click="$router.push('/admin/appointments?filter=completed')">
          <div class="stat-value">{{ stats.stats?.completedThisMonth || 0 }}</div>
          <div class="stat-label">本月完成</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
        <div class="stat-card clickable" @click="$router.push('/admin/appointments?filter=thisMonth')">
          <div class="stat-value">¥{{ stats.stats?.revenueThisMonth || 0 }}</div>
          <div class="stat-label">本月收入</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
        <div class="stat-card clickable" @click="$router.push('/admin/appointments?filter=unpaid')">
          <div class="stat-value">{{ stats.stats?.unpaidAppointments || 0 }}</div>
          <div class="stat-label">未支付预约</div>
          <div class="stat-hint">点击查看详情</div>
        </div>
      </div>

      <!-- Recent Appointments -->
      <div class="card">
        <h3 class="card-title">最近预约</h3>
        <el-table :data="stats.recentAppointments || []" stripe>
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
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">{{ getStatusName(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Upcoming Classes -->
      <div class="card">
        <h3 class="card-title">即将上课</h3>
        <el-table :data="stats.upcomingClasses || []" stripe>
          <el-table-column prop="student_name" label="学生" />
          <el-table-column prop="course_name" label="课程" />
          <el-table-column prop="subject" label="科目">
            <template #default="{ row }">
              <el-tag>{{ getSubjectName(row.subject) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上课时间">
            <template #default="{ row }">
              {{ formatDateTime(row.start_time) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import api from '../../utils/api'
import dayjs from 'dayjs'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const stats = ref({})

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  try {
    const response = await api.get('/dashboard/admin')
    if (response.data.success) {
      stats.value = response.data.data
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

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

function handleLogout() {
  authStore.logout()
  router.push('/')
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

.stat-card.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
}

.stat-card.clickable:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  background: #f0f7ff;
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

.stat-hint {
  color: #999;
  font-size: 12px;
  margin-top: 5px;
  opacity: 0;
  transition: opacity 0.3s;
}

.stat-card.clickable:hover .stat-hint {
  opacity: 1;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>