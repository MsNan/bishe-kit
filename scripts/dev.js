// 一条命令同时启动：后端 3000、管理后台 5173、uni-app H5 5174（零依赖，不需要 concurrently）
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
for (const d of ['server', 'admin', 'client']) if (!fs.existsSync(`${d}/node_modules`)) { console.error(`❌ ${d} 还没装依赖，请先运行：npm run setup`); process.exit(1) }
const jobs = [['server', '\x1b[32m', ['--prefix', 'server', 'run', 'dev']], ['admin', '\x1b[36m', ['--prefix', 'admin', 'run', 'dev']], ['client', '\x1b[35m', ['--prefix', 'client', 'run', 'dev:h5']]]
const kids = jobs.map(([name, color, args]) => {
  const p = spawn(npm, args, { shell: process.platform === 'win32', env: process.env })
  const out = (b) => b.toString().split('\n').filter(Boolean).forEach((l) => console.log(`${color}[${name}]\x1b[0m ${l}`))
  p.stdout.on('data', out); p.stderr.on('data', out)
  p.on('exit', (c) => console.log(`${color}[${name}]\x1b[0m 已退出 (${c})`))
  return p
})
console.log('\n  后端   http://localhost:3000/api/health\n  后台   http://localhost:5173  （admin / admin123）\n  用户端 http://localhost:5174  （test / test123）\n')
const stop = () => { kids.forEach((k) => k.kill('SIGTERM')); setTimeout(() => process.exit(0), 300) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
