import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Public pages
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Courses from '../views/Courses.vue'
import CourseDetail from '../views/CourseDetail.vue'
import Teacher from '../views/Teacher.vue'

// Student pages
import StudentDashboard from '../views/student/Dashboard.vue'
import StudentBooking from '../views/student/Booking.vue'
import StudentAppointments from '../views/student/Appointments.vue'
import StudentHomework from '../views/student/Homework.vue'
import StudentReports from '../views/student/Reports.vue'
import StudentProfile from '../views/student/Profile.vue'

// Admin pages
import AdminDashboard from '../views/admin/Dashboard.vue'
import AdminCourses from '../views/admin/Courses.vue'
import AdminStudents from '../views/admin/Students.vue'
import AdminAppointments from '../views/admin/Appointments.vue'
import AdminHomework from '../views/admin/Homework.vue'
import AdminReports from '../views/admin/Reports.vue'
import AdminSchedule from '../views/admin/Schedule.vue'
import AdminPaymentSettings from '../views/admin/PaymentSettings.vue'

const routes = [
  // Public routes
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/courses', name: 'Courses', component: Courses },
  { path: '/courses/:id', name: 'CourseDetail', component: CourseDetail },
  { path: '/teacher', name: 'Teacher', component: Teacher },

  // Student routes
  {
    path: '/dashboard',
    name: 'StudentDashboard',
    component: StudentDashboard,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/booking',
    name: 'StudentBooking',
    component: StudentBooking,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/appointments',
    name: 'StudentAppointments',
    component: StudentAppointments,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/homework',
    name: 'StudentHomework',
    component: StudentHomework,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/reports',
    name: 'StudentReports',
    component: StudentReports,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/profile',
    name: 'StudentProfile',
    component: StudentProfile,
    meta: { requiresAuth: true }
  },

  // Admin routes
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/courses',
    name: 'AdminCourses',
    component: AdminCourses,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/students',
    name: 'AdminStudents',
    component: AdminStudents,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/appointments',
    name: 'AdminAppointments',
    component: AdminAppointments,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/homework',
    name: 'AdminHomework',
    component: AdminHomework,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/reports',
    name: 'AdminReports',
    component: AdminReports,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/schedule',
    name: 'AdminSchedule',
    component: AdminSchedule,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/admin/payment',
    name: 'AdminPaymentSettings',
    component: AdminPaymentSettings,
    meta: { requiresAuth: true, role: 'admin' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth) {
    if (!authStore.isLoggedIn) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
    } else if (to.meta.role === 'admin' && authStore.user?.role !== 'admin') {
      // Only admin can access admin pages
      next({ name: 'StudentDashboard' })
    } else {
      // Admin can also access student pages for testing/demonstration
      next()
    }
  } else {
    next()
  }
})

export default router