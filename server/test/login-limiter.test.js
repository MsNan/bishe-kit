import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLoginLimiter } from '../src/login-limiter.js'

const setup = (opts = {}) => {
  let t = 1_000_000
  const lim = createLoginLimiter({ maxFails: 3, maxIpFails: 5, windowMs: 60_000, lockMs: 120_000, now: () => t, ...opts })
  return { lim, tick: (ms) => { t += ms } }
}

test('连续失败达到上限后锁定，到期自动解锁', () => {
  const { lim, tick } = setup()
  for (let i = 0; i < 3; i++) { assert.equal(lim.retryAfter('1.1.1.1', 'admin'), 0); lim.fail('1.1.1.1', 'admin') }
  assert.equal(lim.retryAfter('1.1.1.1', 'admin'), 120)
  assert.equal(lim.retryAfter('1.1.1.1', 'ADMIN'), 120, '用户名不区分大小写')
  assert.equal(lim.retryAfter('2.2.2.2', 'admin'), 0, '别的 IP 不受影响（防止被人恶意锁号）')
  tick(119_000); assert.equal(lim.retryAfter('1.1.1.1', 'admin'), 1)
  tick(1_000); assert.equal(lim.retryAfter('1.1.1.1', 'admin'), 0)
  lim.fail('1.1.1.1', 'admin')
  assert.equal(lim.retryAfter('1.1.1.1', 'admin'), 0, '解锁后重新计数')
})

test('超过时间窗口的失败不累计；登录成功清零', () => {
  const { lim, tick } = setup()
  lim.fail('ip', 'u'); lim.fail('ip', 'u'); tick(61_000); lim.fail('ip', 'u')
  assert.equal(lim.retryAfter('ip', 'u'), 0)
  lim.fail('ip', 'u'); lim.success('ip', 'u'); lim.fail('ip', 'u'); lim.fail('ip', 'u')
  assert.equal(lim.retryAfter('ip', 'u'), 0)
})

test('同一 IP 换着账号试（撞库）也会被锁', () => {
  const { lim } = setup()
  for (let i = 0; i < 5; i++) lim.fail('9.9.9.9', `user${i}`)
  assert.equal(lim.retryAfter('9.9.9.9', 'someone-else'), 120)
  lim.success('9.9.9.9', 'user0')
  assert.equal(lim.retryAfter('9.9.9.9', 'someone-else'), 120, '某个账号登录成功不清 IP 计数')
})

test('maxFails 为 0 时关闭限流；过期记录会被清理', () => {
  const off = setup({ maxFails: 0 }).lim
  for (let i = 0; i < 50; i++) off.fail('ip', 'u')
  assert.equal(off.retryAfter('ip', 'u'), 0)
  const { lim, tick } = setup()
  for (let i = 0; i < 100; i++) lim.fail(`10.0.0.${i}`, 'u')
  assert.ok(lim.size() > 0)
  tick(10 * 60_000); lim.prune()
  assert.equal(lim.size(), 0)
})
