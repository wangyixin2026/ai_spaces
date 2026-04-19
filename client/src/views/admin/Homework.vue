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
        <li class="admin-menu-item active" @click="$router.push('/admin/homework')">
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
      <h1 style="font-size: 24px; margin-bottom: 30px;">作业管理</h1>

      <!-- Add Homework Button -->
      <div class="card">
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          发布作业
        </el-button>
      </div>

      <!-- Homework List -->
      <div class="card">
        <el-table :data="homeworkList" stripe v-loading="loading">
          <el-table-column prop="title" label="作业标题" />
          <el-table-column prop="course_name" label="课程" />
          <el-table-column prop="subject" label="科目">
            <template #default="{ row }">
              <el-tag>{{ getSubjectName(row.subject) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="截止日期">
            <template #default="{ row }">
              {{ row.deadline ? formatDateTime(row.deadline) : '无截止日期' }}
            </template>
          </el-table-column>
          <el-table-column prop="submission_count" label="提交数" />
          <el-table-column label="操作" width="250">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewSubmissions(row)">查看提交</el-button>
              <el-button type="warning" size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑作业' : '发布作业'" width="600px">
      <el-form :model="homeworkForm" ref="homeworkFormRef" label-width="100px" :rules="rules">
        <el-form-item label="课程" prop="course_id">
          <el-select v-model="homeworkForm.course_id" placeholder="请选择课程" style="width: 100%;">
            <el-option v-for="course in courses" :key="course.id" :label="course.name" :value="course.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="作业标题" prop="title">
          <el-input v-model="homeworkForm.title" placeholder="请输入作业标题" />
        </el-form-item>
        <el-form-item label="作业内容">
          <el-input v-model="homeworkForm.content" type="textarea" rows="5" placeholder="请输入作业内容" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="homeworkForm.deadline" type="datetime" placeholder="选择截止日期" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="发布对象">
          <el-select v-model="homeworkForm.student_ids" multiple placeholder="请选择学生（不选择则发布给所有学生）" style="width: 100%;" filterable>
            <el-option v-for="student in students" :key="student.id" :label="`${student.name} (${student.username})`" :value="student.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- Submissions Dialog -->
    <el-dialog v-model="submissionsDialogVisible" title="作业提交列表" width="700px">
      <el-table :data="submissions" stripe>
        <el-table-column prop="student_name" label="学生" />
        <el-table-column prop="grade" label="年级" />
        <el-table-column label="提交内容">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewSubmission(row)">查看</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="得分">
          <template #default="{ row }">
            {{ row.score || '未批改' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag v-if="row.is_late" type="danger">补交</el-tag>
            <el-tag v-else :type="row.status === 'graded' ? 'success' : 'warning'">
              {{ row.status === 'graded' ? '已批改' : '待批改' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'graded'" type="primary" size="small" @click="openGradeDialog(row)">
              批改
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Grade Dialog -->
    <el-dialog v-model="gradeDialogVisible" title="批改作业" width="600px">
      <div v-if="currentSubmission">
        <p><strong>学生:</strong> {{ currentSubmission.student_name }}</p>
        <p><strong>年级:</strong> {{ currentSubmission.grade }}</p>
        
        <!-- 学生预约上课时间 -->
        <div v-if="currentSubmission.appointments && currentSubmission.appointments.length > 0" style="margin-bottom: 16px;">
          <p><strong>预约上课时间:</strong></p>
          <el-table :data="currentSubmission.appointments" size="small" border style="margin-top: 8px;">
            <el-table-column prop="course_name" label="课程" width="120" />
            <el-table-column label="上课时间" width="180">
              <template #default="{ row }">
                {{ row.start_time ? formatDateTime(row.start_time) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'confirmed' ? 'success' : (row.status === 'pending' ? 'warning' : 'info')" size="small">
                  {{ row.status === 'confirmed' ? '已确认' : (row.status === 'pending' ? '待确认' : row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="payment_status" label="支付状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.payment_status === 'confirmed' ? 'success' : (row.payment_status === 'pending' ? 'warning' : 'danger')" size="small">
                  {{ row.payment_status === 'confirmed' ? '已支付' : (row.payment_status === 'pending' ? '待确认' : '未支付') }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <p><strong>提交内容:</strong></p>
        <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          {{ currentSubmission.content || '无内容' }}
        </div>
        
        <!-- 提交的图片 -->
        <div v-if="currentSubmission.images && currentSubmission.images.length > 0" style="margin-bottom: 16px;">
          <p><strong>提交图片:</strong></p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-image
              v-for="(img, index) in getImages(currentSubmission.images)"
              :key="index"
              :src="img"
              :preview-src-list="getImages(currentSubmission.images)"
              style="width: 100px; height: 100px; border-radius: 4px;"
              fit="cover"
            />
          </div>
        </div>
      </div>
      <el-form :model="gradeForm" label-width="80px">
        <el-form-item label="得分">
          <el-input-number v-model="gradeForm.score" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="评语">
          <el-input v-model="gradeForm.feedback" type="textarea" rows="3" placeholder="请输入评语" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gradeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGrade" :loading="gradeLoading">提交批改</el-button>
      </template>
    </el-dialog>

    <!-- View Submission Dialog -->
    <el-dialog v-model="viewSubmissionDialogVisible" title="提交详情" width="600px">
      <div v-if="viewSubmissionData">
        <p><strong>学生:</strong> {{ viewSubmissionData.student_name }}</p>
        <p><strong>年级:</strong> {{ viewSubmissionData.grade }}</p>
        
        <!-- 学生预约上课时间 -->
        <div v-if="viewSubmissionData.appointments && viewSubmissionData.appointments.length > 0" style="margin-bottom: 16px;">
          <p><strong>预约上课时间:</strong></p>
          <el-table :data="viewSubmissionData.appointments" size="small" border style="margin-top: 8px;">
            <el-table-column prop="course_name" label="课程" width="120" />
            <el-table-column label="上课时间" width="180">
              <template #default="{ row }">
                {{ row.start_time ? formatDateTime(row.start_time) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'confirmed' ? 'success' : (row.status === 'pending' ? 'warning' : 'info')" size="small">
                  {{ row.status === 'confirmed' ? '已确认' : (row.status === 'pending' ? '待确认' : row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="payment_status" label="支付状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.payment_status === 'confirmed' ? 'success' : (row.payment_status === 'pending' ? 'warning' : 'danger')" size="small">
                  {{ row.payment_status === 'confirmed' ? '已支付' : (row.payment_status === 'pending' ? '待确认' : '未支付') }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <p><strong>提交内容:</strong></p>
        <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          {{ viewSubmissionData.content || '无内容' }}
        </div>
        
        <!-- 提交的图片 -->
        <div v-if="viewSubmissionData.images && viewSubmissionData.images.length > 0" style="margin-bottom: 16px;">
          <p><strong>提交图片:</strong></p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-image
              v-for="(img, index) in getImages(viewSubmissionData.images)"
              :key="index"
              :src="img"
              :preview-src-list="getImages(viewSubmissionData.images)"
              style="width: 100px; height: 100px; border-radius: 4px;"
              fit="cover"
            />
          </div>
        </div>
        
        <p v-if="viewSubmissionData.score"><strong>得分:</strong> {{ viewSubmissionData.score }}</p>
        <p v-if="viewSubmissionData.feedback"><strong>评语:</strong></p>
        <div v-if="viewSubmissionData.feedback" style="background: #e6f7ff; padding: 16px; border-radius: 8px;">
          {{ viewSubmissionData.feedback }}
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
const submitLoading = ref(false)
const gradeLoading = ref(false)
const homeworkList = ref([])
const courses = ref([])
const students = ref([])
const dialogVisible = ref(false)
const submissionsDialogVisible = ref(false)
const gradeDialogVisible = ref(false)
const viewSubmissionDialogVisible = ref(false)
const isEdit = ref(false)
const homeworkFormRef = ref()
const currentHomework = ref(null)
const currentSubmission = ref(null)
const submissions = ref([])
const viewSubmissionData = ref(null)

const homeworkForm = reactive({
  course_id: '',
  title: '',
  content: '',
  deadline: '',
  student_ids: []
})

const gradeForm = reactive({
  score: 0,
  feedback: ''
})

const rules = {
  course_id: [{ required: true, message: '请选择课程', trigger: 'change' }],
  title: [{ required: true, message: '请输入作业标题', trigger: 'blur' }]
}

onMounted(async () => {
  await loadHomework()
  await loadCourses()
  await loadStudents()
})

async function loadHomework() {
  try {
    loading.value = true
    const response = await api.get('/homework')
    if (response.data.success) {
      homeworkList.value = response.data.data
    }
  } catch (error) {
    console.error('获取作业失败:', error)
  } finally {
    loading.value = false
  }
}

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

function getSubjectName(subject) {
  const map = { math: '数学', english: '英语', chinese: '语文' }
  return map[subject] || subject
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

function getImages(images) {
  if (!images) return []
  try {
    const parsed = typeof images === 'string' ? JSON.parse(images) : images
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function openAddDialog() {
  isEdit.value = false
  currentHomework.value = null
  Object.assign(homeworkForm, {
    course_id: '',
    title: '',
    content: '',
    deadline: '',
    student_ids: []
  })
  dialogVisible.value = true
}

function openEditDialog(homework) {
  isEdit.value = true
  currentHomework.value = homework
  Object.assign(homeworkForm, {
    course_id: homework.course_id,
    title: homework.title,
    content: homework.content || '',
    deadline: homework.deadline ? new Date(homework.deadline) : '',
    student_ids: []
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    await homeworkFormRef.value.validate()
    submitLoading.value = true
    
    const data = {
      ...homeworkForm,
      deadline: homeworkForm.deadline ? dayjs(homeworkForm.deadline).format('YYYY-MM-DD HH:mm:ss') : null,
      student_ids: homeworkForm.student_ids
    }
    
    if (isEdit.value) {
      const response = await api.put(`/homework/${currentHomework.value.id}`, data)
      if (response.data.success) {
        ElMessage.success('作业更新成功')
        dialogVisible.value = false
        await loadHomework()
      } else {
        ElMessage.error(response.data.message)
      }
    } else {
      const response = await api.post('/homework', data)
      if (response.data.success) {
        ElMessage.success('作业发布成功')
        dialogVisible.value = false
        await loadHomework()
      } else {
        ElMessage.error(response.data.message)
      }
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function viewSubmissions(homework) {
  try {
    const response = await api.get(`/homework/${homework.id}`)
    if (response.data.success) {
      submissions.value = response.data.data.submissions || []
      submissionsDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取提交失败:', error)
  }
}

function viewSubmission(submission) {
  viewSubmissionData.value = submission
  viewSubmissionDialogVisible.value = true
}

function openGradeDialog(submission) {
  currentSubmission.value = submission
  gradeForm.score = 0
  gradeForm.feedback = ''
  gradeDialogVisible.value = true
}

async function handleGrade() {
  try {
    gradeLoading.value = true
    const response = await api.put(`/homework/${currentSubmission.value.homework_id}/submissions/${currentSubmission.value.id}/grade`, gradeForm)
    if (response.data.success) {
      ElMessage.success('批改成功')
      gradeDialogVisible.value = false
      await viewSubmissions({ id: currentSubmission.value.homework_id })
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '批改失败')
  } finally {
    gradeLoading.value = false
  }
}

async function handleDelete(homework) {
  try {
    await ElMessageBox.confirm('确定要删除这个作业吗？', '删除作业', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.delete(`/homework/${homework.id}`)
    if (response.data.success) {
      ElMessage.success('作业删除成功')
      await loadHomework()
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