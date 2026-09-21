const cds = require('@sap/cds')
const { UPDATE } = cds.ql

function maxAttempts() {
  const n = parseInt(process.env.GALACTIC_LOCKOUT_MAX_ATTEMPTS ?? '5', 10)
  return Number.isFinite(n) && n > 0 ? n : 5
}

function lockoutDurationMs() {
  const minutes = parseInt(process.env.GALACTIC_LOCKOUT_DURATION_MINUTES ?? '15', 10)
  const ms = (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60 * 1000
  return ms
}

function isLocked(spacefarer) {
  if (!spacefarer?.lockedUntil) return false
  return new Date(spacefarer.lockedUntil).getTime() > Date.now()
}

async function recordFailedLogin(spacefarer) {
  const attempts = (spacefarer.failedLoginAttempts ?? 0) + 1
  const patch = { failedLoginAttempts: attempts }
  if (attempts >= maxAttempts()) {
    patch.lockedUntil = new Date(Date.now() + lockoutDurationMs()).toISOString()
  }
  await cds.run(UPDATE('galactic.Spacefarers').set(patch).where({ ID: spacefarer.ID }))
  return patch
}

async function resetLoginAttempts(spacefarer) {
  if (!spacefarer.failedLoginAttempts && !spacefarer.lockedUntil) return
  await cds.run(
    UPDATE('galactic.Spacefarers')
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where({ ID: spacefarer.ID })
  )
}

module.exports = { maxAttempts, lockoutDurationMs, isLocked, recordFailedLogin, resetLoginAttempts }
