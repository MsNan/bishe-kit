<template>
  <div v-if="entity" class="page-card">
    <div class="toolbar">
      <el-input v-if="hasSearch" v-model="query.keyword" :placeholder="`搜索${searchLabels}`" clearable style="width: 240px" @keyup.enter="reload" @clear="reload" />
      <el-button v-if="hasSearch" type="primary" icon="Search" @click="reload">搜索</el-button>
      <div style="flex: 1" />
      <el-button v-if="canWrite" type="primary" icon="Plus" @click="openForm()">新增{{ entity.label }}</el-button>
    </div>
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column v-for="f in listFields" :key="f.name" :label="f.label" :min-width="f.type === 'string' ? 160 : 100" show-overflow-tooltip>
        <template #default="{ row }">
          <img v-if="f.type === 'image' && row[f.name]" :src="row[f.name]" class="thumb" />
          <el-tag v-else-if="f.type === 'bool'" :type="row[f.name] ? 'success' : 'info'" size="small">{{ row[f.name] ? '是' : '否' }}</el-tag>
          <span v-else>{{ row[f.name] ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170" />
      <el-table-column v-if="canWrite" label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openForm(row)">编辑</el-button>
          <el-popconfirm title="确定删除吗？" @confirm="remove(row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" style="margin-top: 16px; justify-content: flex-end" @change="load" />

    <el-dialog v-model="visible" :title="(form.id ? '编辑' : '新增') + entity.label" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item v-for="f in entity.fields" :key="f.name" :label="f.label" :prop="f.name">
          <ImageUpload v-if="f.type === 'image'" v-model="form[f.name]" />
          <el-input v-else-if="f.type === 'text'" v-model="form[f.name]" type="textarea" :rows="4" />
          <el-input-number v-else-if="f.type === 'number' || f.type === 'int'" v-model="form[f.name]" :precision="f.type === 'int' ? 0 : 2" :min="0" />
          <el-switch v-else-if="f.type === 'bool'" v-model="form[f.name]" :active-value="1" :inactive-value="0" />
          <el-date-picker v-else-if="f.type === 'date'" v-model="form[f.name]" type="date" value-format="YYYY-MM-DD" />
          <el-select v-else-if="f.type === 'select'" v-model="form[f.name]" clearable><el-option v-for="o in f.options" :key="o" :label="o" :value="o" /></el-select>
          <el-input v-else v-model="form[f.name]" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
  <el-empty v-else description="没有这个模块或无权访问" />
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http.js'
import { useUserStore } from '../stores/user.js'
import ImageUpload from '../components/ImageUpload.vue'

const route = useRoute(), store = useUserStore()
const entity = computed(() => store.entities.find((e) => e.name === route.params.name))
const canWrite = computed(() => entity.value && store.can(`${entity.value.name}:write`))
const listFields = computed(() => entity.value?.fields.filter((f) => f.type !== 'text') ?? [])
const hasSearch = computed(() => entity.value?.fields.some((f) => f.search))
const searchLabels = computed(() => entity.value?.fields.filter((f) => f.search).map((f) => f.label).join('/'))
const rules = computed(() => Object.fromEntries((entity.value?.fields ?? []).filter((f) => f.required).map((f) => [f.name, [{ required: true, message: `请填写${f.label}` }]])))

const query = reactive({ page: 1, size: 10, keyword: '' })
const rows = ref([]), total = ref(0), loading = ref(false)
async function load() {
  if (!entity.value) return
  loading.value = true
  try { const d = await http.get(`/admin/${entity.value.name}`, { params: query }); rows.value = d.list; total.value = d.total } finally { loading.value = false }
}
const reload = () => { query.page = 1; load() }
watch(() => route.params.name, reload, { immediate: true })

const visible = ref(false), saving = ref(false), formRef = ref(), form = ref({})
function openForm(row) { form.value = row ? { ...row } : {}; visible.value = true }
async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    const body = Object.fromEntries(entity.value.fields.map((f) => [f.name, form.value[f.name]]))
    if (form.value.id) await http.put(`/admin/${entity.value.name}/${form.value.id}`, body)
    else await http.post(`/admin/${entity.value.name}`, body)
    ElMessage.success('保存成功'); visible.value = false; load()
  } finally { saving.value = false }
}
async function remove(row) { await http.delete(`/admin/${entity.value.name}/${row.id}`); ElMessage.success('已删除'); load() }
</script>
