import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from './stores/user.js'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue') },
    {
      path: '/', component: () => import('./views/Layout.vue'), redirect: '/dashboard',
      children: [
        { path: 'dashboard', component: () => import('./views/Dashboard.vue'), meta: { title: '首页' } },
        { path: 'entity/:name', component: () => import('./views/CrudPage.vue'), meta: { title: '数据管理' } },
        { path: 'system/users', component: () => import('./views/Users.vue'), meta: { title: '用户管理' } },
        { path: 'system/roles', component: () => import('./views/Roles.vue'), meta: { title: '角色权限' } },
      ],
    },
  ],
})
router.beforeEach(async (to) => {
  const store = useUserStore()
  if (to.path === '/login') return true
  if (!store.token) return { path: '/login', query: { redirect: to.fullPath } }
  if (!store.user) { try { await store.loadMeta() } catch { return { path: '/login' } } }
  return true
})
export default router
