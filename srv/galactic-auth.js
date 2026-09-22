const cds = require('@sap/cds')
const { SELECT } = cds.ql
const { verifyPassword } = require('./lib/password')
const { isLocked, recordFailedLogin, resetLoginAttempts, maxAttempts } = require('./lib/lockout')
const { check, reset, clientKey, maxAuthFailures } = require('./lib/throttle')
const authCache = require('./lib/auth-cache')

module.exports = async function galacticAuth(req, res, next) {
  req._login = (status = 401, message) => {
    if (message) res.status(status).json({ error: { code: String(status), message } })
    else res.set('WWW-Authenticate', 'Basic realm="Galactic Spacefarers"').sendStatus(status)
  }

  const auth = req.headers.authorization
  if (!auth?.match(/^basic /i)) {
    const path = `${req.baseUrl ?? ''}${req.path ?? ''}`
    const isPublicRead = req.method === 'GET' &&
      /\/(Planets|Departments|Positions|NavigationSkillLevels|SpacesuitColors|SpacesuitColorOptions|\$metadata)(\/|$|\?)/.test(path)
    const isPublicAction = req.method === 'POST' &&
      /\/(registerSpacefarer|resetPassword)(\/|$|\?)/.test(path)
    if (isPublicRead || isPublicAction) {
      const anonymous = new cds.User({ id: 'anonymous', roles: ['any'] })
      if (cds.context) cds.context.user = anonymous
      req.user = anonymous
    }
    return next()
  }

  const cached = authCache.get(auth)
  if (cached) {
    if (cds.context) cds.context.user = cached
    req.user = cached
    return next()
  }

  const creds = Buffer.from(auth.slice(6), 'base64').toString()
  const sep = creds.indexOf(':')
  if (sep < 0) return req._login()

  const email = creds.slice(0, sep)
  const password = creds.slice(sep + 1)
  if (!email || !password) return req._login()

  const spacefarer = await SELECT.one.from('galactic.Spacefarers').where({ email, isDeleted: false })
  if (!spacefarer) return req._login()

  if (isLocked(spacefarer)) {
    return req._login(423, `Account locked after ${maxAttempts()} failed attempts. Try again later.`)
  }

  if (!verifyPassword(password, spacefarer.passwordHash)) {
    await recordFailedLogin(spacefarer)
    const throttle = check(`auth-fail:${clientKey(req)}`, { max: maxAuthFailures() })
    if (throttle.limited) {
      res.set('Retry-After', String(throttle.retryAfter))
      return req._login(429, 'Too many authentication attempts. Try again later.')
    }
    return req._login()
  }

  await resetLoginAttempts(spacefarer)
  reset(`auth-fail:${clientKey(req)}`)

  const user = new cds.User({
    id: email,
    roles: ['authenticated-user', 'spacefarer'],
    attr: { planet: spacefarer.originPlanet_code, email },
  })

  authCache.set(auth, user)
  if (cds.context) cds.context.user = user
  req.user = user
  next()
}
