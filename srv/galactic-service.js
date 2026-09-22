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

const DB_COLOR_TEXTS = 'galactic.SpacesuitColorTexts'
const DB_DEPT_TEXTS = 'galactic.DepartmentTexts'
const DB_POSITION_TEXTS = 'galactic.PositionTexts'
const DB_SKILL_TEXTS = 'galactic.NavigationSkillLevelTexts'
const DB_PLANETS = 'galactic.Planets'
const VIRTUAL_DISPLAY_FIELDS = [
  'spacesuitColorName',
  'departmentName',
  'positionName',
  'navigationSkillLabel',
  'originPlanetName',
]
const SUPPORTED_LOCALES = new Set(['en', 'de'])

function localeFromRequest(req) {
  const raw = req?.locale ?? req?.headers?.['accept-language'] ?? 'en'
  const locale = String(raw).split(/[,;-]/)[0].trim().toLowerCase() || 'en'
  return SUPPORTED_LOCALES.has(locale) ? locale : 'en'
}

function columnName(col) {
  if (typeof col === 'string') return col
  if (col.as) return col.as
  if (col.ref) return col.ref[col.ref.length - 1]
  return null
}

function localizedText(map, key, locale, fallback) {
  const entry = map.get(key)
  return entry?.[locale] ?? entry?.en ?? fallback
}

async function loadLocalizedMap(table, keyCol, valueCol, keys) {
  if (!keys.length) return new Map()
  const texts = await cds.run(
    SELECT.from(table).columns(keyCol, 'locale', valueCol).where({ [keyCol]: keys })
  )
  const map = new Map()
  for (const t of texts) {
    const key = t[keyCol]
    const entry = map.get(key) ?? {}
    entry[t.locale] = t[valueCol]
    map.set(key, entry)
  }
  return map
}

async function enrichDisplayTexts(rows, locale) {
  if (!rows.length) return

  const colorCodes = [...new Set(rows.map(r => r.spacesuitColor_code ?? r.spacesuitColor?.code).filter(Boolean))]
  const deptIds = [...new Set(rows.map(r => r.department_ID ?? r.department?.ID).filter(Boolean))]
  const positionIds = [...new Set(rows.map(r => r.position_ID ?? r.position?.ID).filter(Boolean))]
  const skillLevels = [...new Set(rows.map(r => r.navigationSkill_level ?? r.navigationSkill?.level).filter(Boolean))]
  const planetCodes = [...new Set(rows.map(r => r.originPlanet_code ?? r.originPlanet?.code).filter(Boolean))]

  const [colorMap, deptMap, positionMap, skillMap, planets] = await Promise.all([
    loadLocalizedMap(DB_COLOR_TEXTS, 'color_code', 'name', colorCodes),
    loadLocalizedMap(DB_DEPT_TEXTS, 'department_ID', 'name', deptIds),
    loadLocalizedMap(DB_POSITION_TEXTS, 'position_ID', 'title', positionIds),
    loadLocalizedMap(DB_SKILL_TEXTS, 'skillLevel_level', 'label', skillLevels),
    planetCodes.length
      ? cds.run(SELECT.from(DB_PLANETS).columns('code', 'name').where({ code: planetCodes }))
      : [],
  ])

  const planetMap = new Map(planets.map(p => [p.code, p.name]))

  for (const row of rows) {
    const colorCode = row.spacesuitColor_code ?? row.spacesuitColor?.code
    row.spacesuitColorName = localizedText(colorMap, colorCode, locale, colorCode)
    row.departmentName = localizedText(deptMap, row.department_ID ?? row.department?.ID, locale, row.department_ID)
    row.positionName = localizedText(positionMap, row.position_ID ?? row.position?.ID, locale, row.position_ID)
    row.navigationSkillLabel = localizedText(
      skillMap,
      row.navigationSkill_level ?? row.navigationSkill?.level,
      locale,
      String(row.navigationSkill_level ?? '')
    )
    const planetCode = row.originPlanet_code ?? row.originPlanet?.code
    row.originPlanetName = planetMap.get(planetCode) ?? planetCode
  }
}

function rejectSecretSelect(req) {
  const cols = req.query?.SELECT?.columns
  if (!cols) return
  const names = cols.flatMap(c => {
    const name = columnName(c)
    return name ? [name] : []
  })
  if (names.some(n => SECRET_FIELDS.includes(n))) {
    req.reject(400, 'Requested field is not readable')
  }
}

function stripVirtualSelect(req) {
  const cols = req.query?.SELECT?.columns
  if (!cols) return
  const filtered = cols.filter(c => !VIRTUAL_DISPLAY_FIELDS.includes(columnName(c)))
  if (filtered.length !== cols.length) {
    req.query.SELECT.columns = filtered.length ? filtered : undefined
    req._enrichDisplayTexts = true
  }
}

function filterOptionsByLocale(req) {
  req.query.where({ locale: localeFromRequest(req) })
}

module.exports = cds.service.impl(function () {
  const {
    Spacefarers,
    SpacefarersAll,
    SpacesuitColorOptions,
    NavigationSkillChoices,
  } = this.entities

  this.before('READ', Spacefarers, req => {
    rejectSecretSelect(req)
    stripVirtualSelect(req)
  })
  this.before('READ', SpacefarersAll, rejectSecretSelect)

  this.before('READ', SpacesuitColorOptions, filterOptionsByLocale)
  this.before('READ', NavigationSkillChoices, filterOptionsByLocale)

  this.after('READ', Spacefarers, async (results, req) => {
    const rows = Array.isArray(results) ? results : results ? [results] : []
    rows.forEach(stripSecrets)
    if (req._enrichDisplayTexts || rows.length) {
      await enrichDisplayTexts(rows, localeFromRequest(req))
    }
  })

  this.after('READ', SpacefarersAll, results => {
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

  this.on('whoAmI', req => ({
    email: req.user.id,
    planet: req.user.attr?.planet ?? req.user.planet,
  }))

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
