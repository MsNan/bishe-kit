<template>
  <div>
    <el-row :gutter="16">
      <el-col v-for="c in cards" :key="c.label" :xs="12" :sm="8" :md="6" style="margin-bottom: 16px">
        <div class="page-card stat"><div class="num">{{ c.value }}</div><div class="label">{{ c.label }}</div></div>
      </el-col>
    </el-row>
    <div class="page-card">
      <h3 style="margin-top: 0">近 7 天新增用户</h3>
      <div class="bars">
        <div v-for="d in days" :key="d.d" class="bar-wrap">
          <div class="bar" :style="{ height: (d.c / max) * 140 + 4 + 'px' }"><span>{{ d.c }}</span></div>
          <div class="day">{{ d.d.slice(5) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import http from '../api/http.js'
import { useUserStore } from '../stores/user.js'
const store = useUserStore()
const stats = ref({ counts: {}, users: [], recent: [] })
onMounted(async () => { stats.value = await http.get('/admin/stats') })
const cards = computed(() => [
  { label: '后台账号', value: stats.value.users.find((u) => u.type === 'admin')?.c ?? 0 },
  { label: '注册用户', value: stats.value.users.find((u) => u.type === 'user')?.c ?? 0 },
  ...store.entities.map((e) => ({ label: e.label, value: stats.value.counts[e.name] ?? 0 })),
])
const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const dt = new Date(Date.now() - (6 - i) * 864e5); const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { d, c: stats.value.recent.find((r) => r.d === d)?.c ?? 0 }
}))
const max = computed(() => Math.max(1, ...days.value.map((d) => d.c)))
</script>
<style scoped>
.stat .num { font-size: 28px; font-weight: 600; color: #10b981; }
.stat .label { color: #909399; margin-top: 4px; }
.bars { display: flex; align-items: flex-end; gap: 16px; height: 180px; }
.bar-wrap { flex: 1; text-align: center; }
.bar { background: linear-gradient(#34d399, #10b981); border-radius: 4px 4px 0 0; position: relative; }
.bar span { position: absolute; top: -18px; left: 0; right: 0; font-size: 12px; color: #606266; }
.day { font-size: 12px; color: #909399; margin-top: 6px; }
</style>
