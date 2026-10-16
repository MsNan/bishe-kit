<template>
  <div class="page-card">
    <div class="toolbar"><div style="flex: 1" /><el-button v-if="store.can('role:write')" type="primary" icon="Plus" @click="openForm()">新增角色</el-button></div>
    <el-table :data="roles" border>
      <el-table-column prop="code" label="编码" width="150" />
      <el-table-column prop="name" label="名称" width="150" />
      <el-table-column label="权限">
        <template #default="{ row }"><el-tag v-for="p in row.perms" :key="p" size="small" style="margin: 2px">{{ permName(p) }}</el-tag></template>
      </el-table-column>
      <el-table-column v-if="store.can('role:write')" label="操作" width="150">
        <template #default="{ row }">
          <template v-if="row.code !== 'super_admin'">
            <el-button link type="primary" @click="openForm(row)">编辑</el-button>
            <el-popconfirm v-if="!row.builtin" title="确定删除？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm>
          </template>
          <span v-else style="color: #909399">内置</span>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="visible" :title="form.id ? '编辑角色' : '新增角色'" width="560px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="编码"><el-input v-model="form.code" :disabled="!!form.id" placeholder="小写字母，如 teacher" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="权限"><el-checkbox-group v-model="form.perms"><el-checkbox v-for="p in perms.filter((x) => x.code !== '*')" :key="p.code" :value="p.code">{{ p.name }}</el-checkbox></el-checkbox-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http.js'
import { useUserStore } from '../stores/user.js'
const store = useUserStore()
const roles = ref([]), perms = ref([]), visible = ref(false), form = ref({ perms: [] })
const permName = (c) => perms.value.find((p) => p.code === c)?.name ?? c
async function load() { [roles.value, perms.value] = await Promise.all([http.get('/admin/system/roles'), http.get('/admin/system/permissions')]) }
onMounted(load)
function openForm(row) { form.value = row ? { ...row, perms: [...row.perms] } : { perms: [] }; visible.value = true }
async function save() {
  if (form.value.id) await http.put(`/admin/system/roles/${form.value.id}`, form.value)
  else await http.post('/admin/system/roles', form.value)
  ElMessage.success('已保存'); visible.value = false; load()
}
async function remove(row) { await http.delete(`/admin/system/roles/${row.id}`); ElMessage.success('已删除'); load() }
</script>
