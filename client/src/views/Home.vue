<template>
  <div class="home-page">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <router-link to="/" class="logo">📚 课外培训约课系统</router-link>
        <nav class="nav-links">
          <router-link to="/courses" class="nav-link">课程列表</router-link>
          <router-link to="/teacher" class="nav-link">老师介绍</router-link>
          <template v-if="isLoggedIn">
            <router-link v-if="isAdmin" to="/admin" class="nav-link">管理后台</router-link>
            <router-link to="/dashboard" class="nav-link">学生主页</router-link>
            <el-dropdown @command="handleCommand">
              <span class="nav-link">{{ user?.username }}</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <router-link to="/login" class="nav-link">登录</router-link>
            <router-link to="/register" class="nav-link">注册</router-link>
          </template>
        </nav>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <h1 class="hero-title">专业课外培训 · 轻松在线预约</h1>
      <p class="hero-subtitle">数学、英语、语文等学科课程，一对一辅导，助力学生成长</p>
      <router-link to="/courses" class="btn-primary">立即预约课程</router-link>
    </section>

    <!-- Features Section -->
    <section class="container" style="padding-top: 60px;">
      <h2 style="text-align: center; margin-bottom: 40px; font-size: 28px;">课程特色</h2>
      <div class="grid">
        <div class="card">
          <el-icon size="48" color="#409eff"><Calendar /></el-icon>
          <h3 style="margin: 16px 0;">灵活预约</h3>
          <p style="color: #666;">在线选择课程和时间，随时预约，方便快捷</p>
        </div>
        <div class="card">
          <el-icon size="48" color="#67c23a"><User /></el-icon>
          <h3 style="margin: 16px 0;">专业老师</h3>
          <p style="color: #666;">资深教师授课，教学经验丰富，效果显著</p>
        </div>
        <div class="card">
          <el-icon size="48" color="#e6a23c"><Document /></el-icon>
          <h3 style="margin: 16px 0;">作业管理</h3>
          <p style="color: #666;">在线布置和提交作业，及时批改反馈</p>
        </div>
        <div class="card">
          <el-icon size="48" color="#f56c6c"><TrendCharts /></el-icon>
          <h3 style="margin: 16px 0;">学习报告</h3>
          <p style="color: #666;">定期生成学习报告，追踪学习进度</p>
        </div>
      </div>
    </section>

    <!-- Courses Preview -->
    <section class="container" style="padding: 60px 20px;">
      <h2 style="text-align: center; margin-bottom: 40px; font-size: 28px;">热门课程</h2>
      <div class="grid">
        <div v-for="course in courses" :key="course.id" class="course-card" @click="goToCourse(course.id)">
          <span :class="['course-subject', `subject-${course.subject}`]">{{ course.subject }}</span>
          <h3 class="course-name">{{ course.name }}</h3>
          <p class="course-info">适合年级: {{ course.grade_level || '不限' }}</p>
          <p class="course-info">课程时长: {{ course.duration }}分钟</p>
          <p class="course-info">上课形式: {{ course.max_students === 1 ? '一对一' : '小班课' }}</p>
          <p class="course-price">¥{{ course.price }}/节</p>
        </div>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <router-link to="/courses" class="btn-primary">查看全部课程</router-link>
      </div>
    </section>

    <!-- Footer -->
    <footer style="background: #2c3e50; color: white; padding: 40px 20px; text-align: center;">
      <p>© 2024 课外培训约课系统 · 联系电话: 138-0013-8000</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const router = useRouter()
const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAdmin = computed(() => authStore.isAdmin)
const user = computed(() => authStore.user)

const courses = ref([])

onMounted(async () => {
  try {
    const response = await api.get('/courses')
    if (response.data.success) {
      courses.value = response.data.data.slice(0, 4)
    }
  } catch (error) {
    console.error('获取课程失败:', error)
  }
})

function goToCourse(id) {
  router.push(`/courses/${id}`)
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