<template>
  <div class="teacher-page">
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
      <div class="teacher-profile">
        <div class="teacher-avatar">
          <el-avatar :size="150" src="/teacher-avatar.jpg">
            <el-icon size="80"><User /></el-icon>
          </el-avatar>
        </div>
        
        <div class="teacher-info">
          <h1 style="font-size: 32px; margin-bottom: 16px;">张老师</h1>
          <p style="color: #666; font-size: 18px; margin-bottom: 20px;">
            资深学科培训教师 · 10年教学经验
          </p>
          
          <div class="info-tags">
            <el-tag type="primary" size="large">数学</el-tag>
            <el-tag type="success" size="large">英语</el-tag>
            <el-tag type="warning" size="large">语文</el-tag>
          </div>
        </div>
      </div>

      <div class="info-sections">
        <div class="card">
          <h3 class="card-title">教育背景</h3>
          <p>• 北京师范大学 数学与应用数学专业 本科</p>
          <p>• 教育学硕士</p>
          <p>• 持有教师资格证（高级中学）</p>
        </div>

        <div class="card">
          <h3 class="card-title">教学经历</h3>
          <p>• 10年课外培训教学经验</p>
          <p>• 曾任职于知名培训机构</p>
          <p>• 累计辅导学生超过500人</p>
          <p>• 学生成绩提升率95%以上</p>
        </div>

        <div class="card">
          <h3 class="card-title">教学特色</h3>
          <p>• 因材施教，针对不同学生制定个性化学习方案</p>
          <p>• 注重基础知识的巩固与拓展</p>
          <p>• 培养学生的学习兴趣和自主学习能力</p>
          <p>• 定期与家长沟通，反馈学习进度</p>
        </div>

        <div class="card">
          <h3 class="card-title">教学成果</h3>
          <p>• 多名学生考入重点中学</p>
          <p>• 学生平均成绩提升20-30分</p>
          <p>• 获得"优秀教师"称号</p>
          <p>• 家长满意度98%</p>
        </div>

        <div class="card">
          <h3 class="card-title">家长评价</h3>
          <div class="reviews">
            <div class="review-item">
              <p class="review-content">"张老师教学认真负责，孩子数学成绩进步很大，从70分提高到90分以上。"</p>
              <p class="review-author">— 小明家长</p>
            </div>
            <div class="review-item">
              <p class="review-content">"老师很有耐心，讲解清晰易懂，孩子很喜欢上张老师的课。"</p>
              <p class="review-author">— 小红家长</p>
            </div>
            <div class="review-item">
              <p class="review-content">"一对一辅导效果很好，老师会根据孩子的薄弱点针对性教学。"</p>
              <p class="review-author">— 小华家长</p>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">联系方式</h3>
          <p><el-icon><Phone /></el-icon> 电话: 138-0013-8000</p>
          <p><el-icon><Message /></el-icon> 微信: teacher_zhang</p>
          <p><el-icon><Location /></el-icon> 地址: 北京市朝阳区xxx大厦</p>
          <div style="margin-top: 20px;">
            <router-link to="/courses">
              <el-button type="primary" size="large">立即预约课程</el-button>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAdmin = computed(() => authStore.isAdmin)
</script>

<style scoped>
.teacher-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.teacher-profile {
  background: white;
  padding: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 40px;
  margin-bottom: 30px;
}

.teacher-avatar {
  flex-shrink: 0;
}

.info-tags {
  display: flex;
  gap: 10px;
}

.info-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.reviews {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-item {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}

.review-content {
  margin-bottom: 8px;
}

.review-author {
  color: #666;
  font-size: 14px;
}

@media (max-width: 768px) {
  .teacher-profile {
    flex-direction: column;
    text-align: center;
  }
  
  .info-tags {
    justify-content: center;
  }
  
  .info-sections {
    grid-template-columns: 1fr;
  }
}
</style>