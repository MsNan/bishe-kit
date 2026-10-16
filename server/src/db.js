// SQLite（sql.js / WebAssembly 版）：无需编译原生模块，Windows / macOS / Linux 装完依赖就能用。
// 这里封装成类似 better-sqlite3 的同步 API：prepare().get/all/run、exec、transaction。
import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { config } from './config.js'

const SQL = await initSqlJs()
let db

const norm = (args) => args.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v))

class Wrapper {
  constructor(file) {
    this.file = file
    this.raw = file !== ':memory:' && fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database()
    this.inTx = 0
    this.timer = null
  }
  save() {
    if (this.file === ':memory:' || this.inTx) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 50)
  }
  flush() {
    if (this.file === ':memory:') return
    clearTimeout(this.timer)
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = this.file + '.tmp'
    fs.writeFileSync(tmp, Buffer.from(this.raw.export()))
    fs.renameSync(tmp, this.file)
  }
  exec(sql) { this.raw.exec(sql); this.save() }
  pragma(p) { this.raw.exec('PRAGMA ' + p) }
  prepare(sql) {
    const self = this
    const query = (args) => {
      const st = self.raw.prepare(sql)
      try { st.bind(norm(args)); const rows = []; while (st.step()) rows.push(st.getAsObject()); return rows } finally { st.free() }
    }
    return {
      all: (...args) => query(args),
      get: (...args) => query(args)[0],
      run: (...args) => {
        self.raw.run(sql, norm(args))
        const changes = self.raw.getRowsModified()
        const lastInsertRowid = self.raw.exec('SELECT last_insert_rowid()')[0].values[0][0]
        self.save()
        return { changes, lastInsertRowid }
      },
    }
  }
  transaction(fn) {
    return (...args) => {
      this.raw.exec('BEGIN'); this.inTx++
      try { const r = fn(...args); this.inTx--; this.raw.exec('COMMIT'); this.save(); return r } catch (e) { this.inTx--; this.raw.exec('ROLLBACK'); throw e }
    }
  }
  close() { this.flush(); this.raw.close() }
}

export function getDb() {
  if (db) return db
  db = new Wrapper(config.dbPath)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, builtin INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS permissions (code TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE, perm_code TEXT REFERENCES permissions(code) ON DELETE CASCADE, PRIMARY KEY (role_id, perm_code));
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, nickname TEXT, avatar TEXT, phone TEXT,
      type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('admin','user')), role_id INTEGER REFERENCES roles(id),
      status INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')));
  `)
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { db?.flush(); process.exit(0) })
  return db
}
export function closeDb() { db?.close(); db = undefined }
