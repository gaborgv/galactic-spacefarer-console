const cds = require('@sap/cds')
const { hashPassword } = require('./lib/password')
const { validateSpacefarerAssignment } = require('./lib/validators')

function passwordFromRequest(req) {
  const httpReq = req.http?.req ?? req._?.req
  if (httpReq?._raw) {
    try {
      const body = JSON.parse(httpReq._raw)
      if (body.password) return body.password
    } catch { /* ignore malformed body */ }
  }
  return req.data.password ?? httpReq?.body?.password
}

function stripSecrets(row) {
  if (!row) return row
  if (Array.isArray(row)) return row.map(stripSecrets)
  delete row.password
  delete row.passwordHash
  return row
}

module.exports = cds.service.impl(function () {
  const { Spacefarers } = this.entities

  this.before(['CREATE', 'UPDATE'], Spacefarers, async req => {
    if (req.event === 'UPDATE') {
      delete req.data.passwordHash
      delete req.data.password
      delete req.data.email
      delete req.data.originPlanet
      delete req.data.originPlanet_code
      return
    }

    const password = passwordFromRequest(req)
    if (!password) return req.reject(400, 'Password is required')
    req.data.passwordHash = hashPassword(password)
    delete req.data.password

    const err = await validateSpacefarerAssignment(req.data, req.tx)
    if (err) return req.reject(400, err)
  })

  this.on('CREATE', Spacefarers, async (req, next) => {
    const result = await next()
    if (req.user._is_anonymous) req._.readAfterWrite = false
    return stripSecrets(result ?? { ...req.data })
  })

  this.after('READ', Spacefarers, results => {
    if (Array.isArray(results)) results.forEach(stripSecrets)
    else stripSecrets(results)
  })
})
