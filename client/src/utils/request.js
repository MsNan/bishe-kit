import { useUserStore } from '../stores/user.js'

export const BASE = import.meta.env.VITE_API_BASE || ''
export const fileUrl = (u) => (!u ? '' : /^https?:/.test(u) ? u : BASE + u)

let toLogin = false
function gotoLogin() {
  if (toLogin) return
  toLogin = true
  useUserStore().logout()
  uni.navigateTo({ url: '/pages/login/login', complete: () => setTimeout(() => (toLogin = false), 500) })
}

/** 统一请求：自动带 token、统一错误提示、401 跳登录（并发只跳一次） */
export function request(url, { method = 'GET', data, loading = false } = {}) {
  const user = useUserStore()
  if (loading) uni.showLoading({ title: '加载中', mask: true })
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE + '/api' + url, method, data, timeout: 15000,
      header: user.token ? { Authorization: `Bearer ${user.token}` } : {},
      success: (res) => {
        if (res.statusCode === 401) { gotoLogin(); return reject(res.data) }
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data.code === 0) return resolve(res.data.data)
        uni.showToast({ title: res.data?.msg || `请求失败(${res.statusCode})`, icon: 'none' })
        reject(res.data)
      },
      fail: (err) => { uni.showToast({ title: '网络异常', icon: 'none' }); reject(err) },
      complete: () => loading && uni.hideLoading(),
    })
  })
}
export const http = {
  get: (url, data) => request(url, { data }),
  post: (url, data, o) => request(url, { method: 'POST', data, ...o }),
  put: (url, data, o) => request(url, { method: 'PUT', data, ...o }),
}

export function upload(filePath) {
  const user = useUserStore()
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: BASE + '/api/upload', filePath, name: 'file', header: { Authorization: `Bearer ${user.token}` },
      success: (res) => { const d = JSON.parse(res.data); d.code === 0 ? resolve(d.data) : (uni.showToast({ title: d.msg, icon: 'none' }), reject(d)) },
      fail: reject,
    })
  })
}
