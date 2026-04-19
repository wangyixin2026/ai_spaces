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
      <h1 style="font-size: 24px; margin-bottom: 30px;">个人中心</h1>

      <div class="card">
        <h3 class="card-title">基本信息</h3>
        <el-form :model="profileForm" ref="profileFormRef" label-width="100px" @submit.prevent="handleUpdateProfile">
          <el-form-item label="用户名">
            <el-input :value="user?.username" disabled />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input v-model="profileForm.phone" placeholder="请输入手机号" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleUpdateProfile" :loading="loading">保存修改</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="card">
        <h3 class="card-title">学生信息</h3>
        <el-form :model="studentForm" ref="studentFormRef" label-width="100px" @submit.prevent="handleUpdateStudent">
          <el-form-item label="姓名">
            <el-input v-model="studentForm.name" placeholder="请输入学生姓名" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="studentForm.gender">
              <el-radio label="男">男</el-radio>
              <el-radio label="女">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年级">
            <el-select v-model="studentForm.grade" placeholder="请选择年级" style="width: 100%;">
              <el-option label="小学一年级" value="小学一年级" />
              <el-option label="小学二年级" value="小学二年级" />
              <el-option label="小学三年级" value="小学三年级" />
              <el-option label="小学四年级" value="小学四年级" />
              <el-option label="小学五年级" value="小学五年级" />
              <el-option label="小学六年级" value="小学六年级" />
              <el-option label="初中一年级" value="初中一年级" />
              <el-option label="初中二年级" value="初中二年级" />
              <el-option label="初中三年级" value="初中三年级" />
            </el-select>
          </el-form-item>
          <el-form-item label="学校">
            <el-input v-model="studentForm.school" placeholder="请输入学校名称" />
          </el-form-item>
          <el-form-item label="家长姓名">
            <el-input v-model="studentForm.parent_name" placeholder="请输入家长姓名" />
          </el-form-item>
          <el-form-item label="家长电话">
            <el-input v-model="studentForm.parent_phone" placeholder="请输入家长联系电话" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="studentForm.notes" type="textarea" placeholder="如有特殊情况请填写" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleUpdateStudent" :loading="studentLoading">保存修改</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="card">
        <h3 class="card-title">修改密码</h3>
        <el-form :model="passwordForm" ref="passwordFormRef" label-width="100px" :rules="passwordRules" @submit.prevent="handleUpdatePassword">
          <el-form-item label="原密码" prop="oldPassword">
            <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="请输入新密码" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleUpdatePassword" :loading="passwordLoading">修改密码</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import api from '../../utils/api'

const authStore = useAuthStore()
const user = computed(() => authStore.user)

const loading = ref(false)
const studentLoading = ref(false)
const passwordLoading = ref(false)
const profileFormRef = ref()
const studentFormRef = ref()
const passwordFormRef = ref()

const profileForm = reactive({
  phone: '',
  email: ''
})

const studentForm = reactive({
  name: '',
  gender: '',
  grade: '',
  school: '',
  parent_name: '',
  parent_phone: '',
  notes: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: ''
})

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' }
  ]
}

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  try {
    const response = await api.get('/auth/me')
    if (response.data.success) {
      profileForm.phone = response.data.data.user.phone || ''
      profileForm.email = response.data.data.user.email || ''
      
      if (response.data.data.student) {
        studentForm.name = response.data.data.student.name || ''
        studentForm.gender = response.data.data.student.gender || ''
        studentForm.grade = response.data.data.student.grade || ''
        studentForm.school = response.data.data.student.school || ''
        studentForm.parent_name = response.data.data.student.parent_name || ''
        studentForm.parent_phone = response.data.data.student.parent_phone || ''
        studentForm.notes = response.data.data.student.notes || ''
      }
    }
  } catch (error) {
    console.error('获取个人信息失败:', error)
  }
}

async function handleUpdateProfile() {
  try {
    loading.value = true
    const response = await api.put('/users/profile', profileForm)
    if (response.data.success) {
      ElMessage.success('信息更新成功')
      await authStore.fetchCurrentUser()
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '更新失败')
  } finally {
    loading.value = false
  }
}

async function handleUpdateStudent() {
  try {
    studentLoading.value = true
    const response = await api.put('/students/profile', studentForm)
    if (response.data.success) {
      ElMessage.success('学生信息更新成功')
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '更新失败')
  } finally {
    studentLoading.value = false
  }
}

async function handleUpdatePassword() {
  try {
    await passwordFormRef.value.validate()
    passwordLoading.value = true
    const response = await api.put('/auth/password', passwordForm)
    if (response.data.success) {
      ElMessage.success('密码修改成功')
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '修改失败')
  } finally {
    passwordLoading.value = false
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
</style>