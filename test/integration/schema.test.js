process.env.CDS_ENV = 'test'

require('@cap-js/cds-test/lib/fixtures/mocha.js')

const cds = require('@sap/cds')
const { INSERT, SELECT } = cds.ql
const { expect } = require('@cap-js/cds-test/lib/chai')
const { resetTestDb } = require('../helper/db')
const { verifyPassword } = require('../../srv/lib/password')

describe('galactic schema', () => {
  before(async () => {
    await resetTestDb()
  })

  after(async () => {
    await cds.disconnect()
  })

  it('loads rigged fixtures from test/data', async () => {
    expect(await SELECT.from('galactic.Spacefarers')).to.have.length(5)
    expect(await SELECT.from('galactic.Departments')).to.have.length(5)
  })

  it('allows same department code on different planets', async () => {
    const eng = await SELECT.from('galactic.Departments').where({ code: 'ENG' })
    expect(eng).to.have.length(2)
    expect(eng.map(d => d.planet_code).sort()).to.deep.equal(['X', 'Y'])
  })

  it('defaults isDeleted to false', async () => {
    expect((await SELECT.one.from('galactic.Spacefarers').where({ email: 'picard@planet-x.gal' })).isDeleted).to.equal(false)
    expect((await SELECT.one.from('galactic.Planets').where({ code: 'X' })).isDeleted).to.equal(false)
    expect((await SELECT.one.from('galactic.NavigationSkillLevels').where({ level: 7 })).isDeleted).to.equal(false)
    expect((await SELECT.one.from('galactic.SpacesuitColors').where({ code: 'SILVER' })).isDeleted).to.equal(false)
  })

  it('creates DB unique constraint on email', async () => {
    try {
      await INSERT.into('galactic.Spacefarers').entries({
        ID: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
        name: 'Duplicate Picard',
        email: 'picard@planet-x.gal',
        stardustCollection: 1,
        originPlanet_code: 'X',
        navigationSkill_level: 1,
        spacesuitColor_code: 'SILVER',
        department_ID: '11111111-1111-1111-1111-111111111101',
        position_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      })
      expect.fail('expected unique constraint violation')
    } catch (err) {
      expect(String(err)).to.match(/unique|constraint/i)
    }
  })

  it('creates DB unique constraint on department planet+code', async () => {
    try {
      await INSERT.into('galactic.Departments').entries({
        ID: '33333333-3333-3333-3333-333333333301',
        code: 'ENG',
        planet_code: 'X',
      })
      expect.fail('expected unique constraint violation')
    } catch (err) {
      expect(String(err)).to.match(/unique|constraint/i)
    }
  })

  it('creates DB unique constraint on position code within department', async () => {
    try {
      await INSERT.into('galactic.Positions').entries({
        ID: 'cccccccc-cccc-cccc-cccc-ccccccccccc9',
        code: 'PROPULSION',
        department_ID: '11111111-1111-1111-1111-111111111101',
      })
      expect.fail('expected unique constraint violation')
    } catch (err) {
      expect(String(err)).to.match(/unique|constraint/i)
    }
  })

  it('stores bcrypt password hashes on spacefarers', async () => {
    const picard = await SELECT.one.from('galactic.Spacefarers').where({ email: 'picard@planet-x.gal' })
    const worf = await SELECT.one.from('galactic.Spacefarers').where({ email: 'worf@planet-y.gal' })
    expect(verifyPassword('X', picard.passwordHash)).to.equal(true)
    expect(verifyPassword('Y', worf.passwordHash)).to.equal(true)
    expect(verifyPassword('Y', picard.passwordHash)).to.equal(false)
  })

  it('stores en/de translations in texts tables', async () => {
    const dept = await SELECT.one.from('galactic.DepartmentTexts').where({
      department_ID: '11111111-1111-1111-1111-111111111101',
      locale: 'de',
    })
    expect(dept.name).to.equal('Orbitaltechnik')

    const pos = await SELECT.one.from('galactic.PositionTexts').where({
      position_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      locale: 'de',
    })
    expect(pos.title).to.equal('Wurmloch-Pilot')

    const skill = await SELECT.one.from('galactic.NavigationSkillLevelTexts').where({
      skillLevel_level: 7,
      locale: 'de',
    })
    expect(skill.label).to.equal('Weitsichtig')

    const color = await SELECT.one.from('galactic.SpacesuitColorTexts').where({
      color_code: 'SILVER',
      locale: 'de',
    })
    expect(color.name).to.equal('Silber')
  })

  it('creates DB unique constraint on planet name', async () => {
    try {
      await INSERT.into('galactic.Planets').entries({ code: 'Z', name: 'Planet X' })
      expect.fail('expected unique constraint violation')
    } catch (err) {
      expect(String(err)).to.match(/unique|constraint/i)
    }
  })

  it('creates filter indexes on spacefarers', async () => {
    const indexes = await cds.db.run(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'galactic_Spacefarers'`
    )
    const names = indexes.map(i => i.name)
    expect(names.some(n => n.includes('originPlanet'))).to.equal(true)
    expect(names.some(n => n.includes('isDeleted'))).to.equal(true)
  })
})
