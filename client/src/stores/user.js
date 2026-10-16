import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '')
  const info = ref(uni.getStorageSync('userInfo') || null)
  const isLogin = computed(() => !!token.value)
  function setLogin(d) { token.value = d.token; info.value = d.user; uni.setStorageSync('token', d.token); uni.setStorageSync('userInfo', d.user) }
  function setInfo(u) { info.value = u; uni.setStorageSync('userInfo', u) }
  function logout() { token.value = ''; info.value = null; uni.removeStorageSync('token'); uni.removeStorageSync('userInfo') }
  return { token, info, isLogin, setLogin, setInfo, logout }
})
