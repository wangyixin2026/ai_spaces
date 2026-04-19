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
      <h1 style="font-size: 24px; margin-bottom: 30px;">我的作业</h1>

      <!-- Homework List -->
      <div class="card">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="待完成" name="pending">
            <el-table :data="pendingHomework" stripe v-loading="loading">
              <el-table-column prop="title" label="作业标题" />
              <el-table-column prop="course_name" label="课程" />
              <el-table-column prop="course_subject" label="科目">
                <template #default="{ row }">
                  <el-tag>{{ getSubjectName(row.course_subject) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="布置时间">
                <template #default="{ row }">
                  {{ formatDateTime(row.created_at) }}
                </template>
              </el-table-column>
              <el-table-column label="截止日期">
                <template #default="{ row }">
                  <span :class="{ 'overdue': isOverdue(row.deadline) }">
                    {{ row.deadline ? formatDateTime(row.deadline) : '无截止日期' }}
                  </span>
                  <el-tag v-if="isOverdue(row.deadline)" type="danger" size="small" style="margin-left: 5px;">已过期</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button type="primary" size="small" @click="openSubmitDialog(row)">
                    {{ isOverdue(row.deadline) ? '补交作业' : '提交作业' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="pendingHomework.length === 0" description="暂无待完成作业" />
          </el-tab-pane>
          
          <el-tab-pane label="已提交" name="submitted">
            <el-table :data="submittedHomework" stripe>
              <el-table-column prop="title" label="作业标题" />
              <el-table-column prop="course_name" label="课程" />
              <el-table-column prop="course_subject" label="科目">
                <template #default="{ row }">
                  <el-tag>{{ getSubjectName(row.course_subject) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="布置时间">
                <template #default="{ row }">
                  {{ formatDateTime(row.created_at) }}
                </template>
              </el-table-column>
              <el-table-column label="截止日期">
                <template #default="{ row }">
                  {{ row.deadline ? formatDateTime(row.deadline) : '无截止日期' }}
                </template>
              </el-table-column>
              <el-table-column label="状态">
                <template #default="{ row }">
                  <el-tag v-if="row.my_is_late" type="danger">补交</el-tag>
                  <el-tag v-else :type="row.my_status === 'graded' ? 'success' : 'warning'">
                    {{ row.my_status === 'graded' ? '已批改' : '待批改' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="得分">
                <template #default="{ row }">
                  {{ row.my_score || '未批改' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button type="primary" size="small" @click="viewHomework(row)">
                    查看详情
                  </el-button>
                  <el-button
                    v-if="row.my_status === 'submitted' && !row.my_is_late"
                    type="warning"
                    size="small"
                    @click="editHomework(row)"
                  >
                    修改
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="submittedHomework.length === 0" description="暂无已提交作业" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- Submit Dialog -->
    <el-dialog v-model="submitDialogVisible" :title="isEditMode ? '修改作业' : '提交作业'" width="600px">
      <el-form :model="submitForm" ref="submitFormRef" label-width="80px">
        <el-form-item label="作业标题">
          <el-input :value="currentHomework?.title" disabled />
        </el-form-item>
        <el-form-item label="作业内容">
          <el-input v-model="submitForm.content" type="textarea" rows="5" placeholder="请输入作业内容或答案" />
        </el-form-item>
        <el-form-item label="图片作业">
          <el-upload
            action="/api/upload/image"
            :headers="uploadHeaders"
            list-type="picture-card"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeUpload"
            :file-list="fileList"
            :limit="5"
            accept="image/*"
          >
            <el-icon><Plus /></el-icon>
            <template #tip>
              <div class="el-upload__tip">支持上传图片（JPEG、PNG、GIF、WebP），最多5张，每张最大10MB</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="附件链接">
          <el-input v-model="submitForm.attachments" placeholder="可填写附件链接（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">{{ isEditMode ? '保存' : '提交' }}</el-button>
      </template>
    </el-dialog>

    <!-- View Dialog -->
    <el-dialog v-model="viewDialogVisible" title="作业详情" width="600px">
      <div v-if="viewHomeworkData">
        <p><strong>作业标题:</strong> {{ viewHomeworkData.title }}</p>
        <p><strong>课程:</strong> {{ viewHomeworkData.course_name }}</p>
        <p><strong>得分:</strong> {{ viewHomeworkData.score || '未批改' }}</p>
        <p><strong>提交内容:</strong></p>
        <div style="background: #f5f7fa; padding: 16px; border-radius: 8px;">
          {{ viewHomeworkData.content || '无内容' }}
        </div>
        <p v-if="viewHomeworkData.images && viewHomeworkData.images.length > 0"><strong>提交图片:</strong></p>
        <div v-if="viewHomeworkData.images && viewHomeworkData.images.length > 0" class="image-preview-container">
          <el-image
            v-for="(img, index) in viewHomeworkData.images"
            :key="index"
            :src="img"
            fit="cover"
            style="width: 150px; height: 150px; margin: 5px;"
            :preview-src-list="viewHomeworkData.images"
            :initial-index="index"
          />
        </div>
        <p v-if="viewHomeworkData.feedback"><strong>老师评语:</strong></p>
        <div v-if="viewHomeworkData.feedback" style="background: #e6f7ff; padding: 16px; border-radius: 8px;">
          {{ viewHomeworkData.feedback }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '../../utils/api'
import dayjs from 'dayjs'

const loading = ref(false)
const submitLoading = ref(false)
const activeTab = ref('pending')
const homeworkList = ref([])
const submitDialogVisible = ref(false)
const viewDialogVisible = ref(false)
const currentHomework = ref(null)
const viewHomeworkData = ref(null)
const submitFormRef = ref()
const isEditMode = ref(false)
const isLateSubmit = ref(false)
const fileList = ref([])
const uploadedImages = ref([])

// 上传请求头（添加认证token）
const uploadHeaders = {
  Authorization: `Bearer ${localStorage.getItem('token')}`
}

const submitForm = reactive({
  content: '',
  attachments: '',
  images: []
})

const pendingHomework = computed(() => {
  // 未提交的作业（my_status 为 null 或 undefined）
  return homeworkList.value.filter(h => !h.my_status)
})

const submittedHomework = computed(() => {
  // 已提交的作业（my_status 为 'submitted' 或 'graded'）
  return homeworkList.value.filter(h => h.my_status === 'submitted' || h.my_status === 'graded')
})

onMounted(async () => {
  await loadHomework()
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

function getSubjectName(subject) {
  const map = { math: '数学', english: '英语', chinese: '语文' }
  return map[subject] || subject
}

function formatDateTime(datetime) {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

// 判断作业是否过期
function isOverdue(deadline) {
  if (!deadline) return false
  return dayjs(deadline).isBefore(dayjs())
}

function openSubmitDialog(homework) {
  currentHomework.value = homework
  submitForm.content = ''
  submitForm.attachments = ''
  submitForm.images = []
  uploadedImages.value = []
  fileList.value = []
  isEditMode.value = false
  isLateSubmit.value = isOverdue(homework.deadline) // 标记是否为补交
  submitDialogVisible.value = true
}

async function editHomework(homework) {
  currentHomework.value = homework
  isEditMode.value = true
  
  // 获取已提交的内容
  try {
    const response = await api.get(`/homework/${homework.id}`)
    if (response.data.success) {
      const submission = response.data.data.submissions?.[0]
      submitForm.content = submission?.content || ''
      submitForm.attachments = submission?.attachments || ''
      
      // 解析已上传的图片
      if (submission?.images) {
        try {
          const images = JSON.parse(submission.images)
          uploadedImages.value = images
          submitForm.images = images
          fileList.value = images.map((url, index) => ({
            name: `image-${index}`,
            url: url
          }))
        } catch (e) {
          uploadedImages.value = []
          fileList.value = []
        }
      } else {
        uploadedImages.value = []
        fileList.value = []
      }
      
      submitDialogVisible.value = true
    }
  } catch (error) {
    ElMessage.error('获取作业内容失败')
  }
}

// 图片上传前检查
function beforeUpload(file) {
  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
    return false
  }
  return true
}

// 图片上传成功
function handleUploadSuccess(response, file) {
  if (response.success) {
    uploadedImages.value.push(response.data.url)
    submitForm.images = uploadedImages.value
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

// 图片上传失败
function handleUploadError(error) {
  ElMessage.error('图片上传失败，请重试')
}

async function handleSubmit() {
  try {
    submitLoading.value = true
    const response = await api.post(`/homework/${currentHomework.value.id}/submit`, {
      content: submitForm.content,
      attachments: submitForm.attachments,
      images: JSON.stringify(uploadedImages.value),
      is_late: isLateSubmit.value // 传递补交标志
    })
    
    if (response.data.success) {
      if (isLateSubmit.value) {
        ElMessage.success('作业补交成功，补交作业无法修改')
      } else {
        ElMessage.success(isEditMode.value ? '作业修改成功' : '作业提交成功')
      }
      submitDialogVisible.value = false
      await loadHomework()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '提交失败')
  } finally {
    submitLoading.value = false
  }
}

async function viewHomework(homework) {
  try {
    const response = await api.get(`/homework/${homework.id}`)
    if (response.data.success) {
      const submission = response.data.data.submissions?.[0]
      
      // 解析图片
      let images = []
      if (submission?.images) {
        try {
          images = JSON.parse(submission.images)
        } catch (e) {
          images = []
        }
      }
      
      viewHomeworkData.value = {
        title: homework.title,
        course_name: homework.course_name,
        score: submission?.score,
        content: submission?.content,
        feedback: submission?.feedback,
        images: images
      }
      viewDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取作业详情失败:', error)
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
}

.image-preview-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.overdue {
  color: #f56c6c;
  font-weight: bold;
}
</style>