import { Router } from 'express'
import { getDb } from '../db.js'
import { requirePerm, HttpError } from '../auth.js'

function clean(entity, body, partial) {
  const out = {}
  for (const f of entity.fields) {
    let v = body?.[f.name]
    if (v === undefined) { if (!partial && f.required) throw new HttpError(400, `${f.label}不能为空`); continue }
    if (v === '' || v === null) { if (f.required) throw new HttpError(400, `${f.label}不能为空`); out[f.name] = null; continue }
    if (f.type === 'number' || f.type === 'int') { v = Number(v); if (Number.isNaN(v)) throw new HttpError(400, `${f.label}必须是数字`); if (f.type === 'int') v = Math.trunc(v) }
    else if (f.type === 'bool') v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0
    else { v = String(v); if (f.type === 'select' && f.options && !f.options.includes(v)) throw new HttpError(400, `${f.label}取值不合法`) }
    out[f.name] = v
  }
  return out
}

function list(entity, req, extraWhere = '') {
  const db = getDb()
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 10))
  const where = []; const args = []
  const kw = String(req.query.keyword || '').trim()
  const searchable = entity.fields.filter((f) => f.search)
  if (kw && searchable.length) { where.push('(' + searchable.map((f) => `${f.name} LIKE ?`).join(' OR ') + ')'); searchable.forEach(() => args.push(`%${kw}%`)) }
  for (const f of entity.fields) if (req.query[f.name] !== undefined && f.type !== 'text') { where.push(`${f.name} = ?`); args.push(req.query[f.name]) }
  if (extraWhere) where.push(extraWhere)
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total = db.prepare(`SELECT COUNT(*) c FROM ${entity.name} ${w}`).get(...args).c
  const rows = db.prepare(`SELECT * FROM ${entity.name} ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size)
  return { list: rows, total, page, size }
}

/** 管理端 CRUD：/api/admin/<entity> */
export function adminCrud(entity) {
  const r = Router(); const t = entity.name
  r.get('/', requirePerm(`${t}:read`), (req, res) => res.json({ code: 0, data: list(entity, req) }))
  r.get('/:id', requirePerm(`${t}:read`), (req, res) => {
    const row = getDb().prepare(`SELECT * FROM ${t} WHERE id = ?`).get(req.params.id)
    if (!row) throw new HttpError(404, '记录不存在')
    res.json({ code: 0, data: row })
  })
  r.post('/', requirePerm(`${t}:write`), (req, res) => {
    const d = clean(entity, req.body, false)
    const keys = Object.keys(d)
    const info = getDb().prepare(`INSERT INTO ${t} (${[...keys, 'created_by'].join(',')}) VALUES (${[...keys, 'created_by'].map(() => '?').join(',')})`).run(...keys.map((k) => d[k]), req.user.id)
    res.json({ code: 0, data: { id: Number(info.lastInsertRowid) } })
  })
  r.put('/:id', requirePerm(`${t}:write`), (req, res) => {
    const d = clean(entity, req.body, true)
    const keys = Object.keys(d)
    if (!keys.length) throw new HttpError(400, '没有可更新的字段')
    const info = getDb().prepare(`UPDATE ${t} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`).run(...keys.map((k) => d[k]), req.params.id)
    if (!info.changes) throw new HttpError(404, '记录不存在')
    res.json({ code: 0 })
  })
  r.delete('/:id', requirePerm(`${t}:write`), (req, res) => {
    const info = getDb().prepare(`DELETE FROM ${t} WHERE id = ?`).run(req.params.id)
    if (!info.changes) throw new HttpError(404, '记录不存在')
    res.json({ code: 0 })
  })
  return r
}

/** 用户端只读接口：/api/<entity>（实体 public: true 时开放，含 published 字段则只返回已发布） */
export function publicCrud(entity) {
  const r = Router(); const t = entity.name
  const pubWhere = entity.fields.some((f) => f.name === 'published') ? 'published = 1' : ''
  r.get('/', (req, res) => res.json({ code: 0, data: list(entity, req, pubWhere) }))
  r.get('/:id', (req, res) => {
    const row = getDb().prepare(`SELECT * FROM ${t} WHERE id = ? ${pubWhere ? 'AND ' + pubWhere : ''}`).get(req.params.id)
    if (!row) throw new HttpError(404, '记录不存在')
    res.json({ code: 0, data: row })
  })
  return r
}
