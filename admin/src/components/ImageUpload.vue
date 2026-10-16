<template>
  <el-upload class="img-up" action="/api/upload" :headers="headers" :show-file-list="false" accept="image/*" :before-upload="check" :on-success="done" :on-error="fail">
    <img v-if="model" :src="model" class="img" />
    <el-icon v-else class="plus"><Plus /></el-icon>
  </el-upload>
</template>
<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
const model = defineModel({ type: String, default: '' })
const headers = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` }))
const check = (f) => (f.size / 1024 / 1024 < 5) || (ElMessage.error('图片不能超过 5MB'), false)
const done = (res) => { model.value = res.data.url }
const fail = () => ElMessage.error('上传失败')
</script>
<style scoped>
.img-up :deep(.el-upload) { width: 100px; height: 100px; border: 1px dashed #dcdfe6; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
.img { width: 100%; height: 100%; object-fit: cover; }
.plus { font-size: 24px; color: #8c939d; }
</style>
