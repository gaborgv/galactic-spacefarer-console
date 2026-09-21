process.env.CDS_ENV = 'test'
process.env.GALACTIC_LOCKOUT_MAX_ATTEMPTS = '5'
process.env.GALACTIC_RATE_LIMIT_MAX = '1000'

require('@cap-js/cds-test/lib/fixtures/mocha.js')

const cds = require('@sap/cds')
const { GET, POST, PATCH, expect, axios } = cds.test(__dirname + '/../..')

const SVC = '/galactic'
const auth = (email, password) => ({ auth: { username: email, password } })

const PICARD = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
const UHURA = 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
const RETIRED = 'cccccccc-cccc-cccc-cccc-ccccccccccc3'
const WORF = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'

const registerPayload = (overrides = {}) => ({
  name: 'Hikaru Sulu',
  email: 'sulu@planet-x.gal',
  password: 'X',
  stardustCollection: 50,
  originPlanet_code: 'X',
  navigationSkill_level: 4,
  spacesuitColor_code: 'GOLD',
  department_ID: '11111111-1111-1111-1111-111111111102',
  position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
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
        stardustCollection: 1_000_000,
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

  it('rejects batch requests', async () => {
    try {
      await POST(`${SVC}/$batch`, { requests: [] })
      expect.fail('expected 501')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(501)
    }
  })

  it('rejects invalid credentials', async () => {
    try {
      await axios.get(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'wrong'))
      expect.fail('expected 401')
    } catch (err) {
      expect(err.response.status).to.equal(401)
    }
  })
})
