<template>
  <view>
    <view class="tabs">
      <text v-for="c in cats" :key="c" :class="['tab', { on: cat === c }]" @click="switchCat(c)">{{ c || '全部' }}</text>
    </view>
    <view v-for="n in list" :key="n.id" class="card item" @click="open(n.id)">
      <image v-if="n.cover" :src="fileUrl(n.cover)" mode="aspectFill" class="cover" />
      <view class="body">
        <text class="title">{{ n.title }}</text>
        <text class="summary">{{ n.content }}</text>
        <view class="meta"><text class="tag">{{ n.category || '公告' }}</text><text class="muted">{{ n.created_at?.slice(0, 10) }}</text></view>
      </view>
    </view>
    <view class="muted center">{{ finished ? (list.length ? '没有更多了' : '暂无公告') : '加载中…' }}</view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { http, fileUrl } from '../../utils/request.js'
const cats = ['', '通知', '活动', '新闻']
const cat = ref(''), list = ref([]), page = ref(1), finished = ref(false)
async function load(reset = false) {
  if (reset) { page.value = 1; finished.value = false; list.value = [] }
  if (finished.value) return
  const d = await http.get('/notice', { page: page.value, size: 10, ...(cat.value ? { category: cat.value } : {}) })
  list.value.push(...d.list); finished.value = list.value.length >= d.total; page.value++
}
const switchCat = (c) => { cat.value = c; load(true) }
const open = (id) => uni.navigateTo({ url: `/pages/detail/detail?type=notice&id=${id}` })
onLoad(() => load(true))
onPullDownRefresh(async () => { await load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(() => load())
</script>
<style scoped>
.tabs { display: flex; background: #fff; padding: 20rpx 24rpx; gap: 40rpx; }
.tab { color: #606266; padding-bottom: 8rpx; }
.tab.on { color: #10b981; font-weight: 600; border-bottom: 4rpx solid #10b981; }
.item { display: flex; gap: 20rpx; }
.cover { width: 180rpx; height: 140rpx; border-radius: 12rpx; flex-shrink: 0; }
.body { flex: 1; display: flex; flex-direction: column; gap: 10rpx; overflow: hidden; }
.title { font-size: 32rpx; font-weight: 600; }
.summary { color: #606266; font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { display: flex; justify-content: space-between; align-items: center; }
.tag { font-size: 22rpx; color: #10b981; background: #ecfdf5; padding: 4rpx 14rpx; border-radius: 8rpx; }
.center { text-align: center; padding: 30rpx; }
</style>
