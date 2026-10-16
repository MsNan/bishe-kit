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
  (res) => res.data.data,
  (err) => {
    const status = err.response?.status
    const msg = err.response?.data?.msg || '网络错误'
    if (status === 401) {
      localStorage.removeItem('admin_token')
      router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    }
    ElMessage.error(msg)
    return Promise.reject(err)
  },
)
export default http
