// 初始化演示数据：npm run seed（可重复执行，已存在的不会重复插入）
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { getDb, closeDb } from './db.js'
import { bootstrap } from './app.js'

export function seed() {
bootstrap()
const db = getDb()
const role = (code, name, perms) => {
  db.prepare('INSERT OR IGNORE INTO roles (code, name, builtin) VALUES (?, ?, 1)').run(code, name)
  const id = db.prepare('SELECT id FROM roles WHERE code = ?').get(code).id
  const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, perm_code) VALUES (?, ?)')
  perms.forEach((p) => ins.run(id, p))
  return id
}
const sa = db.prepare("SELECT id FROM roles WHERE code = 'super_admin'").get().id
const editor = role('editor', '内容编辑', ['notice:read', 'notice:write', 'book:read', 'book:write'])
const viewer = role('viewer', '只读访客', ['notice:read', 'book:read', 'user:read'])
const user = (username, password, nickname, type, roleId) =>
  db.prepare('INSERT OR IGNORE INTO users (username, password, nickname, type, role_id) VALUES (?, ?, ?, ?, ?)').run(username, bcrypt.hashSync(password, 10), nickname, type, roleId)
user('admin', 'admin123', '超级管理员', 'admin', sa)
user('editor', 'editor123', '小编', 'admin', editor)
user('viewer', 'viewer123', '访客', 'admin', viewer)
user('test', 'test123', '测试同学', 'user', null)

if (!db.prepare('SELECT COUNT(*) c FROM notice').get().c) {
  const n = db.prepare('INSERT INTO notice (title, content, category, published, created_by) VALUES (?, ?, ?, ?, 1)')
  n.run('欢迎使用 bishe-kit', '这是一套 Vue3 + uni-app + Express + SQLite 的全栈脚手架，开箱即用。', '通知', 1)
  n.run('图书馆周末开放时间调整', '周六、周日开放时间调整为 9:00–17:00。', '通知', 1)
  n.run('读书月活动报名开始', '欢迎同学们踊跃报名参加读书分享会。', '活动', 1)
  n.run('（草稿）下学期选课说明', '尚未发布的草稿，只能在后台看到。', '新闻', 0)
}
if (!db.prepare('SELECT COUNT(*) c FROM book').get().c) {
  const b = db.prepare('INSERT INTO book (title, author, price, stock, publish_date, intro, created_by) VALUES (?, ?, ?, ?, ?, ?, 1)')
  ;[['JavaScript 高级程序设计', 'Matt Frisbie', 129, 12, '2020-09-01'], ['Vue.js 设计与实现', '霍春阳', 109.8, 8, '2022-01-01'], ['深入浅出 Node.js', '朴灵', 69, 5, '2013-12-01'], ['算法导论', 'Thomas H. Cormen', 128, 3, '2013-01-01'], ['数据库系统概念', 'Abraham Silberschatz', 99, 6, '2021-07-01']]
    .forEach(([t, a, p, s, d]) => b.run(t, a, p, s, d, `${t}，经典图书。`))
}
console.log('✅ 演示数据已就绪：管理端 admin/admin123、editor/editor123、viewer/viewer123；用户端 test/test123')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { seed(); closeDb() }
