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
        <li class="admin-menu-item" @click="$router.push('/admin/appointments')">
          <el-icon><Clock /></el-icon>
          <span>预约管理</span>
        </li>
        <li class="admin-menu-item" @click="$router.push('/admin/homework')">
          <el-icon><Document /></el-icon>
          <span>作业管理</span>
        </li>
        <li class="admin-menu-item active" @click="$router.push('/admin/reports')">
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
      <h1 style="font-size: 24px; margin-bottom: 30px;">学习报告</h1>

      <!-- Generate Report Button -->
      <div class="card">
        <el-button type="primary" @click="openGenerateDialog">
          <el-icon><Plus /></el-icon>
          生成报告
        </el-button>
      </div>

      <!-- Reports List -->
      <div class="card">
        <el-table :data="reports" stripe v-loading="loading">
          <el-table-column prop="title" label="报告标题" />
          <el-table-column prop="student_name" label="学生" />
          <el-table-column prop="report_type" label="类型">
            <template #default="{ row }">
              <el-tag>{{ getReportTypeName(row.report_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报告周期">
            <template #default="{ row }">
              {{ row.period_start }} - {{ row.period_end }}
            </template>
          </el-table-column>
          <el-table-column prop="attendance_rate" label="出勤率">
            <template #default="{ row }">
              {{ row.attendance_rate ? row.attendance_rate + '%' : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="average_score" label="平均得分">
            <template #default="{ row }">
              {{ row.average_score || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="生成时间">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewReport(row)">查看</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- Generate Dialog -->
    <el-dialog v-model="generateDialogVisible" title="生成学习报告" width="500px">
      <el-form :model="generateForm" ref="generateFormRef" label-width="100px" :rules="generateRules">
        <el-form-item label="学生" prop="student_id">
          <el-select v-model="generateForm.student_id" placeholder="请选择学生" style="width: 100%;">
            <el-option v-for="student in students" :key="student.id" :label="student.name" :value="student.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="报告类型" prop="report_type">
          <el-select v-model="generateForm.report_type" placeholder="请选择类型" style="width: 100%;">
            <el-option label="周报" value="weekly" />
            <el-option label="月报" value="monthly" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" prop="period_start">
          <el-date-picker v-model="generateForm.period_start" type="date" placeholder="选择开始日期" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="结束日期" prop="period_end">
          <el-date-picker v-model="generateForm.period_end" type="date" placeholder="选择结束日期" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGenerate" :loading="generateLoading">自动生成</el-button>
      </template>
    </el-dialog>

    <!-- View Dialog -->
    <el-dialog v-model="viewDialogVisible" title="学习报告详情" width="600px">
      <div v-if="currentReport">
        <h3 style="margin-bottom: 20px;">{{ currentReport.title }}</h3>
        
        <div class="report-stats">
          <div class="report-stat-item">
            <span class="label">出勤率</span>
            <span class="value">{{ currentReport.attendance_rate || 0 }}%</span>
          </div>
          <div class="report-stat-item">
            <span class="label">作业完成率</span>
            <span class="value">{{ currentReport.homework_completion_rate || 0 }}%</span>
          </div>
          <div class="report-stat-item">
            <span class="label">平均得分</span>
            <span class="value">{{ currentReport.average_score || 0 }}</span>
          </div>
        </div>

        <div class="report-content">
          <h4>报告内容</h4>
          <div class="content-box" v-html="currentReport.content"></div>
        </div>

        <div v-if="currentReport.teacher_comment" class="teacher-comment">
          <h4>老师评语</h4>
          <div class="comment-box">{{ currentReport.teacher_comment }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet, Plus } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const loading = ref(false)
const generateLoading = ref(false)
const reports = ref([])
const students = ref([])
const generateDialogVisible = ref(false)
const viewDialogVisible = ref(false)
const currentReport = ref(null)
const generateFormRef = ref()

const generateForm = reactive({
  student_id: '',
  report_type: 'weekly',
  period_start: '',
  period_end: ''
})

const generateRules = {
  student_id: [{ required: true, message: '请选择学生', trigger: 'change' }],
  report_type: [{ required: true, message: '请选择报告类型', trigger: 'change' }],
  period_start: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  period_end: [{ required: true, message: '请选择结束日期', trigger: 'change' }]
}

onMounted(async () => {
  await loadReports()
  await loadStudents()
})

async function loadReports() {
  try {
    loading.value = true
    const response = await api.get('/reports')
    if (response.data.success) {
      reports.value = response.data.data
    }
  } catch (error) {
    console.error('获取报告失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadStudents() {
  try {
    const response = await api.get('/students')
    if (response.data.success) {
      students.value = response.data.data
    }
  } catch (error) {
    console.error('获取学生失败:', error)
  }
}

function getReportTypeName(type) {
  const map = { weekly: '周报', monthly: '月报', custom: '自定义' }
  return map[type] || type
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

function openGenerateDialog() {
  Object.assign(generateForm, {
    student_id: '',
    report_type: 'weekly',
    period_start: '',
    period_end: ''
  })
  generateDialogVisible.value = true
}

async function handleGenerate() {
  try {
    await generateFormRef.value.validate()
    generateLoading.value = true
    
    const response = await api.post('/reports/generate', {
      student_id: generateForm.student_id,
      report_type: generateForm.report_type,
      period_start: dayjs(generateForm.period_start).format('YYYY-MM-DD'),
      period_end: dayjs(generateForm.period_end).format('YYYY-MM-DD')
    })
    
    if (response.data.success) {
      ElMessage.success('报告生成成功')
      generateDialogVisible.value = false
      await loadReports()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '生成失败')
  } finally {
    generateLoading.value = false
  }
}

function viewReport(report) {
  currentReport.value = report
  viewDialogVisible.value = true
}

async function handleDelete(report) {
  try {
    await ElMessageBox.confirm('确定要删除这个报告吗？', '删除报告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.delete(`/reports/${report.id}`)
    if (response.data.success) {
      ElMessage.success('报告删除成功')
      await loadReports()
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

.report-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.report-stat-item {
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.report-stat-item .label {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.report-stat-item .value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
}

.report-content, .teacher-comment {
  margin-top: 20px;
}

.content-box, .comment-box {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  white-space: pre-wrap;
}

.comment-box {
  background: #e6f7ff;
}
</style>