import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const config = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join(ROOT, 'data', 'app.db'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-请在生产环境修改',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  maxUploadMB: 5,
}
