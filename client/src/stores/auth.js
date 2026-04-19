import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(username, password) {
    try {
      const response = await api.post('/auth/login', { username, password })
      if (response.data.success) {
        token.value = response.data.data.token
        user.value = response.data.data.user
        localStorage.setItem('token', response.data.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.data.user))
        return { success: true }
      }
      return { success: false, message: response.data.message }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || '登录失败' }
    }
  }

  async function register(username, password, phone, email) {
    try {
      const response = await api.post('/auth/register', { username, password, phone, email })
      if (response.data.success) {
        token.value = response.data.data.token
        user.value = response.data.data.user
        localStorage.setItem('token', response.data.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.data.user))
        return { success: true }
      }
      return { success: false, message: response.data.message }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || '注册失败' }
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await api.get('/auth/me')
      if (response.data.success) {
        user.value = response.data.data.user
        localStorage.setItem('user', JSON.stringify(response.data.data.user))
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      logout()
      return { success: false }
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    login,
    register,
    fetchCurrentUser,
    logout
  }
})