process.env.CDS_ENV = 'test'

require('@cap-js/cds-test/lib/fixtures/mocha.js')

const cds = require('@sap/cds')
const { GET, POST, PATCH, expect, axios } = cds.test(__dirname + '/../..')

const SVC = '/galactic'
const auth = (email, password) => ({ auth: { username: email, password } })

describe('GalacticService', () => {
  it('rejects unauthenticated spacefarer list', async () => {
    try {
      await GET `${SVC}/Spacefarers`
      expect.fail('expected 401')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(401)
    }
  })

  it('allows public read of planets for registration', async () => {
    const { status, data } = await GET `${SVC}/Planets`
    expect(status).to.equal(200)
    expect(data.value.length).to.be.at.least(2)
  })

  it('lists only same-planet spacefarers when authenticated', async () => {
    const { status, data } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(status).to.equal(200)
    expect(data.value).to.have.length(2)
    expect(data.value.every(s => s.originPlanet_code === 'X')).to.equal(true)
  })

  it('isolates planets between authenticated spacefarers', async () => {
    const { data } = await GET(`${SVC}/Spacefarers`, auth('worf@planet-y.gal', 'Y'))
    expect(data.value).to.have.length(3)
    expect(data.value.every(s => s.originPlanet_code === 'Y')).to.equal(true)
  })

  it('does not expose passwordHash in responses', async () => {
    const { data } = await GET(`${SVC}/Spacefarers`, auth('picard@planet-x.gal', 'X'))
    expect(data.value[0]).to.not.have.property('passwordHash')
    expect(data.value[0]).to.not.have.property('password')
  })

  it('allows a spacefarer to update their own profile', async () => {
    const { status, data } = await PATCH(`${SVC}/Spacefarers(cccccccc-cccc-cccc-cccc-ccccccccccc1)`, {
      stardustCollection: 125,
    }, auth('picard@planet-x.gal', 'X'))
    expect(status).to.equal(200)
    expect(data.stardustCollection).to.equal(125)
  })

  it('forbids updating another spacefarer on the same planet', async () => {
    try {
      await PATCH(`${SVC}/Spacefarers(cccccccc-cccc-cccc-cccc-ccccccccccc2)`, {
        stardustCollection: 1,
      }, auth('picard@planet-x.gal', 'X'))
      expect.fail('expected 403')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(403)
    }
  })

  it('registers a new spacefarer without authentication', async () => {
    const { status, data } = await POST(`${SVC}/Spacefarers`, {
      name: 'Hikaru Sulu',
      email: 'sulu@planet-x.gal',
      password: 'X',
      stardustCollection: 50,
      originPlanet_code: 'X',
      navigationSkill_level: 4,
      spacesuitColor_code: 'GOLD',
      department_ID: '11111111-1111-1111-1111-111111111102',
      position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    })
    expect(status).to.equal(201)
    expect(data.email).to.equal('sulu@planet-x.gal')
    expect(data).to.not.have.property('passwordHash')

    const login = await GET(`${SVC}/Spacefarers`, auth('sulu@planet-x.gal', 'X'))
    expect(login.data.value.some(s => s.email === 'sulu@planet-x.gal')).to.equal(true)
  })

  it('rejects registration with cross-planet department', async () => {
    try {
      await POST(`${SVC}/Spacefarers`, {
        name: 'Bad Assign',
        email: 'bad@planet-x.gal',
        password: 'X',
        originPlanet_code: 'X',
        navigationSkill_level: 1,
        spacesuitColor_code: 'SILVER',
        department_ID: '22222222-2222-2222-2222-222222222201',
        position_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      })
      expect.fail('expected 400')
    } catch (err) {
      expect(err.response?.status ?? err.status).to.equal(400)
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
