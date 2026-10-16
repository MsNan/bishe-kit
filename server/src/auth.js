import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { getDb } from './db.js'

export const sign = (u) => jwt.sign({ uid: u.id, type: u.type }, config.jwtSecret, { expiresIn: config.jwtExpires })

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status } }

export function permsOf(user) {
  if (!user.role_id) return []
  return getDb().prepare('SELECT perm_code FROM role_permissions WHERE role_id = ?').all(user.role_id).map((r) => r.perm_code)
}

/** 解析 token（可选） */
export function parseToken(req, _res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (token) {
    try {
      const p = jwt.verify(token, config.jwtSecret)
      const u = getDb().prepare('SELECT id, username, nickname, avatar, phone, type, role_id, status FROM users WHERE id = ?').get(p.uid)
      if (u && u.status === 1) { req.user = u; req.user.perms = permsOf(u) }
    } catch { /* token 无效视为未登录 */ }
  }
  next()
}
export const requireLogin = (req, _res, next) => (req.user ? next() : next(new HttpError(401, '请先登录')))
export const requireAdmin = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, '请先登录'))
  if (req.user.type !== 'admin') return next(new HttpError(403, '仅管理端账号可访问'))
  next()
}
export const can = (user, perm) => !!user && (user.perms.includes('*') || user.perms.includes(perm))
export const requirePerm = (perm) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, '请先登录'))
  if (req.user.type !== 'admin' || !can(req.user, perm)) return next(new HttpError(403, `缺少权限：${perm}`))
  next()
}
