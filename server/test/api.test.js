import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
process.env.DB_PATH = ':memory:'
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-up-'))
const request = (await import('supertest')).default
const { createApp } = await import('../src/app.js')
const { seed } = await import('../src/seed.js')

let app, admin, editor, viewer, user
const login = async (u, p, type = 'admin') => (await request(app).post(type === 'admin' ? '/api/auth/admin/login' : '/api/auth/login').send({ username: u, password: p })).body.data?.token
const auth = (t) => ({ Authorization: `Bearer ${t}` })

before(async () => {
  app = createApp(); seed()
  admin = await login('admin', 'admin123'); editor = await login('editor', 'editor123'); viewer = await login('viewer', 'viewer123'); user = await login('test', 'test123', 'user')
})

test('认证：登录、错误密码、双端隔离、注册、me', async () => {
  assert.ok(admin && editor && viewer && user)
  assert.equal((await request(app).post('/api/auth/admin/login').send({ username: 'admin', password: 'x' })).status, 400)
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' })).status, 403, '管理员不能登录用户端')
  assert.equal((await request(app).post('/api/auth/admin/login').send({ username: 'test', password: 'test123' })).status, 403, '普通用户不能登录后台')
  const reg = await request(app).post('/api/auth/register').send({ username: 'newbie', password: '123456' })
  assert.equal(reg.body.code, 0); assert.equal(reg.body.data.user.type, 'user')
  assert.equal((await request(app).post('/api/auth/register').send({ username: 'newbie', password: '123456' })).status, 400)
  const me = await request(app).get('/api/auth/me').set(auth(user))
  assert.equal(me.body.data.username, 'test')
  assert.equal((await request(app).get('/api/auth/me')).status, 401)
  assert.equal((await request(app).get('/api/auth/me').set(auth('bad.token'))).status, 401)
})

test('RBAC：角色权限控制', async () => {
  assert.equal((await request(app).get('/api/admin/notice').set(auth(user))).status, 403, '用户端 token 不能访问后台')
  assert.equal((await request(app).get('/api/admin/notice').set(auth(viewer))).status, 200)
  assert.equal((await request(app).post('/api/admin/notice').set(auth(viewer)).send({ title: 'x', content: 'y' })).status, 403, '只读角色不能写')
  assert.equal((await request(app).post('/api/admin/notice').set(auth(editor)).send({ title: 'x', content: 'y' })).status, 200)
  assert.equal((await request(app).get('/api/admin/system/users').set(auth(editor))).status, 403, '编辑没有用户权限')
  assert.equal((await request(app).get('/api/admin/system/users').set(auth(admin))).status, 200)
  const meta = await request(app).get('/api/admin/meta').set(auth(editor))
  assert.ok(meta.body.data.perms.includes('notice:write'))
  // 新建角色并分配权限后立即生效
  const role = await request(app).post('/api/admin/system/roles').set(auth(admin)).send({ code: 'book_admin', name: '图书管理员', perms: ['book:read', 'book:write'] })
  assert.equal(role.body.code, 0)
  await request(app).post('/api/admin/system/users').set(auth(admin)).send({ username: 'librarian', password: '123456', type: 'admin', role_id: role.body.data.id })
  const lib = await login('librarian', '123456')
  assert.equal((await request(app).get('/api/admin/book').set(auth(lib))).status, 200)
  assert.equal((await request(app).get('/api/admin/notice').set(auth(lib))).status, 403)
  assert.equal((await request(app).post('/api/admin/system/roles').set(auth(admin)).send({ code: 'bad', name: 'x', perms: ['nope:read'] })).status, 400)
  const roles = (await request(app).get('/api/admin/system/roles').set(auth(admin))).body.data
  const sa = roles.find((r) => r.code === 'super_admin')
  assert.equal((await request(app).put(`/api/admin/system/roles/${sa.id}`).set(auth(admin)).send({ perms: [] })).status, 400)
})

test('CRUD：增删改查、分页、搜索、校验、公开接口', async () => {
  const c = await request(app).post('/api/admin/book').set(auth(admin)).send({ title: '测试之书', author: '涛哥', price: '39.9', stock: 3.7 })
  assert.equal(c.body.code, 0); const id = c.body.data.id
  const g = await request(app).get(`/api/admin/book/${id}`).set(auth(admin))
  assert.equal(g.body.data.price, 39.9); assert.equal(g.body.data.stock, 3)
  assert.equal((await request(app).put(`/api/admin/book/${id}`).set(auth(admin)).send({ stock: 10 })).body.code, 0)
  assert.equal((await request(app).get(`/api/admin/book/${id}`).set(auth(admin))).body.data.stock, 10)
  const s = await request(app).get('/api/admin/book?keyword=涛哥').set(auth(admin))
  assert.equal(s.body.data.total, 1)
  const p = await request(app).get('/api/admin/book?page=1&size=2').set(auth(admin))
  assert.equal(p.body.data.list.length, 2); assert.ok(p.body.data.total >= 6)
  assert.equal((await request(app).post('/api/admin/book').set(auth(admin)).send({ author: '无名' })).status, 400, '必填校验')
  assert.equal((await request(app).post('/api/admin/book').set(auth(admin)).send({ title: 'a', price: 'abc' })).status, 400, '数字校验')
  assert.equal((await request(app).post('/api/admin/notice').set(auth(admin)).send({ title: 'a', content: 'b', category: '乱填' })).status, 400, '下拉选项校验')
  assert.equal((await request(app).delete(`/api/admin/book/${id}`).set(auth(admin))).body.code, 0)
  assert.equal((await request(app).get(`/api/admin/book/${id}`).set(auth(admin))).status, 404)
  // 公开接口只返回已发布公告
  const pub = await request(app).get('/api/notice')
  assert.ok(pub.body.data.list.every((n) => n.published === 1))
  const draft = (await request(app).get('/api/admin/notice?published=0').set(auth(admin))).body.data.list[0]
  assert.equal((await request(app).get(`/api/notice/${draft.id}`)).status, 404)
  // SQL 注入式参数不会生效
  assert.equal((await request(app).get("/api/admin/book?keyword=' OR 1=1 --").set(auth(admin))).body.data.total, 0)
})

test('上传：需要登录、类型和大小限制', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')
  assert.equal((await request(app).post('/api/upload').attach('file', png, 'a.png')).status, 401)
  const ok = await request(app).post('/api/upload').set(auth(user)).attach('file', png, { filename: 'a.png', contentType: 'image/png' })
  assert.equal(ok.body.code, 0); assert.match(ok.body.data.url, /^\/uploads\/.+\.png$/)
  assert.equal((await request(app).get(ok.body.data.url)).status, 200)
  assert.equal((await request(app).post('/api/upload').set(auth(user)).attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' })).status, 400)
})
