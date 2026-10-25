// 系统管理：用户、角色、权限
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { requirePerm, HttpError } from '../auth.js'

const r = Router()
const db = () => getDb()

// —— 防越权：管理员只能分配/管理「不超过自己」的权限 ——
const isSuper = (user) => user.perms.includes('*')
const rolePerms = (roleId) => db().prepare('SELECT perm_code FROM role_permissions WHERE role_id = ?').all(roleId).map((p) => p.perm_code)
/** perms 中当前操作者没有的权限（超管返回空数组） */
const beyond = (user, perms) => (isSuper(user) ? [] : perms.filter((p) => p === '*' || !user.perms.includes(p)))
function assertCanGrant(user, perms) {
  if (isSuper(user)) return
  if (perms.includes('*')) throw new HttpError(403, '只有超级管理员可以分配「全部权限」')
  const extra = beyond(user, perms)
  if (extra.length) throw new HttpError(403, '不能分配自己没有的权限：' + extra.join(','))
}
/** 只能把用户设为「权限不超过自己」的角色 */
function assertCanAssignRole(user, roleId) {
  if (roleId === null || roleId === undefined) return
  if (!db().prepare('SELECT 1 FROM roles WHERE id = ?').get(roleId)) throw new HttpError(400, '角色不存在')
  if (beyond(user, rolePerms(roleId)).length) throw new HttpError(403, '不能分配权限比自己高的角色')
}
/** 不能修改/删除权限比自己高的账号（例如普通管理员改超管密码） */
function assertCanManageUser(user, targetId) {
  const t = db().prepare('SELECT role_id FROM users WHERE id = ?').get(targetId)
  if (!t) throw new HttpError(404, '用户不存在')
  if (t.role_id && beyond(user, rolePerms(t.role_id)).length) throw new HttpError(403, '不能操作权限比自己高的账号')
}

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
  if (type === 'admin') assertCanAssignRole(req.user, role_id)
  const info = db().prepare('INSERT INTO users (username, password, nickname, type, role_id, phone) VALUES (?, ?, ?, ?, ?, ?)').run(username, bcrypt.hashSync(password, 10), nickname || username, type, type === 'admin' ? role_id : null, phone || null)
  res.json({ code: 0, data: { id: Number(info.lastInsertRowid) } })
})
r.put('/users/:id', requirePerm('user:write'), (req, res) => {
  const { nickname, role_id, status, password, phone } = req.body || {}
  const self = Number(req.params.id) === req.user.id
  if (self && status === 0) throw new HttpError(400, '不能禁用自己')
  assertCanManageUser(req.user, req.params.id)
  assertCanAssignRole(req.user, role_id)
  // 防自锁：升级已被上面拦住；降级可能把唯一的超管降没或把自己锁在外面，统一交给其他管理员操作
  if (self && role_id !== undefined && role_id !== null && Number(role_id) !== req.user.role_id) throw new HttpError(400, '不能修改自己的角色，请让其他管理员操作')
  db().prepare('UPDATE users SET nickname = COALESCE(?, nickname), role_id = COALESCE(?, role_id), status = COALESCE(?, status), phone = COALESCE(?, phone) WHERE id = ?').run(nickname ?? null, role_id ?? null, status ?? null, phone ?? null, req.params.id)
  if (password) db().prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id)
  res.json({ code: 0 })
})
r.delete('/users/:id', requirePerm('user:write'), (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, '不能删除自己')
  assertCanManageUser(req.user, req.params.id)
  db().prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ code: 0 })
})

r.get('/permissions', requirePerm('role:read'), (_req, res) => res.json({ code: 0, data: db().prepare('SELECT * FROM permissions ORDER BY code').all() }))
r.get('/roles', requirePerm('role:read'), (_req, res) => {
  const roles = db().prepare('SELECT * FROM roles ORDER BY id').all()
  const rp = db().prepare('SELECT perm_code FROM role_permissions WHERE role_id = ?')
  res.json({ code: 0, data: roles.map((x) => ({ ...x, perms: rp.all(x.id).map((p) => p.perm_code) })) })
})
function checkPermsShape(perms) {
  if (!Array.isArray(perms) || perms.some((p) => typeof p !== 'string')) throw new HttpError(400, 'perms 必须是字符串数组')
}
function savePerms(roleId, perms) {
  perms = [...new Set(perms)]
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
  checkPermsShape(perms)
  assertCanGrant(req.user, perms)
  let id
  db().transaction(() => {
    id = Number(db().prepare('INSERT INTO roles (code, name) VALUES (?, ?)').run(code, name).lastInsertRowid)
    savePerms(id, perms)
  })()
  res.json({ code: 0, data: { id } })
})
r.put('/roles/:id', requirePerm('role:write'), (req, res) => {
  const role = db().prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id)
  if (!role) throw new HttpError(404, '角色不存在')
  if (role.code === 'super_admin') throw new HttpError(400, '超级管理员角色不可修改')
  if (beyond(req.user, rolePerms(role.id)).length) throw new HttpError(403, '不能修改权限比自己高的角色')
  const { name, perms } = req.body || {}
  if (perms !== undefined) {
    checkPermsShape(perms); assertCanGrant(req.user, perms)
    // 防自锁：自己所属角色只能被缩小（加权限已被上面拦住），缩小会把自己和同角色的人一起锁在外面
    if (role.id === req.user.role_id && [...new Set(perms)].sort().join() !== rolePerms(role.id).sort().join()) throw new HttpError(400, '不能修改自己所属角色的权限，请让其他管理员操作')
  }
  db().transaction(() => { if (name) db().prepare('UPDATE roles SET name = ? WHERE id = ?').run(name, role.id); if (perms !== undefined) savePerms(role.id, perms) })()
  res.json({ code: 0 })
})
r.delete('/roles/:id', requirePerm('role:write'), (req, res) => {
  const role = db().prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id)
  if (!role) throw new HttpError(404, '角色不存在')
  if (role.builtin) throw new HttpError(400, '内置角色不可删除')
  if (beyond(req.user, rolePerms(role.id)).length) throw new HttpError(403, '不能删除权限比自己高的角色')
  if (db().prepare('SELECT 1 FROM users WHERE role_id = ?').get(role.id)) throw new HttpError(400, '仍有用户使用该角色')
  db().prepare('DELETE FROM roles WHERE id = ?').run(role.id)
  res.json({ code: 0 })
})
export default r
