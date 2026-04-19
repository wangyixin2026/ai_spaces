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
        <li class="admin-menu-item active" @click="$router.push('/admin/students')">
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
      <h1 style="font-size: 24px; margin-bottom: 30px;">学生管理</h1>

      <!-- Search -->
      <div class="card">
        <el-input v-model="searchText" placeholder="搜索学生姓名/学校" style="width: 300px;" @input="loadStudents" clearable>
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- Student List -->
      <div class="card">
        <el-table :data="students" stripe v-loading="loading">
          <el-table-column prop="name" label="姓名" />
          <el-table-column prop="gender" label="性别">
            <template #default="{ row }">
              {{ row.gender || '未设置' }}
            </template>
          </el-table-column>
          <el-table-column prop="grade" label="年级" />
          <el-table-column prop="school" label="学校" />
          <el-table-column prop="parent_phone" label="家长电话" />
          <el-table-column prop="username" label="账号" />
          <el-table-column label="操作" width="280">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewStudent(row)">查看详情</el-button>
              <el-button type="warning" size="small" @click="showResetPassword(row)">重置密码</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- View Dialog -->
    <el-dialog v-model="viewDialogVisible" title="学生详情" width="600px">
      <div v-if="currentStudent">
        <h3 style="margin-bottom: 20px;">{{ currentStudent.name }}</h3>
        
        <div class="student-info">
          <p><strong>性别:</strong> {{ currentStudent.gender || '未设置' }}</p>
          <p><strong>年级:</strong> {{ currentStudent.grade || '未设置' }}</p>
          <p><strong>学校:</strong> {{ currentStudent.school || '未设置' }}</p>
          <p><strong>家长姓名:</strong> {{ currentStudent.parent_name || '未设置' }}</p>
          <p><strong>家长电话:</strong> {{ currentStudent.parent_phone || '未设置' }}</p>
          <p><strong>账号:</strong> {{ currentStudent.username }}</p>
        </div>

        <h4 style="margin-top: 20px;">最近预约</h4>
        <el-table :data="currentStudent.appointments" stripe size="small">
          <el-table-column prop="course_name" label="课程" />
          <el-table-column label="上课时间">
            <template #default="{ row }">
              {{ row.start_time ? formatDateTime(row.start_time) : '待安排' }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">{{ getStatusName(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="payment_status" label="支付状态">
            <template #default="{ row }">
              <el-tag :type="getPaymentStatusType(row.payment_status)">{{ getPaymentStatusName(row.payment_status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!currentStudent.appointments || currentStudent.appointments.length === 0" description="暂无预约记录" />

        <h4 style="margin-top: 20px;">最近作业提交</h4>
        <el-table :data="currentStudent.homeworkSubmissions" stripe size="small">
          <el-table-column prop="homework_title" label="作业" />
          <el-table-column prop="course_name" label="课程" />
          <el-table-column prop="score" label="得分">
            <template #default="{ row }">
              {{ row.score || '未批改' }}
            </template>
          </el-table-column>
          <el-table-column label="状态">
            <template #default="{ row }">
              <el-tag v-if="row.is_late" type="danger">补交</el-tag>
              <el-tag v-else :type="row.status === 'graded' ? 'success' : 'warning'">
                {{ row.status === 'graded' ? '已批改' : '待批改' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交时间">
            <template #default="{ row }">
              {{ formatDateTime(row.submitted_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!currentStudent.homeworkSubmissions || currentStudent.homeworkSubmissions.length === 0" description="暂无作业提交" />
      </div>
    </el-dialog>

    <!-- Reset Password Dialog -->
    <el-dialog v-model="resetPasswordDialogVisible" title="重置学生密码" width="400px">
      <div v-if="resetPasswordStudent">
        <p style="margin-bottom: 20px;">学生: <strong>{{ resetPasswordStudent.name }}</strong> (账号: {{ resetPasswordStudent.username }})</p>
        <el-form>
          <el-form-item label="新密码">
            <el-input v-model="newPassword" type="password" placeholder="请输入新密码" show-password />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="resetPasswordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResetPassword" :loading="resetPasswordLoading">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet, Search } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const loading = ref(false)
const students = ref([])
const searchText = ref('')
const viewDialogVisible = ref(false)
const currentStudent = ref(null)

// Reset password related
const resetPasswordDialogVisible = ref(false)
const resetPasswordStudent = ref(null)
const newPassword = ref('')
const resetPasswordLoading = ref(false)

onMounted(async () => {
  await loadStudents()
})

async function loadStudents() {
  try {
    loading.value = true
    const response = await api.get('/students', {
      params: { search: searchText.value }
    })
    if (response.data.success) {
      students.value = response.data.data
    }
  } catch (error) {
    console.error('获取学生失败:', error)
  } finally {
    loading.value = false
  }
}

async function viewStudent(student) {
  try {
    const response = await api.get(`/students/${student.id}`)
    if (response.data.success) {
      currentStudent.value = response.data.data
      viewDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取学生详情失败:', error)
  }
}

async function handleDelete(student) {
  try {
    await ElMessageBox.confirm('确定要删除这个学生吗？相关数据也会被删除。', '删除学生', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.delete(`/students/${student.id}`)
    if (response.data.success) {
      ElMessage.success('学生删除成功')
      await loadStudents()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '删除失败')
    }
  }
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
  const map = { unpaid: '未支付', pending: '待确认', confirmed: '已支付' }
  return map[status] || status
}

function getPaymentStatusType(status) {
  const map = { unpaid: 'danger', pending: 'warning', confirmed: 'success' }
  return map[status] || 'info'
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

// Show reset password dialog
function showResetPassword(student) {
  resetPasswordStudent.value = student
  newPassword.value = ''
  resetPasswordDialogVisible.value = true
}

// Handle reset password
async function handleResetPassword() {
  if (!newPassword.value) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (newPassword.value.length < 6) {
    ElMessage.warning('密码长度至少6位')
    return
  }
  
  try {
    resetPasswordLoading.value = true
    const response = await api.put(`/users/${resetPasswordStudent.value.user_id}/password`, {
      newPassword: newPassword.value
    })
    if (response.data.success) {
      ElMessage.success('密码重置成功')
      resetPasswordDialogVisible.value = false
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '密码重置失败')
  } finally {
    resetPasswordLoading.value = false
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

.student-info {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}

.student-info p {
  margin-bottom: 8px;
}
</style>