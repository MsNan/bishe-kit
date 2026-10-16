<template>
  <div class="page-card">
    <div class="toolbar">
      <el-radio-group v-model="query.type" @change="reload">
        <el-radio-button value="">全部</el-radio-button><el-radio-button value="admin">后台账号</el-radio-button><el-radio-button value="user">注册用户</el-radio-button>
      </el-radio-group>
      <el-input v-model="query.keyword" placeholder="用户名 / 昵称" clearable style="width: 200px" @keyup.enter="reload" @clear="reload" />
      <div style="flex: 1" />
      <el-button v-if="store.can('user:write')" type="primary" icon="Plus" @click="openForm()">新增账号</el-button>
    </div>
    <el-table :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="nickname" label="昵称" />
      <el-table-column label="类型" width="100"><template #default="{ row }"><el-tag :type="row.type === 'admin' ? 'warning' : ''">{{ row.type === 'admin' ? '后台' : '用户' }}</el-tag></template></el-table-column>
      <el-table-column prop="role_name" label="角色" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-switch :model-value="row.status" :active-value="1" :inactive-value="0" :disabled="!store.can('user:write')" @change="(v) => update(row, { status: v })" /></template></el-table-column>
      <el-table-column prop="created_at" label="注册时间" width="170" />
      <el-table-column v-if="store.can('user:write')" label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openForm(row)">编辑</el-button>
          <el-popconfirm title="确定删除？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" :total="total" layout="total, prev, pager, next" style="margin-top: 16px; justify-content: flex-end" @change="load" />
    <el-dialog v-model="visible" :title="form.id ? '编辑账号' : '新增账号'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="!!form.id" /></el-form-item>
        <el-form-item :label="form.id ? '重置密码' : '密码'"><el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空不修改' : '至少 6 位'" /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="form.nickname" /></el-form-item>
        <el-form-item v-if="!form.id" label="类型"><el-radio-group v-model="form.type"><el-radio value="admin">后台账号</el-radio><el-radio value="user">注册用户</el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="form.type === 'admin'" label="角色"><el-select v-model="form.role_id"><el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http.js'
import { useUserStore } from '../stores/user.js'
const store = useUserStore()
const query = reactive({ page: 1, size: 10, type: '', keyword: '' })
const rows = ref([]), total = ref(0), roles = ref([]), visible = ref(false), form = ref({})
async function load() { const d = await http.get('/admin/system/users', { params: query }); rows.value = d.list; total.value = d.total }
const reload = () => { query.page = 1; load() }
onMounted(async () => { load(); if (store.can('role:read')) roles.value = await http.get('/admin/system/roles') })
function openForm(row) { form.value = row ? { ...row, password: '' } : { type: 'admin' }; visible.value = true }
async function save() {
  if (form.value.id) await http.put(`/admin/system/users/${form.value.id}`, form.value)
  else await http.post('/admin/system/users', form.value)
  ElMessage.success('已保存'); visible.value = false; load()
}
async function update(row, patch) { await http.put(`/admin/system/users/${row.id}`, patch); load() }
async function remove(row) { await http.delete(`/admin/system/users/${row.id}`); ElMessage.success('已删除'); load() }
</script>
