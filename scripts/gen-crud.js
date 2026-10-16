#!/usr/bin/env node
// CRUD 生成器：生成实体定义 → 后端自动建表/接口/权限 → 后台自动出菜单和增删改查页面
// 用法：npm run gen -- <实体名> <中文名> <字段...> [--public] [--icon Goods] [--client]
// 字段格式：name:type:中文名[:required][:search][:options=选项1|选项2]
// 类型：string text number int bool date image select
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = ['string', 'text', 'number', 'int', 'bool', 'date', 'image', 'select']
const NAME_RE = /^[a-z][a-z0-9_]{1,30}$/
const RESERVED = ['users', 'roles', 'permissions', 'role_permissions', 'auth', 'admin', 'upload', 'uploads', 'health', 'system', 'meta', 'stats']

function fail(msg) { console.error('❌ ' + msg + '\n\n示例：npm run gen -- product 商品 name:string:名称:required:search price:number:价格 cover:image:图片 category:select:分类:options=数码|服装 --public --client'); process.exit(1) }

const args = process.argv.slice(2)
const flags = { public: false, client: false, icon: 'Document', force: false }
const pos = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--public') flags.public = true
  else if (args[i] === '--client') { flags.client = true; flags.public = true }
  else if (args[i] === '--force') flags.force = true
  else if (args[i] === '--icon') flags.icon = args[++i]
  else pos.push(args[i])
}
const [name, label, ...fieldSpecs] = pos
if (!name || !label || !fieldSpecs.length) fail('参数不完整')
if (!NAME_RE.test(name) || RESERVED.includes(name)) fail(`实体名 "${name}" 不合法（小写字母开头，只能有小写字母/数字/下划线，且不能是保留字）`)

const fields = fieldSpecs.map((spec) => {
  const [fname, type, flabel, ...rest] = spec.split(':')
  if (!NAME_RE.test(fname || '') || ['id', 'created_by', 'created_at', 'updated_at'].includes(fname)) fail(`字段名 "${fname}" 不合法`)
  if (!TYPES.includes(type)) fail(`字段 ${fname} 的类型 "${type}" 不支持，可选：${TYPES.join(' ')}`)
  const f = { name: fname, label: flabel || fname, type }
  for (const r of rest) {
    if (r === 'required') f.required = true
    else if (r === 'search') f.search = true
    else if (r.startsWith('options=')) f.options = r.slice(8).split('|').filter(Boolean)
    else fail(`未知字段修饰 "${r}"`)
  }
  if (type === 'select' && !f.options?.length) fail(`下拉字段 ${fname} 需要 options=选项1|选项2`)
  return f
})

const entityFile = path.join(ROOT, 'server', 'src', 'entities', `${name}.json`)
if (fs.existsSync(entityFile) && !flags.force) fail(`${path.relative(ROOT, entityFile)} 已存在，加 --force 覆盖`)
const entity = { name, label, icon: flags.icon, public: flags.public, fields }
fs.writeFileSync(entityFile, JSON.stringify(entity, null, 2) + '\n')
console.log('✅ 已生成 ' + path.relative(ROOT, entityFile))

if (flags.client) {
  const title = fields.find((f) => f.type === 'string')?.name || fields[0].name
  const img = fields.find((f) => f.type === 'image')?.name
  const dir = path.join(ROOT, 'client', 'src', 'pages', name)
  fs.mkdirSync(dir, { recursive: true })
  const others = fields.filter((f) => f.name !== title && f.name !== img && f.type !== 'text')
  fs.writeFileSync(path.join(dir, 'list.vue'), `<template>
  <view>
    <view v-for="item in list" :key="item.id" class="card" @click="open(item.id)">
${img ? `      <image v-if="item.${img}" :src="fileUrl(item.${img})" mode="aspectFill" style="width: 100%; height: 300rpx; border-radius: 12rpx" />\n` : ''}      <text style="font-size: 32rpx; font-weight: 600; display: block">{{ item.${title} }}</text>
${others.map((f) => `      <text class="muted" style="display: block">${f.label}：{{ item.${f.name} ?? '-' }}</text>`).join('\n')}
    </view>
    <view class="muted" style="text-align: center; padding: 30rpx">{{ finished ? (list.length ? '没有更多了' : '暂无数据') : '加载中…' }}</view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { http, fileUrl } from '../../utils/request.js'
const list = ref([]), page = ref(1), finished = ref(false)
async function load(reset = false) {
  if (reset) { page.value = 1; finished.value = false; list.value = [] }
  if (finished.value) return
  const d = await http.get('/${name}', { page: page.value, size: 10 })
  list.value.push(...d.list); finished.value = list.value.length >= d.total; page.value++
}
const open = (id) => uni.navigateTo({ url: '/pages/${name}/detail?id=' + id })
onLoad(() => load(true))
onReachBottom(() => load())
onPullDownRefresh(async () => { await load(true).finally(() => uni.stopPullDownRefresh()) })
</script>
`)
  fs.writeFileSync(path.join(dir, 'detail.vue'), `<template>
  <view v-if="item" class="card">
${fields.map((f) => f.type === 'image' ? `    <image v-if="item.${f.name}" :src="fileUrl(item.${f.name})" mode="widthFix" style="width: 100%; border-radius: 12rpx" />` : `    <view style="margin-bottom: 16rpx"><text class="muted">${f.label}</text><text style="display: block; white-space: pre-wrap">{{ item.${f.name} ?? '-' }}</text></view>`).join('\n')}
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { http, fileUrl } from '../../utils/request.js'
const item = ref(null)
onLoad(async (q) => { item.value = await http.get('/${name}/' + q.id) })
</script>
`)
  const pj = path.join(ROOT, 'client', 'src', 'pages.json')
  let s = fs.readFileSync(pj, 'utf8')
  if (!s.includes(`pages/${name}/list`)) {
    s = s.replace(/("pages"\s*:\s*\[)/, `$1\n    { "path": "pages/${name}/list", "style": { "navigationBarTitleText": "${label}", "enablePullDownRefresh": true } },\n    { "path": "pages/${name}/detail", "style": { "navigationBarTitleText": "${label}详情" } },`)
    // 首页必须保持在第一位：把新页面移到 index 之后
    s = s.replace(/(\[\n)(\s*\{ "path": "pages\/[^"]+\/list"[^\n]*\n\s*\{ "path": "pages\/[^"]+\/detail"[^\n]*\n)(\s*\{ "path": "pages\/index\/index"[^\n]*\n)/, '$1$3$2')
    fs.writeFileSync(pj, s)
  }
  console.log(`✅ 已生成用户端页面 client/src/pages/${name}/list.vue、detail.vue 并注册到 pages.json`)
}
console.log(`\n下一步：重启后端（npm run dev 会自动重启），后台左侧菜单就会出现「${label}管理」；新权限 ${name}:read / ${name}:write 可以在「角色权限」里分配。`)
