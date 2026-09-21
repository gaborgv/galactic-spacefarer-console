const cds = require('@sap/cds')
const { INSERT, SELECT, UPDATE } = cds.ql
const { hashPassword, verifyPassword } = require('./lib/password')
const { validateSpacefarerPayload, validateSpacefarerUpdate } = require('./lib/validators')

const SECRET_FIELDS = ['password', 'passwordHash', 'failedLoginAttempts', 'lockedUntil']

function stripSecrets(row) {
  if (!row) return row
  if (Array.isArray(row)) return row.map(stripSecrets)
  for (const f of SECRET_FIELDS) delete row[f]
  return row
}

function rejectSecretSelect(req) {
  const cols = req.query?.SELECT?.columns
  if (!cols) return
  const names = cols.flatMap(c => {
    if (typeof c === 'string') return [c]
    if (c.ref) return [c.ref[c.ref.length - 1]]
    if (c.as) return [c.as]
    return []
  })
  if (names.some(n => SECRET_FIELDS.includes(n))) {
    req.reject(400, 'Requested field is not readable')
  }
}

module.exports = cds.service.impl(function () {
  const { Spacefarers, SpacefarersAll } = this.entities

  this.before('READ', [Spacefarers, SpacefarersAll], rejectSecretSelect)

  this.after('READ', [Spacefarers, SpacefarersAll], results => {
    if (Array.isArray(results)) results.forEach(stripSecrets)
    else stripSecrets(results)
  })

  this.before('UPDATE', Spacefarers, async req => {
    for (const f of ['passwordHash', 'password', 'failedLoginAttempts', 'lockedUntil', 'email', 'originPlanet', 'originPlanet_code']) {
      delete req.data[f]
    }

    if (req.data.isDeleted === true) {
      const keyNames = new Set(Object.keys(req.target?.keys ?? {}))
      const other = Object.keys(req.data).filter(k => k !== 'isDeleted' && !keyNames.has(k))
      if (other.length > 0) {
        return req.reject(400, 'Soft-delete must not be combined with other profile changes')
      }
      return
    }
    delete req.data.isDeleted

    const err = await validateSpacefarerUpdate(req, req.tx)
    if (err) return req.reject(400, err)
  })

  this.on('registerSpacefarer', async req => {
    const data = { ...req.data }
    if (!data.password) return req.reject(400, 'Password is required')

    const existing = await cds.run(SELECT.one.from('galactic.Spacefarers').where({ email: data.email }))
    if (existing) return req.reject(409, 'Email is already registered')

    const err = await validateSpacefarerPayload(data, req.tx)
    if (err) return req.reject(400, err)

    const entry = {
      ID: cds.utils.uuid(),
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      stardustCollection: data.stardustCollection ?? 0,
      originPlanet_code: data.originPlanet_code,
      navigationSkill_level: data.navigationSkill_level,
      spacesuitColor_code: data.spacesuitColor_code,
      department_ID: data.department_ID,
      position_ID: data.position_ID,
      failedLoginAttempts: 0,
    }

    await cds.run(INSERT.into('galactic.Spacefarers').entries(entry))
    const created = await req.tx.run(SELECT.one.from(Spacefarers).where({ ID: entry.ID }))
    return stripSecrets(created ?? entry)
  })

  this.on('resetPassword', async req => {
    const { email, originPlanet_code } = req.data
    if (!email || !originPlanet_code) return req.reject(400, 'Email and origin planet are required')

    const row = await cds.run(
      SELECT.one.from('galactic.Spacefarers').where({ email, originPlanet_code, isDeleted: false })
    )
    if (!row) return req.reject(404, 'Spacefarer not found')

    await cds.run(
      UPDATE('galactic.Spacefarers')
        .set({
          passwordHash: hashPassword(originPlanet_code),
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
        .where({ ID: row.ID })
    )
    return { success: true }
  })

  this.on('changeMyPassword', async req => {
    const row = await cds.run(
      SELECT.one.from('galactic.Spacefarers').where({ email: req.user.id, isDeleted: false })
    )
    if (!row) return req.reject(404, 'Spacefarer not found')

    const { oldPassword, newPassword } = req.data
    if (!oldPassword || !newPassword) return req.reject(400, 'Old and new password are required')
    if (!verifyPassword(oldPassword, row.passwordHash)) return req.reject(400, 'Current password is incorrect')

    await cds.run(
      UPDATE('galactic.Spacefarers')
        .set({ passwordHash: hashPassword(newPassword), failedLoginAttempts: 0, lockedUntil: null })
        .where({ ID: row.ID })
    )
    return { success: true }
  })
})
