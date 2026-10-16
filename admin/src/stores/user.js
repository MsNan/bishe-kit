import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '../api/http.js'

export const useUserStore = defineStore('admin-user', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const user = ref(null)
  const entities = ref([])
  const perms = ref([])
  const can = (p) => perms.value.includes('*') || perms.value.includes(p)
  const menus = computed(() => entities.value.filter((e) => can(`${e.name}:read`)))

  async function login(form) {
    const d = await http.post('/auth/admin/login', form)
    token.value = d.token; localStorage.setItem('admin_token', d.token)
    await loadMeta()
  }
  async function loadMeta() {
    const [me, meta] = await Promise.all([http.get('/auth/me'), http.get('/admin/meta')])
    user.value = me; entities.value = meta.entities; perms.value = meta.perms
  }
  function logout() { token.value = ''; user.value = null; localStorage.removeItem('admin_token') }
  return { token, user, entities, perms, menus, can, login, loadMeta, logout }
})
