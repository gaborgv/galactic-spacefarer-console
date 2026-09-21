const DEFAULT_STARDUST_MAX = 999_999

function getStardustMax() {
  const n = parseInt(process.env.GALACTIC_STARDUST_MAX ?? String(DEFAULT_STARDUST_MAX), 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_STARDUST_MAX
  return n
}

module.exports = {
  DEFAULT_STARDUST_MAX,
  getStardustMax,
}
