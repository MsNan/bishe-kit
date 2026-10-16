<template>
  <view>
    <view class="search"><input v-model="keyword" class="input" placeholder="搜索书名 / 作者" confirm-type="search" @confirm="load(true)" /></view>
    <view class="grid">
      <view v-for="b in list" :key="b.id" class="book" @click="open(b.id)">
        <image v-if="b.cover" :src="fileUrl(b.cover)" mode="aspectFill" class="cover" />
        <view v-else class="cover placeholder"><text>{{ b.title.slice(0, 2) }}</text></view>
        <text class="title">{{ b.title }}</text>
        <text class="muted">{{ b.author }}</text>
        <view class="row"><text class="price">¥{{ b.price }}</text><text class="muted">库存 {{ b.stock }}</text></view>
      </view>
    </view>
    <view class="muted center">{{ finished ? (list.length ? '没有更多了' : '暂无图书') : '加载中…' }}</view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { http, fileUrl } from '../../utils/request.js'
const keyword = ref(''), list = ref([]), page = ref(1), finished = ref(false)
async function load(reset = false) {
  if (reset) { page.value = 1; finished.value = false; list.value = [] }
  if (finished.value) return
  const d = await http.get('/book', { page: page.value, size: 10, keyword: keyword.value })
  list.value.push(...d.list); finished.value = list.value.length >= d.total; page.value++
}
const open = (id) => uni.navigateTo({ url: `/pages/detail/detail?type=book&id=${id}` })
onLoad(() => load(true))
onPullDownRefresh(async () => { await load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(() => load())
</script>
<style scoped>
.search { background: #10b981; padding: 20rpx 24rpx; }
.input { background: #fff; border-radius: 40rpx; height: 72rpx; padding: 0 30rpx; font-size: 28rpx; }
.grid { display: flex; flex-wrap: wrap; padding: 12rpx; }
.book { width: calc(50% - 24rpx); margin: 12rpx; background: #fff; border-radius: 16rpx; padding: 20rpx; box-sizing: border-box; display: flex; flex-direction: column; gap: 8rpx; }
.cover { width: 100%; height: 300rpx; border-radius: 12rpx; }
.placeholder { background: linear-gradient(135deg, #34d399, #3b82f6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 48rpx; font-weight: 700; }
.title { font-weight: 600; font-size: 28rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { display: flex; justify-content: space-between; align-items: center; }
.price { color: #f56c6c; font-weight: 600; }
.center { text-align: center; padding: 30rpx; }
</style>
