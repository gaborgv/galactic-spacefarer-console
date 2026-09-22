const cache = new Map()

function ttlMs() {
  const n = parseInt(process.env.GALACTIC_AUTH_CACHE_TTL_MS ?? '600000', 10)
  return Number.isFinite(n) && n > 0 ? n : 600000
}

function get(authHeader) {
  if (!authHeader) return null
  const entry = cache.get(authHeader)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(authHeader)
    return null
  }
  return entry.user
}

function set(authHeader, user) {
  if (!authHeader || !user) return
  cache.set(authHeader, { user, expires: Date.now() + ttlMs() })
}

function clear() {
  cache.clear()
}

function remove(authHeader) {
  if (authHeader) cache.delete(authHeader)
}

module.exports = { get, set, clear, remove, ttlMs }
