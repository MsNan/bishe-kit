import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { sign, requireLogin, HttpError } from '../auth.js'

const r = Router()
const pub = (u) => ({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar, phone: u.phone, type: u.type, perms: u.perms ?? [] })

function login(type) {
  return (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) throw new HttpError(400, '请输入账号和密码')
    const u = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!u || !bcrypt.compareSync(password, u.password)) throw new HttpError(400, '账号或密码错误')
    if (u.status !== 1) throw new HttpError(403, '账号已被禁用')
    if (u.type !== type) throw new HttpError(403, type === 'admin' ? '该账号不是管理端账号' : '管理端账号请在后台登录')
    res.json({ code: 0, data: { token: sign(u), user: pub(u) } })
  }
}
r.post('/admin/login', login('admin'))
r.post('/login', login('user'))

r.post('/register', (req, res) => {
  const { username, password, nickname } = req.body || {}
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username || '')) throw new HttpError(400, '用户名需为 4–20 位字母、数字或下划线')
  if (!password || password.length < 6) throw new HttpError(400, '密码至少 6 位')
  const db = getDb()
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(400, '用户名已存在')
  const info = db.prepare("INSERT INTO users (username, password, nickname, type) VALUES (?, ?, ?, 'user')").run(username, bcrypt.hashSync(password, 10), nickname || username)
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
  res.json({ code: 0, data: { token: sign(u), user: pub(u) } })
})

r.get('/me', requireLogin, (req, res) => res.json({ code: 0, data: pub(req.user) }))
r.put('/me', requireLogin, (req, res) => {
  const { nickname, avatar, phone } = req.body || {}
  getDb().prepare('UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), phone = COALESCE(?, phone) WHERE id = ?').run(nickname ?? null, avatar ?? null, phone ?? null, req.user.id)
  res.json({ code: 0 })
})
r.put('/password', requireLogin, (req, res) => {
  const { oldPassword, newPassword } = req.body || {}
  const u = getDb().prepare('SELECT password FROM users WHERE id = ?').get(req.user.id)
  if (!bcrypt.compareSync(oldPassword || '', u.password)) throw new HttpError(400, '原密码错误')
  if (!newPassword || newPassword.length < 6) throw new HttpError(400, '新密码至少 6 位')
  getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id)
  res.json({ code: 0 })
})
export default r
