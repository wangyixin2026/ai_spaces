<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="logo">📚 管理后台</div>
      <ul class="admin-menu">
        <li class="admin-menu-item" @click="$router.push('/admin')">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </li>
        <li class="admin-menu-item active" @click="$router.push('/admin/courses')">
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
    </aside>

    <main class="admin-content">
      <h1 style="font-size: 24px; margin-bottom: 30px;">课程管理</h1>

      <!-- Add Course Button -->
      <div class="card">
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          添加课程
        </el-button>
      </div>

      <!-- Course List -->
      <div class="card">
        <el-table :data="courses" stripe v-loading="loading">
          <el-table-column prop="name" label="课程名称" />
          <el-table-column prop="subject" label="科目">
            <template #default="{ row }">
              <el-tag>{{ getSubjectName(row.subject) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="grade_level" label="适合年级" />
          <el-table-column prop="duration" label="时长(分钟)" />
          <el-table-column prop="price" label="价格(元)" />
          <el-table-column prop="max_students" label="最大人数" />
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
                {{ row.status === 'active' ? '开放' : '暂停' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑课程' : '添加课程'" width="500px">
      <el-form :model="courseForm" ref="courseFormRef" label-width="100px" :rules="rules">
        <el-form-item label="课程名称" prop="name">
          <el-input v-model="courseForm.name" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="科目" prop="subject">
          <el-select v-model="courseForm.subject" placeholder="请选择科目" style="width: 100%;">
            <el-option label="数学" value="math" />
            <el-option label="英语" value="english" />
            <el-option label="语文" value="chinese" />
          </el-select>
        </el-form-item>
        <el-form-item label="适合年级">
          <el-input v-model="courseForm.grade_level" placeholder="如: 小学三年级" />
        </el-form-item>
        <el-form-item label="课程描述">
          <el-input v-model="courseForm.description" type="textarea" rows="3" placeholder="课程内容介绍" />
        </el-form-item>
        <el-form-item label="时长(分钟)">
          <el-input-number v-model="courseForm.duration" :min="30" :max="180" />
        </el-form-item>
        <el-form-item label="价格(元)">
          <el-input-number v-model="courseForm.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="最大人数">
          <el-input-number v-model="courseForm.max_students" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="courseForm.status">
            <el-radio label="active">开放预约</el-radio>
            <el-radio label="inactive">暂停预约</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Reading, Calendar, User, Clock, Document, TrendCharts, Wallet, Plus } from '@element-plus/icons-vue'
import api from '../../utils/api'

const loading = ref(false)
const submitLoading = ref(false)
const courses = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const courseFormRef = ref()
const currentCourse = ref(null)

const courseForm = reactive({
  name: '',
  subject: '',
  grade_level: '',
  description: '',
  duration: 60,
  price: 100,
  max_students: 1,
  status: 'active'
})

const rules = {
  name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  subject: [{ required: true, message: '请选择科目', trigger: 'change' }]
}

onMounted(async () => {
  await loadCourses()
})

async function loadCourses() {
  try {
    loading.value = true
    const response = await api.get('/courses')
    if (response.data.success) {
      courses.value = response.data.data
    }
  } catch (error) {
    console.error('获取课程失败:', error)
  } finally {
    loading.value = false
  }
}

function getSubjectName(subject) {
  const map = { math: '数学', english: '英语', chinese: '语文' }
  return map[subject] || subject
}

function openAddDialog() {
  isEdit.value = false
  currentCourse.value = null
  Object.assign(courseForm, {
    name: '',
    subject: '',
    grade_level: '',
    description: '',
    duration: 60,
    price: 100,
    max_students: 1,
    status: 'active'
  })
  dialogVisible.value = true
}

function openEditDialog(course) {
  isEdit.value = true
  currentCourse.value = course
  Object.assign(courseForm, {
    name: course.name,
    subject: course.subject,
    grade_level: course.grade_level || '',
    description: course.description || '',
    duration: course.duration,
    price: course.price,
    max_students: course.max_students,
    status: course.status
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    await courseFormRef.value.validate()
    submitLoading.value = true
    
    if (isEdit.value) {
      const response = await api.put(`/courses/${currentCourse.value.id}`, courseForm)
      if (response.data.success) {
        ElMessage.success('课程更新成功')
        dialogVisible.value = false
        await loadCourses()
      } else {
        ElMessage.error(response.data.message)
      }
    } else {
      const response = await api.post('/courses', courseForm)
      if (response.data.success) {
        ElMessage.success('课程添加成功')
        dialogVisible.value = false
        await loadCourses()
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

async function handleDelete(course) {
  try {
    await ElMessageBox.confirm('确定要删除这个课程吗？', '删除课程', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await api.delete(`/courses/${course.id}`)
    if (response.data.success) {
      ElMessage.success('课程删除成功')
      await loadCourses()
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