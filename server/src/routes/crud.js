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

function buildWhere(entity, req, extraWhere = '') {
  const where = []; const args = []
  const kw = String(req.query.keyword || '').trim()
  const searchable = entity.fields.filter((f) => f.search)
  if (kw && searchable.length) { where.push('(' + searchable.map((f) => `${f.name} LIKE ?`).join(' OR ') + ')'); searchable.forEach(() => args.push(`%${kw}%`)) }
  for (const f of entity.fields) if (req.query[f.name] !== undefined && f.type !== 'text') { where.push(`${f.name} = ?`); args.push(req.query[f.name]) }
  if (extraWhere) where.push(extraWhere)
  return { w: where.length ? 'WHERE ' + where.join(' AND ') : '', args }
}

function list(entity, req, extraWhere = '') {
  const db = getDb()
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 10))
  const { w, args } = buildWhere(entity, req, extraWhere)
  const total = db.prepare(`SELECT COUNT(*) c FROM ${entity.name} ${w}`).get(...args).c
  const rows = db.prepare(`SELECT * FROM ${entity.name} ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size)
  return { list: rows, total, page, size }
}

/** 单次导出上限，超过时提示先筛选（避免一次把整张大表读进内存） */
export const EXPORT_LIMIT = Number(process.env.EXPORT_LIMIT) || 10000

/** CSV 单元格：需要时加引号；文本字段以 = + - @ 等开头时前面加 '，防止在 Excel 里被当成公式执行（CSV 注入） */
export function csvCell(v, isText = false) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (isText && /^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** 按当前筛选条件导出全部数据为 CSV（UTF-8 BOM，Excel 直接打开中文不乱码） */
export function toCsv(entity, rows) {
  const cols = [{ name: 'id', label: 'ID' }, ...entity.fields, { name: 'created_at', label: '创建时间' }, { name: 'updated_at', label: '更新时间' }]
  const isText = (c) => !['id', 'created_at', 'updated_at'].includes(c.name) && !['number', 'int', 'bool', 'date'].includes(c.type)
  const lines = [cols.map((c) => csvCell(c.label)).join(',')]
  for (const r of rows) {
    lines.push(cols.map((c) => {
      const v = r[c.name]
      if (c.type === 'bool') return v === null || v === undefined ? '' : v ? '是' : '否'
      return csvCell(v, isText(c))
    }).join(','))
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/** 管理端 CRUD：/api/admin/<entity> */
export function adminCrud(entity) {
  const r = Router(); const t = entity.name
  r.get('/', requirePerm(`${t}:read`), (req, res) => res.json({ code: 0, data: list(entity, req) }))
  // 必须写在 /:id 之前，否则 export 会被当成 id
  r.get('/export', requirePerm(`${t}:read`), (req, res) => {
    const db = getDb()
    const { w, args } = buildWhere(entity, req)
    const total = db.prepare(`SELECT COUNT(*) c FROM ${t} ${w}`).get(...args).c
    if (total > EXPORT_LIMIT) throw new HttpError(400, `共 ${total} 条，超过单次导出上限 ${EXPORT_LIMIT} 条，请先筛选再导出`)
    const rows = db.prepare(`SELECT * FROM ${t} ${w} ORDER BY id DESC`).all(...args)
    const d = new Date(); const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const filename = `${entity.label || t}_${stamp}.csv`
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', `attachment; filename="${t}_${stamp}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.send(toCsv(entity, rows))
  })
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
