process.env.CDS_ENV = 'test'
process.env.GALACTIC_LOCKOUT_MAX_ATTEMPTS = '5'
process.env.GALACTIC_RATE_LIMIT_MAX = '1000'

require('@cap-js/cds-test/lib/fixtures/mocha.js')

const cds = require('@sap/cds')
const { GET, POST, PATCH, expect, axios } = cds.test(__dirname + '/../..')
const { getSentMail, clearSentMail, setMailFailNext } = require('../../srv/lib/mail')
const {
  BASE_STARDUST_BONUS,
  ENG_STARDUST_BONUS,
  RECRUIT_SKILL_BOOST,
} = require('../../srv/lib/onboarding')
const { getStardustMax } = require('../../srv/lib/config')

const SVC = '/galactic'
const auth = (email, password) => ({ auth: { username: email, password } })

const PICARD = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
const UHURA = 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
const RETIRED = 'cccccccc-cccc-cccc-cccc-ccccccccccc3'
const WORF = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'

const ENG_DEPT_X = '11111111-1111-1111-1111-111111111101'
const NAV_DEPT_X = '11111111-1111-1111-1111-111111111102'
const ENG_PROPULSION = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
const NAV_ROUTE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'

const registerPayload = (overrides = {}) => ({
  name: 'Hikaru Sulu',
  email: 'sulu@planet-x.gal',
  password: 'X',
  stardustCollection: 50,
  originPlanet_code: 'X',
  navigationSkill_level: 4,
  spacesuitColor_code: 'GOLD',
  department_ID: NAV_DEPT_X,
  position_ID: NAV_ROUTE,
  ...overrides,
})

describe('GalacticService', () => {
  it('rejects unauthenticated spacefarer list', async () => {
    try {
      await axios.get(`${SVC}/Spacefarers`)
      expect.fail('expected 401')
    } catch (err) {
      expect(err.response.status).to.equal(401)
    }
  })

  it('allows public read of active planets and hides soft-deleted departments', async () => {
    const { status, data } = await GET `${SVC}/Planets`
    expect(status).to.equal(200)
    expect(data.value.length).to.be.at.least(2)

    const depts = await GET `${SVC}/Departments`
    expect(depts.data.value.some(d => d.code === 'OLD')).to.equal(false)
  })

  it('lists only active same-planet spacefarers', async () => {
    const { data } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(data.value).to.have.length(2)
    expect(data.value.every(s => s.originPlanet_code === 'X')).to.equal(true)
    expect(data.value.some(s => s.ID === RETIRED)).to.equal(false)
  })

  it('lists all same-planet spacefarers including soft-deleted via SpacefarersAll', async () => {
    const { data } = await GET(`${SVC}/SpacefarersAll`, auth('picard@planet-x.gal', 'X'))
    expect(data.value).to.have.length(3)
    expect(data.value.some(s => s.ID === RETIRED && s.isDeleted === true)).to.equal(true)
  })

  it('forbids cross-planet read by ID (IDOR)', async () => {
    try {
      await GET(`${SVC}/Spacefarers(${WORF})`, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected 403 or 404')
    } catch (err) {
      expect([403, 404]).to.include(err.response?.status ?? err.status)
    }
  })

  it('does not expose passwordHash in responses or $select', async () => {
    const { data } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(data.value[0]).to.not.have.property('passwordHash')

    try {
      await GET(`${SVC}/Spacefarers?$select=email,passwordHash`, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected error for passwordHash select')
    } catch (err) {
      expect([400, 404]).to.include(err.response?.status ?? err.status)
    }
  })

  it('does not leak other planets via $filter', async () => {
    const { data } = await GET(
      `${SVC}/Spacefarers?$filter=email eq 'worf@planet-y.gal'`,
      auth('picard@planet-x.gal', 'X')
    )
    expect(data.value).to.have.length(0)
  })

  it('allows a spacefarer to update their own profile', async () => {
    const { status, data } = await PATCH(`${SVC}/Spacefarers(${PICARD})`, {
      stardustCollection: 125,
    }, auth('picard@planet-x.gal', 'X'))
    expect(status).to.equal(200)
    expect(data.stardustCollection).to.equal(125)
  })

  it('rejects incoherent department/position pair on UPDATE', async () => {
    try {
      await PATCH(`${SVC}/Spacefarers(${PICARD})`, {
        department_ID: '11111111-1111-1111-1111-111111111102',
        position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      }, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }
  })

  it('rejects cross-planet department on UPDATE', async () => {
    try {
      await PATCH(`${SVC}/Spacefarers(${PICARD})`, {
        department_ID: '22222222-2222-2222-2222-222222222201',
        position_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      }, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }
  })

  it('forbids updating another spacefarer on the same planet', async () => {
    try {
      await PATCH(`${SVC}/Spacefarers(${UHURA})`, { stardustCollection: 1 }, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected 403')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(403)
    }
  })

  it('soft-deletes own profile via UPDATE instead of DELETE', async () => {
    const email = 'softdel@planet-x.gal'
    await POST(`${SVC}/registerSpacefarer`, registerPayload({
      name: 'Soft Delete Me',
      email,
      department_ID: '11111111-1111-1111-1111-111111111101',
      position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    }))

    const created = await GET(`${SVC}/Spacefarers`, auth(email, 'X'))
    const id = created.data.value.find(s => s.email === email).ID

    await PATCH(`${SVC}/Spacefarers(${id})`, { isDeleted: true }, auth(email, 'X'))

    const active = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(active.data.value.some(s => s.email === email)).to.equal(false)

    const all = await GET(`${SVC}/SpacefarersAll`, auth('picard@planet-x.gal', 'X'))
    expect(all.data.value.some(s => s.email === email && s.isDeleted === true)).to.equal(true)
  })

  it('registers via registerSpacefarer action', async () => {
    const { status, data } = await POST(`${SVC}/registerSpacefarer`, registerPayload())
    expect(status).to.equal(200)
    expect(data.email).to.equal('sulu@planet-x.gal')
    expect(data.stardustCollection).to.equal(150)
    expect(data.navigationSkill_level).to.equal(5)
    expect(data).to.not.have.property('passwordHash')

    const login = await GET(`${SVC}/Spacefarers`, auth('sulu@planet-x.gal', 'X'))
    expect(login.data.value.some(s => s.email === 'sulu@planet-x.gal')).to.equal(true)
  })

  it('rejects registration with cross-planet department', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'bad@planet-x.gal',
        department_ID: '22222222-2222-2222-2222-222222222201',
        position_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }
  })

  it('rejects duplicate email with 409', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({ email: 'picard@planet-x.gal' }))
      expect.fail('expected 409')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(409)
    }
  })

  it('rejects registration with invalid navigation skill and spacesuit color', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'badskill@planet-x.gal',
        navigationSkill_level: 99,
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }

    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'badcolor@planet-x.gal',
        spacesuitColor_code: 'NOPE',
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }
  })

  it('rejects excessive stardust on registration', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'rich@planet-x.gal',
        stardustCollection: getStardustMax() + 1,
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }
  })

  it('changes password without touching other fields', async () => {
    const before = await GET(`${SVC}/Spacefarers(${PICARD})`, auth('picard@planet-x.gal', 'X'))
    await POST(`${SVC}/changeMyPassword`, {
      oldPassword: 'X',
      newPassword: 'Nova1',
    }, auth('picard@planet-x.gal', 'X'))

    await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'Nova1'))
    await POST(`${SVC}/changeMyPassword`, {
      oldPassword: 'Nova1',
      newPassword: 'X',
    }, auth('picard@planet-x.gal', 'Nova1'))

    const after = await GET(`${SVC}/Spacefarers(${PICARD})`, auth('picard@planet-x.gal', 'X'))
    expect(after.data.stardustCollection).to.equal(before.data.stardustCollection)
  })

  it('resets password to planet code via resetPassword action', async () => {
    const email = 'reset@planet-x.gal'
    await POST(`${SVC}/registerSpacefarer`, registerPayload({ name: 'Reset Target', email }))

    await POST(`${SVC}/changeMyPassword`, {
      oldPassword: 'X',
      newPassword: 'Forgotten',
    }, auth(email, 'X'))

    await POST(`${SVC}/resetPassword`, { email, originPlanet_code: 'X' })
    await GET(`${SVC}/Spacefarers`, auth(email, 'X'))
  })

  it('locks account after repeated failed logins', async () => {
    const email = 'lockout@planet-x.gal'
    await POST(`${SVC}/registerSpacefarer`, registerPayload({
      name: 'Lockout Target',
      email,
      department_ID: '11111111-1111-1111-1111-111111111101',
      position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    }))

    for (let i = 0; i < 5; i++) {
      try {
        await axios.get(`${SVC}/Spacefarers`, auth(email, 'wrong'))
      } catch { /* expected */ }
    }

    try {
      await axios.get(`${SVC}/Spacefarers`, auth(email, 'X'))
      expect.fail('expected 423 locked')
    } catch (err) {
      expect(err.response.status).to.equal(423)
    }
  })

  it('exposes localized spacesuit color options for value help', async () => {
    const { data } = await axios.get(`${SVC}/SpacesuitColorOptions`, auth('picard@planet-x.gal', 'X'))
    const silver = data.value.find(r => r.code === 'SILVER')
    expect(silver.name).to.equal('Silver')
  })

  it('includes spacesuit color name on spacefarer list', async () => {
    const { data } = await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    const picard = data.value.find(r => r.email === 'picard@planet-x.gal')
    expect(picard.spacesuitColorName).to.equal('Silver')
  })

  it('filters spacefarers by exact stardust collection', async () => {
    const { data: all } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    const picard = all.value.find(s => s.email === 'picard@planet-x.gal')
    expect(picard).to.exist

    const { data } = await GET(
      `${SVC}/Spacefarers?$filter=${encodeURIComponent(`stardustCollection eq ${picard.stardustCollection}`)}`,
      auth('picard@planet-x.gal', 'X')
    )
    expect(data.value.some(s => s.email === 'picard@planet-x.gal')).to.equal(true)
  })

  it('rejects invalid credentials', async () => {
    try {
      await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
      expect.fail('expected 401')
    } catch (err) {
      expect(err.response.status).to.equal(401)
    }
  })

  it('returns German spacesuit color labels when Accept-Language is de', async () => {
    const { data } = await axios.get(`${SVC}/SpacesuitColorOptions`, {
      ...auth('picard@planet-x.gal', 'X'),
      headers: { 'Accept-Language': 'de' },
    })
    const silver = data.value.find(r => r.code === 'SILVER')
    expect(silver.name).to.equal('Silber')
  })

  it('serves OData $metadata without authentication', async () => {
    const { status } = await GET(`${SVC}/$metadata`)
    expect(status).to.equal(200)
  })

  it('stubs local LREP flex endpoints for UI5 startup', async () => {
    const { status, data } = await axios.get('/sap/bc/lrep/flex/data/galactic.spacefarers')
    expect(status).to.equal(200)
    expect(data.changes).to.be.an('array')
    expect(data.compVariants).to.be.an('array')
  })

  it('accepts OData $filter with plus-encoded spaces', async () => {
    const { data: all } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    const picard = all.value.find(s => s.email === 'picard@planet-x.gal')
    expect(picard).to.exist

    const filter = `stardustCollection eq ${picard.stardustCollection}`
    const { data } = await GET(
      `${SVC}/Spacefarers?$filter=${filter.replace(/ /g, '+')}`,
      auth('picard@planet-x.gal', 'X')
    )
    expect(data.value.some(s => s.email === 'picard@planet-x.gal')).to.equal(true)
  })
})

describe('GalacticService auth hardening', () => {
  const authCache = require('../../srv/lib/auth-cache')
  const { UPDATE } = cds.ql
  const { resetByPrefix } = require('../../srv/lib/throttle')
  let savedAuthFailLimit
  const picardAuthHeader = `Basic ${Buffer.from('picard@planet-x.gal:X').toString('base64')}`

  before(() => {
    savedAuthFailLimit = process.env.GALACTIC_AUTH_FAIL_LIMIT
    process.env.GALACTIC_AUTH_FAIL_LIMIT = '3'
  })

  after(() => {
    if (savedAuthFailLimit === undefined) delete process.env.GALACTIC_AUTH_FAIL_LIMIT
    else process.env.GALACTIC_AUTH_FAIL_LIMIT = savedAuthFailLimit
  })

  beforeEach(async () => {
    authCache.clear()
    resetByPrefix('auth-fail:')
    await cds.run(
      UPDATE('galactic.Spacefarers')
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where({ email: 'picard@planet-x.gal' })
    )
  })

  it('caches successful basic auth across OData requests', async () => {
    expect(authCache.get(picardAuthHeader)).to.be.null

    await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(authCache.get(picardAuthHeader)?.id).to.equal('picard@planet-x.gal')

    await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(authCache.get(picardAuthHeader)?.id).to.equal('picard@planet-x.gal')
  })

  it('returns 429 after too many failed passwords from the same client', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
        expect.fail('expected 401')
      } catch (err) {
        expect(err.response.status).to.equal(401)
      }
    }

    try {
      await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
      expect.fail('expected 429')
    } catch (err) {
      expect(err.response.status).to.equal(429)
      expect(err.response.data.error.message).to.match(/Too many authentication attempts/)
    }
  })

  it('clears auth-fail throttling after a successful login', async () => {
    for (let i = 0; i < 2; i++) {
      try {
        await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
      } catch (err) {
        expect(err.response.status).to.equal(401)
      }
    }

    await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))

    for (let i = 0; i < 3; i++) {
      try {
        await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
        expect.fail('expected 401')
      } catch (err) {
        expect(err.response.status).to.equal(401)
      }
    }
  })
})

describe('Spacefarer onboarding', () => {
  beforeEach(() => {
    clearSentMail()
    setMailFailNext(false)
  })

  it('applies +100 stardust and +1 skill for non-ENG recruits', async () => {
    const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'nav-bonus@planet-x.gal',
      stardustCollection: 50,
      navigationSkill_level: 3,
    }))

    expect(data.stardustCollection).to.equal(50 + BASE_STARDUST_BONUS)
    expect(data.navigationSkill_level).to.equal(3 + RECRUIT_SKILL_BOOST)

    const mail = getSentMail()
    expect(mail).to.have.length(1)
    expect(mail[0].to).to.equal('nav-bonus@planet-x.gal')
    expect(mail[0].text).to.include(`stardust collection starts at ${50 + BASE_STARDUST_BONUS}`)
    expect(mail[0].text).to.include(`navigation skill is level ${3 + RECRUIT_SKILL_BOOST}`)
  })

  it('applies +300 stardust total for ENG recruits (+100 base +200 ENG)', async () => {
    const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      name: 'Geordi Jr',
      email: 'eng-bonus@planet-x.gal',
      stardustCollection: 10,
      navigationSkill_level: 2,
      department_ID: ENG_DEPT_X,
      position_ID: ENG_PROPULSION,
    }))

    expect(data.stardustCollection).to.equal(10 + ENG_STARDUST_BONUS)
    expect(data.navigationSkill_level).to.equal(3)

    const login = await GET(`${SVC}/Spacefarers`, auth('eng-bonus@planet-x.gal', 'X'))
    const stored = login.data.value.find(s => s.email === 'eng-bonus@planet-x.gal')
    expect(stored.stardustCollection).to.equal(10 + ENG_STARDUST_BONUS)
    expect(stored.navigationSkill_level).to.equal(3)
  })

  it('caps enhanced stardust at GALACTIC_STARDUST_MAX', async () => {
    const max = getStardustMax()
    const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'cap-stardust@planet-x.gal',
      stardustCollection: max - BASE_STARDUST_BONUS + 50,
      navigationSkill_level: 1,
    }))

    expect(data.stardustCollection).to.equal(max)
  })

  it('does not boost navigation skill above level 7', async () => {
    const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'cap-skill@planet-x.gal',
      navigationSkill_level: 7,
    }))

    expect(data.navigationSkill_level).to.equal(7)
  })

  it('rejects invalid email before insert and sends no welcome mail', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'not-an-email',
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }

    expect(getSentMail()).to.have.length(0)
  })

  it('keeps registration when welcome email delivery fails', async () => {
    setMailFailNext(true)

    const { status, data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'mailfail@planet-x.gal',
      stardustCollection: 0,
      navigationSkill_level: 1,
    }))

    expect(status).to.equal(200)
    expect(data.stardustCollection).to.equal(BASE_STARDUST_BONUS)
    expect(getSentMail()).to.have.length(0)

    const login = await GET(`${SVC}/Spacefarers`, auth('mailfail@planet-x.gal', 'X'))
    expect(login.data.value.some(s => s.email === 'mailfail@planet-x.gal')).to.equal(true)
  })

  it('rejects initial stardust above maximum before bonus is applied', async () => {
    try {
      await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'too-rich@planet-x.gal',
        stardustCollection: getStardustMax() + 1,
      }))
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
    }

    expect(getSentMail()).to.have.length(0)
  })

  it('trims bonus when starting stardust is already at cap (no net gain)', async () => {
    const max = getStardustMax()
    const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'max-start@planet-x.gal',
      stardustCollection: max,
      navigationSkill_level: 1,
    }))

    expect(data.stardustCollection).to.equal(max)
  })

  it('sends exactly one welcome email per registration', async () => {
    await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'single-mail@planet-x.gal',
      stardustCollection: 0,
      navigationSkill_level: 1,
    }))

    expect(getSentMail()).to.have.length(1)
  })

  it('rejects duplicate registration with 409 on repeated email', async () => {
    const payload = registerPayload({ email: 'dupe@planet-x.gal' })
    await POST(`${SVC}/registerSpacefarer`, payload)

    try {
      await POST(`${SVC}/registerSpacefarer`, payload)
      expect.fail('expected 409')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(409)
    }

    expect(getSentMail()).to.have.length(1)
  })

  it('rejects racing duplicate registrations for the same email', async () => {
    const payload = registerPayload({ email: 'race@planet-x.gal' })
    const results = await Promise.allSettled([
      POST(`${SVC}/registerSpacefarer`, payload),
      POST(`${SVC}/registerSpacefarer`, payload),
    ])

    const statuses = results.map(r =>
      r.status === 'fulfilled' ? r.value.status : (r.reason.response?.status ?? r.reason.status)
    )
    expect(statuses.filter(s => s === 200)).to.have.length(1)
    expect(statuses.filter(s => s === 409 || s === 500)).to.have.length(1)
    expect(getSentMail()).to.have.length(1)
  })

  it('respects GALACTIC_BONUS_DEPARTMENT_CODES for department extra bonus', async () => {
    const prev = process.env.GALACTIC_BONUS_DEPARTMENT_CODES
    process.env.GALACTIC_BONUS_DEPARTMENT_CODES = 'NAV'
    try {
      const { data } = await POST(`${SVC}/registerSpacefarer`, registerPayload({
        email: 'env-bonus@planet-x.gal',
        stardustCollection: 10,
        navigationSkill_level: 2,
        department_ID: ENG_DEPT_X,
        position_ID: ENG_PROPULSION,
      }))
      expect(data.stardustCollection).to.equal(10 + BASE_STARDUST_BONUS)
    } finally {
      if (prev === undefined) delete process.env.GALACTIC_BONUS_DEPARTMENT_CODES
      else process.env.GALACTIC_BONUS_DEPARTMENT_CODES = prev
    }
  })

  it('welcome email uses values re-read from the database after onboarding', async () => {
    await POST(`${SVC}/registerSpacefarer`, registerPayload({
      email: 'db-read-mail@planet-x.gal',
      stardustCollection: 25,
      navigationSkill_level: 3,
    }))

    const login = await GET(`${SVC}/Spacefarers`, auth('db-read-mail@planet-x.gal', 'X'))
    const stored = login.data.value.find(s => s.email === 'db-read-mail@planet-x.gal')

    const mail = getSentMail()
    expect(mail).to.have.length(1)
    expect(mail[0].text).to.include(`stardust collection starts at ${stored.stardustCollection}`)
    expect(mail[0].text).to.include(`navigation skill is level ${stored.navigationSkill_level}`)
    expect(stored.stardustCollection).to.equal(25 + BASE_STARDUST_BONUS)
  })
})
