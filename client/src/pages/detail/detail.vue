<template>
  <view v-if="item" class="card">
    <image v-if="item.cover" :src="fileUrl(item.cover)" mode="widthFix" class="cover" />
    <text class="title">{{ item.title }}</text>
    <view class="muted meta">
      <text v-if="type === 'book'">{{ item.author }} · ¥{{ item.price }} · 库存 {{ item.stock }}</text>
      <text v-else>{{ item.category }} · {{ item.created_at }}</text>
    </view>
    <text class="content">{{ item.content || item.intro }}</text>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { http, fileUrl } from '../../utils/request.js'
const item = ref(null), type = ref('notice')
onLoad(async (q) => {
  type.value = q.type === 'book' ? 'book' : 'notice'
  item.value = await http.get(`/${type.value}/${q.id}`)
  uni.setNavigationBarTitle({ title: item.value.title })
})
</script>
<style scoped>
.cover { width: 100%; border-radius: 12rpx; margin-bottom: 20rpx; }
.title { font-size: 40rpx; font-weight: 700; display: block; }
.meta { margin: 16rpx 0 28rpx; }
.content { font-size: 30rpx; line-height: 1.8; white-space: pre-wrap; }
</style>
