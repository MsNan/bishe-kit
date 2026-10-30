/**
 * 登录失败限流（内存版，单进程够用；多实例部署请换成 Redis 等共享存储）
 * - 同一 IP + 同一账号：windowMs 内失败 maxFails 次 → 锁 lockMs
 * - 同一 IP 不论账号：windowMs 内失败 maxIpFails 次 → 锁 lockMs（防撞库）
 * 只按「IP+账号」锁，而不是只按账号锁：否则别人故意输错就能把你的号锁住。
 */
export function createLoginLimiter({ maxFails = 5, maxIpFails = 20, windowMs = 15 * 60_000, lockMs = 15 * 60_000, now = Date.now } = {}) {
  const map = new Map() // key -> { count, first, lockedUntil }
  const keys = (ip, username) => [`u|${ip}|${String(username).toLowerCase()}`, `ip|${ip}`]

  function prune() {
    const t = now()
    for (const [k, v] of map) if (v.lockedUntil <= t && t - v.first > windowMs) map.delete(k)
  }
  function bump(key, limit) {
    if (!limit) return
    const t = now()
    let v = map.get(key)
    // 锁已到期，或没锁但窗口已过 → 重新计数
    if (!v || (v.lockedUntil ? v.lockedUntil <= t : t - v.first > windowMs)) v = { count: 0, first: t, lockedUntil: 0 }
    v.count += 1
    if (v.count >= limit) v.lockedUntil = t + lockMs
    map.set(key, v)
  }

  return {
    /** 还要等多少秒；0 表示可以尝试 */
    retryAfter(ip, username) {
      if (!maxFails) return 0
      const t = now()
      const until = Math.max(0, ...keys(ip, username).map((k) => map.get(k)?.lockedUntil || 0))
      return until > t ? Math.ceil((until - t) / 1000) : 0
    },
    fail(ip, username) {
      if (!maxFails) return
      const [u, i] = keys(ip, username)
      bump(u, maxFails); bump(i, maxIpFails)
      if (map.size > 10_000) prune()
    },
    /** 登录成功只清这个账号的计数，IP 计数保留（撞库时偶尔撞中一个不该清零） */
    success(ip, username) { map.delete(keys(ip, username)[0]) },
    prune,
    size: () => map.size,
  }
}
