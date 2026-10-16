<template>
  <view class="wrap">
    <view class="logo">🎓</view>
    <view class="card">
      <view class="switch"><text :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</text><text :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</text></view>
      <input v-model="form.username" class="input" placeholder="用户名（4–20 位字母数字）" />
      <input v-model="form.password" class="input" password placeholder="密码（至少 6 位）" />
      <input v-if="mode === 'register'" v-model="form.nickname" class="input" placeholder="昵称（选填）" />
      <label class="agree" @click="agree = !agree"><checkbox :checked="agree" color="#10b981" style="transform: scale(0.7)" /><text class="muted">我已阅读并同意《用户协议》和《隐私政策》</text></label>
      <button class="btn-primary" :loading="loading" @click="submit">{{ mode === 'login' ? '登录' : '注册并登录' }}</button>
      <view class="muted tip">演示账号：test / test123</view>
    </view>
  </view>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { http } from '../../utils/request.js'
import { useUserStore } from '../../stores/user.js'
const store = useUserStore()
const mode = ref('login'), loading = ref(false), agree = ref(false), redirect = ref('')
const form = reactive({ username: '', password: '', nickname: '' })
onLoad((q) => { redirect.value = q.redirect ? decodeURIComponent(q.redirect) : '' })
async function submit() {
  if (!agree.value) return uni.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' })
  if (!form.username || !form.password) return uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
  loading.value = true
  try {
    const d = await http.post(mode.value === 'login' ? '/auth/login' : '/auth/register', form)
    store.setLogin(d)
    uni.showToast({ title: '登录成功' })
    setTimeout(() => (redirect.value ? uni.redirectTo({ url: redirect.value }) : uni.switchTab({ url: '/pages/mine/mine' })), 400)
  } finally { loading.value = false }
}
</script>
<style scoped>
.wrap { padding-top: 60rpx; }
.logo { text-align: center; font-size: 120rpx; }
.switch { display: flex; gap: 48rpx; margin-bottom: 32rpx; font-size: 34rpx; color: #909399; }
.switch .on { color: #303133; font-weight: 700; }
.input { height: 88rpx; border-bottom: 1rpx solid #ebeef5; margin-bottom: 20rpx; font-size: 30rpx; }
.agree { display: flex; align-items: center; margin: 20rpx 0 32rpx; }
.tip { text-align: center; margin-top: 24rpx; }
</style>
