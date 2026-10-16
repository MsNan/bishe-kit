<template>
  <view>
    <view class="head">
      <image v-if="store.info?.avatar" :src="fileUrl(store.info.avatar)" class="avatar" mode="aspectFill" @click="changeAvatar" />
      <view v-else class="avatar ph" @click="changeAvatar"><text>{{ store.isLogin ? store.info?.nickname?.[0] : '?' }}</text></view>
      <view v-if="store.isLogin"><text class="name">{{ store.info?.nickname }}</text><text class="sub">@{{ store.info?.username }} · 点头像可更换</text></view>
      <view v-else @click="toLogin"><text class="name">点击登录</text><text class="sub">登录后可上传头像</text></view>
    </view>
    <view class="card menu">
      <view class="cell" @click="about"><text>关于 bishe-kit</text><text class="muted">›</text></view>
      <view v-if="store.isLogin" class="cell" @click="logout"><text style="color: #f56c6c">退出登录</text></view>
    </view>
  </view>
</template>
<script setup>
import { onShow } from '@dcloudio/uni-app'
import { http, upload, fileUrl } from '../../utils/request.js'
import { useUserStore } from '../../stores/user.js'
const store = useUserStore()
onShow(async () => { if (store.isLogin) store.setInfo(await http.get('/auth/me')) })
const toLogin = () => uni.navigateTo({ url: '/pages/login/login' })
async function changeAvatar() {
  if (!store.isLogin) return toLogin()
  const { tempFilePaths } = await uni.chooseImage({ count: 1, sizeType: ['compressed'] })
  uni.showLoading({ title: '上传中' })
  try {
    const { url } = await upload(tempFilePaths[0])
    await http.put('/auth/me', { avatar: url })
    store.setInfo({ ...store.info, avatar: url })
  } finally { uni.hideLoading() }
}
const about = () => uni.showModal({ title: 'bishe-kit', content: 'Vue3 + uni-app + Express + SQLite 全栈脚手架，MIT 开源。', showCancel: false })
function logout() { store.logout(); uni.showToast({ title: '已退出', icon: 'none' }) }
</script>
<style scoped>
.head { background: linear-gradient(135deg, #10b981, #3b82f6); padding: 60rpx 40rpx; display: flex; align-items: center; gap: 28rpx; color: #fff; }
.avatar { width: 128rpx; height: 128rpx; border-radius: 50%; border: 4rpx solid rgba(255, 255, 255, .6); }
.ph { background: rgba(255, 255, 255, .25); display: flex; align-items: center; justify-content: center; font-size: 52rpx; }
.name { font-size: 38rpx; font-weight: 700; display: block; }
.sub { font-size: 24rpx; opacity: .85; }
.menu { padding: 0 28rpx; }
.cell { display: flex; justify-content: space-between; padding: 30rpx 0; border-bottom: 1rpx solid #f2f2f2; }
.cell:last-child { border-bottom: none; }
</style>
