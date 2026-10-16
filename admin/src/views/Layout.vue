<template>
  <el-container style="height: 100%">
    <el-aside :width="collapsed ? '64px' : '210px'" class="aside">
      <div class="logo">{{ collapsed ? 'BK' : '🎓 bishe-kit' }}</div>
      <el-menu :default-active="$route.path" router :collapse="collapsed" background-color="#001529" text-color="#bfcbd9" active-text-color="#fff">
        <el-menu-item index="/dashboard"><el-icon><HomeFilled /></el-icon><span>首页</span></el-menu-item>
        <el-menu-item v-for="e in store.menus" :key="e.name" :index="`/entity/${e.name}`">
          <el-icon><component :is="e.icon || 'Document'" /></el-icon><span>{{ e.label }}管理</span>
        </el-menu-item>
        <el-sub-menu v-if="store.can('user:read') || store.can('role:read')" index="system">
          <template #title><el-icon><Setting /></el-icon><span>系统管理</span></template>
          <el-menu-item v-if="store.can('user:read')" index="/system/users">用户管理</el-menu-item>
          <el-menu-item v-if="store.can('role:read')" index="/system/roles">角色权限</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <el-icon class="fold" @click="collapsed = !collapsed"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
        <span class="title">{{ title }}</span>
        <el-dropdown @command="onCmd">
          <span class="user"><el-avatar :size="28" :src="store.user?.avatar">{{ store.user?.nickname?.[0] }}</el-avatar>{{ store.user?.nickname }}</span>
          <template #dropdown><el-dropdown-menu><el-dropdown-item command="logout">退出登录</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </el-header>
      <el-main><router-view :key="$route.fullPath" /></el-main>
    </el-container>
  </el-container>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
const store = useUserStore(), route = useRoute(), router = useRouter()
const collapsed = ref(window.innerWidth < 768)
const title = computed(() => route.params.name ? `${store.entities.find((e) => e.name === route.params.name)?.label ?? ''}管理` : route.meta.title)
function onCmd(c) { if (c === 'logout') { store.logout(); router.replace('/login') } }
</script>
<style scoped>
.aside { background: #001529; transition: width .2s; overflow-x: hidden; }
.aside .el-menu { border-right: none; }
.logo { height: 56px; line-height: 56px; color: #fff; font-weight: 600; text-align: center; font-size: 18px; }
.header { background: #fff; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee; }
.fold { cursor: pointer; font-size: 20px; }
.title { flex: 1; font-weight: 500; }
.user { display: flex; align-items: center; gap: 8px; cursor: pointer; }
</style>
