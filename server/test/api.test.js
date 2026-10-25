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

test('防越权：只能分配/管理不超过自己的权限', async () => {
  const roles = (await request(app).get('/api/admin/system/roles').set(auth(admin))).body.data
  const sa = roles.find((r) => r.code === 'super_admin'), editorRole = roles.find((r) => r.code === 'editor')
  // 超管建一个「系统管理员」：能管用户和角色，但没有 *，也没有内容权限
  const sys = await request(app).post('/api/admin/system/roles').set(auth(admin)).send({ code: 'sys_admin', name: '系统管理员', perms: ['user:read', 'user:write', 'role:read', 'role:write'] })
  assert.equal(sys.body.code, 0)
  await request(app).post('/api/admin/system/users').set(auth(admin)).send({ username: 'ops', password: '123456', type: 'admin', role_id: sys.body.data.id })
  const ops = await login('ops', '123456')
  const post = (url, body) => request(app).post(url).set(auth(ops)).send(body)
  const put = (url, body) => request(app).put(url).set(auth(ops)).send(body)

  // 角色：不能分配 * 或自己没有的权限，也不能留下半成品角色
  assert.equal((await post('/api/admin/system/roles', { code: 'evil', name: 'x', perms: ['*'] })).status, 403)
  assert.equal((await post('/api/admin/system/roles', { code: 'evil2', name: 'x', perms: ['book:write'] })).status, 403)
  assert.equal((await post('/api/admin/system/roles', { code: 'evil3', name: 'x', perms: '*' })).status, 400)
  assert.equal((await post('/api/admin/system/roles', { code: 'okrole', name: '用户查看', perms: ['user:read'] })).body.code, 0, '自己有的权限可以分配')
  assert.equal((await put(`/api/admin/system/roles/${sys.body.data.id}`, { perms: ['user:read', 'user:write', 'role:read', 'role:write', 'notice:write'] })).status, 403, '不能给自己的角色加权限')
  assert.equal((await put(`/api/admin/system/roles/${editorRole.id}`, { perms: [] })).status, 403, '不能改权限比自己高的角色')
  // 用户：不能把人设成超管，不能改/删超管账号
  assert.equal((await post('/api/admin/system/users', { username: 'evil_sa', password: '123456', type: 'admin', role_id: sa.id })).status, 403)
  assert.equal((await post('/api/admin/system/users', { username: 'evil_x', password: '123456', type: 'admin', role_id: 99999 })).status, 400)
  const users = (await request(app).get('/api/admin/system/users?size=100').set(auth(ops))).body.data.list
  const me = users.find((u) => u.username === 'ops'), root = users.find((u) => u.username === 'admin')
  assert.equal((await put(`/api/admin/system/users/${me.id}`, { role_id: sa.id })).status, 403, '不能给自己升级成超管')
  assert.equal((await put(`/api/admin/system/users/${root.id}`, { password: 'hacked1' })).status, 403, '不能重置超管密码')
  assert.equal((await request(app).delete(`/api/admin/system/users/${root.id}`).set(auth(ops))).status, 403)
  assert.ok(await login('admin', 'admin123'), '超管密码未被改')
  const roleCodes = (await request(app).get('/api/admin/system/roles').set(auth(admin))).body.data.map((r) => r.code)
  assert.ok(!roleCodes.some((c) => c.startsWith('evil')), '被拒绝的请求没有建出角色')
  // 超管不受限制
  assert.equal((await request(app).put(`/api/admin/system/roles/${editorRole.id}`).set(auth(admin)).send({ perms: ['notice:read', 'notice:write', 'book:read', 'book:write'] })).body.code, 0)
})

test('防自锁：不能改自己的角色/自己角色的权限，系统至少保留一个超管', async () => {
  const roles = (await request(app).get('/api/admin/system/roles').set(auth(admin))).body.data
  const sa = roles.find((r) => r.code === 'super_admin'), editorRole = roles.find((r) => r.code === 'editor')
  const users = () => request(app).get('/api/admin/system/users?size=100').set(auth(admin)).then((r) => r.body.data.list)
  const root = (await users()).find((u) => u.username === 'admin')
  // 唯一的超管不能把自己降级
  assert.equal((await request(app).put(`/api/admin/system/users/${root.id}`).set(auth(admin)).send({ role_id: editorRole.id })).status, 400)
  // 管理员不能缩小自己所属角色的权限（同角色的人会一起被锁在外面），改名可以
  const lock = await request(app).post('/api/admin/system/roles').set(auth(admin)).send({ code: 'lock_admin', name: '锁测试', perms: ['user:read', 'user:write', 'role:read', 'role:write'] })
  await request(app).post('/api/admin/system/users').set(auth(admin)).send({ username: 'locker', password: '123456', type: 'admin', role_id: lock.body.data.id })
  await request(app).post('/api/admin/system/users').set(auth(admin)).send({ username: 'locker2', password: '123456', type: 'admin', role_id: lock.body.data.id })
  const locker = await login('locker', '123456')
  assert.equal((await request(app).put(`/api/admin/system/roles/${lock.body.data.id}`).set(auth(locker)).send({ perms: ['user:read'] })).status, 400)
  assert.equal((await request(app).put(`/api/admin/system/roles/${lock.body.data.id}`).set(auth(locker)).send({ name: '锁测试2' })).body.code, 0)
  // 也不能把自己换到更小的角色
  const me = (await users()).find((u) => u.username === 'locker')
  const small = await request(app).post('/api/admin/system/roles').set(auth(admin)).send({ code: 'small_role', name: '只读用户', perms: ['user:read'] })
  assert.equal((await request(app).put(`/api/admin/system/users/${me.id}`).set(auth(locker)).send({ role_id: small.body.data.id })).status, 400)
  assert.equal((await request(app).get('/api/admin/system/roles').set(auth(locker))).status, 200, '权限仍在')
  // 超管之间可以互相调整，系统仍有超管
  await request(app).post('/api/admin/system/users').set(auth(admin)).send({ username: 'root2', password: '123456', type: 'admin', role_id: sa.id })
  const root2 = (await users()).find((u) => u.username === 'root2')
  assert.equal((await request(app).put(`/api/admin/system/users/${root2.id}`).set(auth(admin)).send({ role_id: editorRole.id })).body.code, 0)
  assert.equal((await request(app).put(`/api/admin/system/users/${root.id}`).set(auth(admin)).send({ role_id: sa.id, nickname: '超管' })).body.code, 0, '传入自己当前的角色不算修改')
  assert.ok(await login('admin', 'admin123'))
})
