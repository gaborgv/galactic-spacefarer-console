const buckets = new Map()

function windowMs() {
  const n = parseInt(process.env.GALACTIC_RATE_LIMIT_WINDOW_MS ?? '60000', 10)
  return Number.isFinite(n) && n > 0 ? n : 60000
}

function maxRequests() {
  const n = parseInt(process.env.GALACTIC_RATE_LIMIT_MAX ?? '2000', 10)
  return Number.isFinite(n) && n > 0 ? n : 2000
}

function maxAuthFailures() {
  const n = parseInt(process.env.GALACTIC_AUTH_FAIL_LIMIT ?? '500', 10)
  return Number.isFinite(n) && n > 0 ? n : 500
}

function clientKey(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
}

function check(key, { window = windowMs(), max = maxRequests() } = {}) {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now - bucket.start >= window) {
    bucket = { start: now, count: 0 }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.start + window - now) / 1000)
    return { limited: true, retryAfter: Math.max(retryAfter, 1) }
  }
  return { limited: false }
}

function middleware({ label = 'request' } = {}) {
  return (req, res, next) => {
    const result = check(`${label}:${clientKey(req)}`)
    if (result.limited) {
      res.set('Retry-After', String(result.retryAfter))
      return res.status(429).json({
        error: {
          code: '429',
          message: 'Too many requests. Try again later.',
          numericSeverity: 4,
        },
      })
    }
    next()
  }
}

function reset(key) {
  buckets.delete(key)
}

module.exports = { check, middleware, clientKey, windowMs, maxRequests, maxAuthFailures, reset }
