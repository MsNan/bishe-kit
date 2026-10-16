import { createApp } from './app.js'
import { config } from './config.js'
import { getDb } from './db.js'
import { seed } from './seed.js'

const app = createApp()
if (!getDb().prepare('SELECT COUNT(*) c FROM users').get().c) seed() // 首次启动自动写入演示数据
app.listen(config.port, () => console.log(`🚀 API 已启动：http://localhost:${config.port}/api/health`))
