const cds = require('@sap/cds')
const { INSERT, SELECT, UPDATE } = cds.ql
const { hashPassword, verifyPassword } = require('./lib/password')
const { validateSpacefarerUpdate } = require('./lib/validators')
const { validateAndPrepareNewSpacefarer, verifyOnboardingPersisted } = require('./lib/onboarding')
const { sendWelcomeEmail } = require('./lib/mail')

const SECRET_FIELDS = ['password', 'passwordHash', 'failedLoginAttempts', 'lockedUntil']
const LOG = cds.log('onboarding')
const DB_SPACEFARERS = 'galactic.Spacefarers'

function stripSecrets(row) {
  if (!row) return row
  if (Array.isArray(row)) return row.map(stripSecrets)
  for (const f of SECRET_FIELDS) delete row[f]
  return row
}

function isDuplicateEmailError(err) {
  const msg = String(err?.message ?? err)
  return err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed.*email/i.test(msg)
}

async function readGalacticSpacefarer(where) {
  return cds.run(SELECT.one.from(DB_SPACEFARERS).where(where))
}

async function createSpacefarerViaService(srv, Spacefarers, entry, tx) {
  const createReq = new cds.Request({
    query: INSERT.into(Spacefarers).entries(entry),
    tx,
  })
  createReq.user = cds.User.privileged
  return srv.dispatch(createReq)
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

  this.before('CREATE', Spacefarers, async req => {
    delete req.data.password
    const err = await validateAndPrepareNewSpacefarer(req.data, req.tx)
    if (err) return req.reject(400, err)
  })

  this.after('CREATE', Spacefarers, async (results, req) => {
    const row = Array.isArray(results) ? results[0] : results
    if (!row?.ID) {
      LOG.warn('Onboarding: missing create result')
      return
    }

    const prepared = {
      stardustCollection: req.data.stardustCollection,
      navigationSkill_level: req.data.navigationSkill_level,
    }

    const stored = await readGalacticSpacefarer({ ID: row.ID })
    if (!stored) {
      LOG.warn('Onboarding: spacefarer not found after create', { ID: row.ID })
      return
    }

    if (!verifyOnboardingPersisted(stored, prepared)) {
      LOG.warn('Onboarding: persisted values differ from prepared values', {
        prepared,
        stored: {
          stardustCollection: stored.stardustCollection,
          navigationSkill_level: stored.navigationSkill_level,
        },
      })
    }

    try {
      await sendWelcomeEmail(stripSecrets({ ...stored }))
    } catch (err) {
      LOG.warn('Welcome email failed; create kept', { email: stored.email, error: err.message })
    }
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

    const existing = await readGalacticSpacefarer({ email: data.email })
    if (existing) return req.reject(409, 'Email is already registered')

    const ID = cds.utils.uuid()
    try {
      await createSpacefarerViaService(this, Spacefarers, {
        ID,
        name: data.name,
        email: data.email,
        passwordHash: hashPassword(data.password),
        stardustCollection: data.stardustCollection ?? 0,
        originPlanet_code: data.originPlanet_code,
        navigationSkill_level: data.navigationSkill_level,
        spacesuitColor_code: data.spacesuitColor_code,
        department_ID: data.department_ID,
        position_ID: data.position_ID,
      }, req.tx)
    } catch (err) {
      if (isDuplicateEmailError(err)) return req.reject(409, 'Email is already registered')
      throw err
    }

    const created = await readGalacticSpacefarer({ ID })
    return stripSecrets(created)
  })

  this.on('resetPassword', async req => {
    const { email, originPlanet_code } = req.data
    if (!email || !originPlanet_code) return req.reject(400, 'Email and origin planet are required')

    const row = await readGalacticSpacefarer({ email, originPlanet_code, isDeleted: false })
    if (!row) return req.reject(404, 'Spacefarer not found')

    await cds.run(
      UPDATE(DB_SPACEFARERS)
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
      SELECT.one.from(DB_SPACEFARERS)
        .columns('ID', 'passwordHash')
        .where({ email: req.user.id, isDeleted: false })
    )
    if (!row) return req.reject(404, 'Spacefarer not found')

    const { oldPassword, newPassword } = req.data
    if (!oldPassword || !newPassword) return req.reject(400, 'Old and new password are required')
    if (!verifyPassword(oldPassword, row.passwordHash)) return req.reject(400, 'Current password is incorrect')

    await cds.run(
      UPDATE(DB_SPACEFARERS)
        .set({ passwordHash: hashPassword(newPassword), failedLoginAttempts: 0, lockedUntil: null })
        .where({ ID: row.ID })
    )
    return { success: true }
  })
})
