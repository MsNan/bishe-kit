<template>
  <div class="login">
    <el-card class="box" shadow="always">
      <h2>bishe-kit 管理后台</h2>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="submit">
        <el-form-item prop="username"><el-input v-model="form.username" placeholder="账号" prefix-icon="User" /></el-form-item>
        <el-form-item prop="password"><el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password /></el-form-item>
        <el-button type="primary" style="width: 100%" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
      <p class="tip">演示账号：admin / admin123（超管）、editor / editor123（编辑）、viewer / viewer123（只读）</p>
    </el-card>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
const store = useUserStore(), router = useRouter(), route = useRoute()
const formRef = ref(), loading = ref(false)
const form = reactive({ username: 'admin', password: 'admin123' })
const rules = { username: [{ required: true, message: '请输入账号' }], password: [{ required: true, message: '请输入密码' }] }
async function submit() {
  await formRef.value.validate()
  loading.value = true
  try { await store.login(form); router.replace(route.query.redirect || '/') } finally { loading.value = false }
}
</script>
<style scoped>
.login { height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #10b981, #3b82f6); }
.box { width: 380px; max-width: 92vw; }
h2 { text-align: center; margin: 4px 0 24px; }
.tip { color: #909399; font-size: 12px; line-height: 1.6; margin-bottom: 0; }
</style>
