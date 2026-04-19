<template>
  <div class="courses-page">
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
      <h1 style="font-size: 28px; margin-bottom: 30px;">课程列表</h1>
      
      <!-- Filters -->
      <div class="filters" style="margin-bottom: 30px;">
        <el-select v-model="filters.subject" placeholder="选择科目" clearable style="width: 150px; margin-right: 10px;">
          <el-option label="数学" value="math" />
          <el-option label="英语" value="english" />
          <el-option label="语文" value="chinese" />
        </el-select>
        <el-select v-model="filters.grade" placeholder="选择年级" clearable style="width: 150px;">
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
      </div>

      <!-- Course List -->
      <div class="grid">
        <div v-for="course in courses" :key="course.id" class="course-card" @click="goToCourse(course.id)">
          <span :class="['course-subject', `subject-${course.subject}`]">{{ getSubjectName(course.subject) }}</span>
          <h3 class="course-name">{{ course.name }}</h3>
          <p class="course-info">适合年级: {{ course.grade_level || '不限' }}</p>
          <p class="course-info">课程时长: {{ course.duration }}分钟</p>
          <p class="course-info">上课形式: {{ course.max_students === 1 ? '一对一' : '小班课(最多' + course.max_students + '人)' }}</p>
          <p class="course-info">可预约时段: {{ course.available_slots || 0 }}个</p>
          <p class="course-price">¥{{ course.price }}/节</p>
          <el-button type="primary" size="small" style="margin-top: 10px;" @click.stop="goToCourse(course.id)">
            查看详情
          </el-button>
        </div>
      </div>

      <el-empty v-if="courses.length === 0" description="暂无课程" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const router = useRouter()
const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAdmin = computed(() => authStore.isAdmin)

const courses = ref([])
const filters = reactive({
  subject: '',
  grade: ''
})

onMounted(async () => {
  await loadCourses()
})

watch(filters, async () => {
  await loadCourses()
})

async function loadCourses() {
  try {
    const params = {}
    if (filters.subject) params.subject = filters.subject
    if (filters.grade) params.grade = filters.grade
    
    const response = await api.get('/courses', { params })
    if (response.data.success) {
      courses.value = response.data.data
    }
  } catch (error) {
    console.error('获取课程失败:', error)
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

function goToCourse(id) {
  router.push(`/courses/${id}`)
}
</script>

<style scoped>
.courses-page {
  min-height: 100vh;
  background: #f5f7fa;
}
</style>