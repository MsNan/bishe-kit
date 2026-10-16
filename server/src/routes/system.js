// 系统管理：用户、角色、权限
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { requirePerm, HttpError } from '../auth.js'

const r = Router()
const db = () => getDb()

r.get('/users', requirePerm('user:read'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), size = Math.min(100, Number(req.query.size) || 10)
  const where = []; const args = []
  if (req.query.type) { where.push('u.type = ?'); args.push(req.query.type) }
  if (req.query.keyword) { where.push('(u.username LIKE ? OR u.nickname LIKE ?)'); args.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`) }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total = db().prepare(`SELECT COUNT(*) c FROM users u ${w}`).get(...args).c
  const list = db().prepare(`SELECT u.id, u.username, u.nickname, u.avatar, u.phone, u.type, u.role_id, r.name role_name, u.status, u.created_at FROM users u LEFT JOIN roles r ON r.id = u.role_id ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size)
  res.json({ code: 0, data: { list, total, page, size } })
})
r.post('/users', requirePerm('user:write'), (req, res) => {
  const { username, password, nickname, type = 'user', role_id = null, phone } = req.body || {}
  if (!username || !password || password.length < 6) throw new HttpError(400, '用户名必填，密码至少 6 位')
  if (!['admin', 'user'].includes(type)) throw new HttpError(400, '类型不合法')
  if (db().prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(400, '用户名已存在')
  const info = db().prepare('INSERT INTO users (username, password, nickname, type, role_id, phone) VALUES (?, ?, ?, ?, ?, ?)').run(username, bcrypt.hashSync(password, 10), nickname || username, type, type === 'admin' ? role_id : null, phone || null)
  res.json({ code: 0, data: { id: Number(info.lastInsertRowid) } })
})
r.put('/users/:id', requirePerm('user:write'), (req, res) => {
  const { nickname, role_id, status, password, phone } = req.body || {}
  if (Number(req.params.id) === req.user.id && status === 0) throw new HttpError(400, '不能禁用自己')
  db().prepare('UPDATE users SET nickname = COALESCE(?, nickname), role_id = COALESCE(?, role_id), status = COALESCE(?, status), phone = COALESCE(?, phone) WHERE id = ?').run(nickname ?? null, role_id ?? null, status ?? null, phone ?? null, req.params.id)
  if (password) db().prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id)
  res.json({ code: 0 })
})
r.delete('/users/:id', requirePerm('user:write'), (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, '不能删除自己')
  db().prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ code: 0 })
})

r.get('/permissions', requirePerm('role:read'), (_req, res) => res.json({ code: 0, data: db().prepare('SELECT * FROM permissions ORDER BY code').all() }))
r.get('/roles', requirePerm('role:read'), (_req, res) => {
  const roles = db().prepare('SELECT * FROM roles ORDER BY id').all()
  const rp = db().prepare('SELECT perm_code FROM role_permissions WHERE role_id = ?')
  res.json({ code: 0, data: roles.map((x) => ({ ...x, perms: rp.all(x.id).map((p) => p.perm_code) })) })
})
function savePerms(roleId, perms) {
  const valid = new Set(db().prepare('SELECT code FROM permissions').all().map((p) => p.code))
  const bad = perms.filter((p) => !valid.has(p))
  if (bad.length) throw new HttpError(400, '未知权限：' + bad.join(','))
  db().prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId)
  const ins = db().prepare('INSERT INTO role_permissions (role_id, perm_code) VALUES (?, ?)')
  perms.forEach((p) => ins.run(roleId, p))
}
r.post('/roles', requirePerm('role:write'), (req, res) => {
  const { code, name, perms = [] } = req.body || {}
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(code || '') || !name) throw new HttpError(400, '角色编码（小写字母开头）和名称必填')
  if (db().prepare('SELECT 1 FROM roles WHERE code = ?').get(code)) throw new HttpError(400, '角色编码已存在')
  const id = Number(db().prepare('INSERT INTO roles (code, name) VALUES (?, ?)').run(code, name).lastInsertRowid)
  db().transaction(() => savePerms(id, perms))()
  res.json({ code: 0, data: { id } })
})
r.put('/roles/:id', requirePerm('role:write'), (req, res) => {
  const role = db().prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id)
  if (!role) throw new HttpError(404, '角色不存在')
  if (role.code === 'super_admin') throw new HttpError(400, '超级管理员角色不可修改')
  const { name, perms } = req.body || {}
  db().transaction(() => { if (name) db().prepare('UPDATE roles SET name = ? WHERE id = ?').run(name, role.id); if (Array.isArray(perms)) savePerms(role.id, perms) })()
  res.json({ code: 0 })
})
r.delete('/roles/:id', requirePerm('role:write'), (req, res) => {
  const role = db().prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id)
  if (!role) throw new HttpError(404, '角色不存在')
  if (role.builtin) throw new HttpError(400, '内置角色不可删除')
  if (db().prepare('SELECT 1 FROM users WHERE role_id = ?').get(role.id)) throw new HttpError(400, '仍有用户使用该角色')
  db().prepare('DELETE FROM roles WHERE id = ?').run(role.id)
  res.json({ code: 0 })
})
export default r
