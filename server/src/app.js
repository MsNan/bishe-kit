import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { config } from './config.js'
import { getDb } from './db.js'
import { parseToken, requireAdmin, requireLogin, HttpError } from './auth.js'
import authRoutes from './routes/auth.js'
import systemRoutes from './routes/system.js'
import { adminCrud, publicCrud } from './routes/crud.js'
import { loadEntities, syncEntities } from './entities.js'

const BASE_PERMS = [['*', '全部权限'], ['user:read', '用户-查看'], ['user:write', '用户-编辑'], ['role:read', '角色-查看'], ['role:write', '角色-编辑']]

export function bootstrap() {
  const db = getDb()
  const entities = loadEntities()
  db.transaction(() => {
    const p = db.prepare('INSERT OR IGNORE INTO permissions (code, name) VALUES (?, ?)')
    BASE_PERMS.forEach(([c, n]) => p.run(c, n))
    syncEntities(entities)
    db.prepare("INSERT OR IGNORE INTO roles (code, name, builtin) VALUES ('super_admin', '超级管理员', 1)").run()
    const sa = db.prepare("SELECT id FROM roles WHERE code = 'super_admin'").get().id
    db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, perm_code) VALUES (?, '*')").run(sa)
  })()
  return entities
}

export function createApp() {
  const entities = bootstrap()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))
  app.use(parseToken)
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }))

  app.get('/api/health', (_req, res) => res.json({ code: 0, data: { ok: true } }))
  app.use('/api/auth', authRoutes)

  // 上传：登录用户可上传图片，最大 5MB
  fs.mkdirSync(config.uploadDir, { recursive: true })
  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: config.maxUploadMB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new HttpError(400, '只支持 png/jpg/gif/webp 图片'))),
  })
  app.post('/api/upload', requireLogin, upload.single('file'), (req, res) => {
    if (!req.file) throw new HttpError(400, '请选择文件（字段名 file）')
    res.json({ code: 0, data: { url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size } })
  })

  // 管理端
  app.get('/api/admin/meta', requireAdmin, (req, res) => res.json({ code: 0, data: { entities, perms: req.user.perms } }))
  app.get('/api/admin/stats', requireAdmin, (_req, res) => {
    const db = getDb()
    const counts = Object.fromEntries(entities.map((e) => [e.name, db.prepare(`SELECT COUNT(*) c FROM ${e.name}`).get().c]))
    const users = db.prepare("SELECT type, COUNT(*) c FROM users GROUP BY type").all()
    const recent = db.prepare("SELECT substr(created_at,1,10) d, COUNT(*) c FROM users WHERE created_at >= date('now','-6 day') GROUP BY d ORDER BY d").all()
    res.json({ code: 0, data: { counts, users, recent } })
  })
  app.use('/api/admin/system', requireAdmin, systemRoutes)
  for (const e of entities) {
    app.use(`/api/admin/${e.name}`, requireAdmin, adminCrud(e))
    if (e.public) app.use(`/api/${e.name}`, publicCrud(e))
  }

  app.use('/api', (_req, _res, next) => next(new HttpError(404, '接口不存在')))
  // Docker 部署时由后端直接托管前端打包文件
  if (process.env.SERVE_STATIC) {
    const pub = path.join(path.dirname(config.uploadDir), 'public')
    app.use('/admin', express.static(path.join(pub, 'admin')))
    app.use('/', express.static(path.join(pub, 'h5')))
  }
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500)
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `文件不能超过 ${config.maxUploadMB}MB` : status === 500 ? '服务器错误' : err.message
    if (status === 500) console.error(err)
    res.status(status).json({ code: status, msg })
  })
  return app
}
