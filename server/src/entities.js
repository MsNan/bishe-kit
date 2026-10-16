// 实体定义加载器：src/entities/*.json 自动建表、生成权限、生成 CRUD 接口，后台自动出菜单
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './config.js'
import { getDb } from './db.js'

const DIR = path.join(ROOT, 'src', 'entities')
const TYPES = { string: 'TEXT', text: 'TEXT', number: 'REAL', int: 'INTEGER', bool: 'INTEGER', date: 'TEXT', image: 'TEXT', select: 'TEXT' }
export const NAME_RE = /^[a-z][a-z0-9_]{1,30}$/

export function loadEntities() {
  if (!fs.existsSync(DIR)) return []
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const e = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
    if (!NAME_RE.test(e.name)) throw new Error(`实体名不合法: ${e.name}`)
    for (const fd of e.fields) {
      if (!NAME_RE.test(fd.name)) throw new Error(`字段名不合法: ${e.name}.${fd.name}`)
      if (!TYPES[fd.type]) throw new Error(`不支持的字段类型: ${fd.type}`)
    }
    return e
  })
}

export function syncEntities(entities) {
  const db = getDb()
  const perm = db.prepare('INSERT OR IGNORE INTO permissions (code, name) VALUES (?, ?)')
  for (const e of entities) {
    const cols = e.fields.map((f) => `${f.name} ${TYPES[f.type]}`).join(', ')
    db.exec(`CREATE TABLE IF NOT EXISTS ${e.name} (id INTEGER PRIMARY KEY, ${cols}, created_by INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT)`)
    const existing = new Set(db.prepare(`PRAGMA table_info(${e.name})`).all().map((c) => c.name))
    for (const f of e.fields) if (!existing.has(f.name)) db.exec(`ALTER TABLE ${e.name} ADD COLUMN ${f.name} ${TYPES[f.type]}`)
    perm.run(`${e.name}:read`, `${e.label}-查看`)
    perm.run(`${e.name}:write`, `${e.label}-编辑`)
  }
}
