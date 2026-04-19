<template>
  <div class="payment-settings">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>支付收款码设置</span>
          <el-text type="info" size="small">上传微信和支付宝收款码，学生预约后可扫码支付</el-text>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="12" v-for="setting in settings" :key="setting.id">
          <el-card class="payment-card" shadow="hover">
            <template #header>
              <div class="payment-header">
                <span class="payment-title">
                  <el-icon v-if="setting.payment_type === 'wechat'" style="color: #07C160;"><ChatDotRound /></el-icon>
                  <el-icon v-else style="color: #1677FF;"><Wallet /></el-icon>
                  {{ setting.payment_type === 'wechat' ? '微信支付' : '支付宝' }}
                </span>
                <el-switch v-model="setting.is_active" :active-value="1" :inactive-value="0" @change="toggleActive(setting)" />
              </div>
            </template>

            <div class="qr-code-container">
              <div v-if="setting.qr_code" class="qr-code-preview">
                <el-image 
                  :src="setting.qr_code" 
                  fit="contain"
                  style="width: 200px; height: 200px;"
                  :preview-src-list="[setting.qr_code]"
                />
              </div>
              <div v-else class="qr-code-placeholder">
                <el-icon size="60" color="#ccc"><Picture /></el-icon>
                <p>暂无收款码</p>
              </div>
            </div>

            <div class="upload-section">
              <el-upload
                :show-file-list="false"
                :before-upload="(file) => beforeUpload(file, setting)"
                accept="image/*"
              >
                <el-button type="primary">
                  <el-icon><Upload /></el-icon>
                  {{ setting.qr_code ? '更换收款码' : '上传收款码' }}
                </el-button>
              </el-upload>
              <el-button v-if="setting.qr_code" type="danger" plain @click="clearQrCode(setting)">
                清除收款码
              </el-button>
            </div>

            <el-form label-width="80px" style="margin-top: 16px;">
              <el-form-item label="收款账户">
                <el-input 
                  v-model="setting.account_name" 
                  placeholder="请输入收款账户名称"
                  @blur="updateSetting(setting)"
                />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Wallet, Picture, Upload } from '@element-plus/icons-vue'
import api from '../../utils/api'

const settings = ref([])

// 获取支付设置
const fetchSettings = async () => {
  try {
    const res = await api.get('/payment/settings/all')
    if (res.data.success) {
      settings.value = res.data.data
    }
  } catch (error) {
    console.error('获取支付设置失败:', error)
    ElMessage.error('获取支付设置失败')
  }
}

// 上传前处理
const beforeUpload = async (file, setting) => {
  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('只能上传图片文件')
    return false
  }

  // 检查文件大小 (最大 2MB)
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 2MB')
    return false
  }

  // 转换为 base64
  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = e.target.result
    try {
      const res = await api.post(`/payment/settings/${setting.id}/qrcode`, {
        qr_code: base64
      })
      if (res.data.success) {
        ElMessage.success('收款码上传成功')
        fetchSettings()
      }
    } catch (error) {
      console.error('上传收款码失败:', error)
      ElMessage.error('上传收款码失败')
    }
  }
  reader.readAsDataURL(file)
  return false
}

// 清除收款码
const clearQrCode = async (setting) => {
  try {
    const res = await api.put(`/payment/settings/${setting.id}`, {
      qr_code: null,
      account_name: setting.account_name,
      is_active: setting.is_active
    })
    if (res.data.success) {
      ElMessage.success('收款码已清除')
      fetchSettings()
    }
  } catch (error) {
    console.error('清除收款码失败:', error)
    ElMessage.error('清除收款码失败')
  }
}

// 更新设置
const updateSetting = async (setting) => {
  try {
    const res = await api.put(`/payment/settings/${setting.id}`, {
      qr_code: setting.qr_code,
      account_name: setting.account_name,
      is_active: setting.is_active
    })
    if (res.data.success) {
      ElMessage.success('设置已保存')
    }
  } catch (error) {
    console.error('更新设置失败:', error)
    ElMessage.error('更新设置失败')
  }
}

// 切换启用状态
const toggleActive = async (setting) => {
  await updateSetting(setting)
}

onMounted(() => {
  fetchSettings()
})
</script>

<style scoped>
.payment-settings {
  padding: 20px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-card {
  margin-bottom: 20px;
}

.payment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: bold;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  margin: 16px 0;
}

.qr-code-preview {
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-code-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.upload-section {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>