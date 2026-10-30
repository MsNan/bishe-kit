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
  // 登录限流：同一 IP 对同一账号连续输错 LOGIN_MAX_FAILS 次锁 LOGIN_LOCK_MINUTES 分钟；设为 0 关闭
  loginMaxFails: Number(process.env.LOGIN_MAX_FAILS ?? 5),
  loginMaxIpFails: Number(process.env.LOGIN_MAX_IP_FAILS ?? 20),
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES ?? 15),
  // 部署在 Nginx 等反向代理后面时设为 1（信任一层代理），否则拿到的 IP 都是代理的
  trustProxy: process.env.TRUST_PROXY,
}
