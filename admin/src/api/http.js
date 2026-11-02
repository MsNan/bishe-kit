import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router.js'

const http = axios.create({ baseURL: '/api', timeout: 15000 })
http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('admin_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
http.interceptors.response.use(
  // raw: true 时返回完整响应（下载文件用）
  (res) => (res.config.raw ? res : res.data.data),
  async (err) => {
    const status = err.response?.status
    let data = err.response?.data
    // 下载文件（responseType: 'blob'）出错时，后端的 JSON 错误信息也被包成了 Blob
    if (data instanceof Blob) { try { data = JSON.parse(await data.text()) } catch { data = null } }
    const msg = data?.msg || '网络错误'
    if (status === 401) {
      localStorage.removeItem('admin_token')
      router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    }
    ElMessage.error(msg)
    return Promise.reject(err)
  },
)
export default http
