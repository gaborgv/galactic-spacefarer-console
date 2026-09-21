const cds = require('@sap/cds')
const { SELECT } = cds.ql

const STARDUST_MAX = 999_999

async function assertDepartmentOnPlanet(department_ID, planet_code, tx) {
  const department = await tx.run(
    SELECT.one.from('GalacticService.Departments').where({ ID: department_ID, isDeleted: false })
  )
  if (!department) return 'Invalid department'
  if (department.planet_code !== planet_code) return 'Department does not belong to origin planet'
}

async function assertPositionInDepartment(position_ID, department_ID, tx) {
  const position = await tx.run(
    SELECT.one.from('GalacticService.Positions').where({ ID: position_ID, isDeleted: false })
  )
  if (!position) return 'Invalid position'
  if (position.department_ID !== department_ID) return 'Position does not belong to department'
}

async function assertNavigationSkill(level, tx) {
  if (level == null) return 'Navigation skill level is required'
  const skill = await tx.run(
    SELECT.one.from('GalacticService.NavigationSkillLevels').where({ level, isDeleted: false })
  )
  if (!skill) return 'Invalid navigation skill level'
}

async function assertSpacesuitColor(code, tx) {
  if (!code) return 'Spacesuit color is required'
  const color = await tx.run(
    SELECT.one.from('GalacticService.SpacesuitColors').where({ code, isDeleted: false })
  )
  if (!color) return 'Invalid spacesuit color'
}

function assertStardust(value) {
  if (value == null) return
  if (value < 0 || value > STARDUST_MAX) return `Stardust collection must be between 0 and ${STARDUST_MAX}`
}

async function validateSpacefarerPayload(data, tx) {
  const planet = data.originPlanet_code ?? data.originPlanet?.code
  const department_ID = data.department_ID ?? data.department?.ID
  const position_ID = data.position_ID ?? data.position?.ID
  const navigationSkill_level = data.navigationSkill_level ?? data.navigationSkill?.level
  const spacesuitColor_code = data.spacesuitColor_code ?? data.spacesuitColor?.code

  if (!planet || !department_ID || !position_ID) {
    return 'originPlanet, department and position are required'
  }

  const checks = [
    assertDepartmentOnPlanet(department_ID, planet, tx),
    assertPositionInDepartment(position_ID, department_ID, tx),
    assertNavigationSkill(navigationSkill_level, tx),
    assertSpacesuitColor(spacesuitColor_code, tx),
  ]
  const results = await Promise.all(checks)
  return results.find(Boolean) ?? assertStardust(data.stardustCollection)
}

function extractKeys(req) {
  if (req.data?.ID) return { ID: req.data.ID }
  const where = req.query?.UPDATE?.where
  if (where) {
    const keys = {}
    for (let i = 0; i < where.length; i++) {
      const el = where[i]
      if (el?.ref?.length === 1 && where[i + 1] === '=' && where[i + 2]?.val != null) {
        keys[el.ref[0]] = where[i + 2].val
        i += 2
      }
    }
    if (Object.keys(keys).length) return keys
  }
  return req.params?.find?.(p => p.ID)?.ID ? { ID: req.params.find(p => p.ID).ID } : req.params?.[0] ?? {}
}

async function mergeWithCurrentSpacefarer(req, tx) {
  const keys = extractKeys(req)
  let current
  if (keys.ID) {
    current = await tx.run(SELECT.one.from('GalacticService.SpacefarersAll').where(keys))
  }
  if (!current && req.user?.id) {
    current = await tx.run(SELECT.one.from('GalacticService.SpacefarersAll').where({ email: req.user.id }))
  }
  if (!current) return null

  return {
    ...current,
    ...req.data,
    originPlanet_code: req.data.originPlanet_code ?? current.originPlanet_code,
    department_ID: req.data.department_ID ?? current.department_ID,
    position_ID: req.data.position_ID ?? current.position_ID,
    navigationSkill_level: req.data.navigationSkill_level ?? current.navigationSkill_level,
    spacesuitColor_code: req.data.spacesuitColor_code ?? current.spacesuitColor_code,
    stardustCollection: req.data.stardustCollection ?? current.stardustCollection,
  }
}

async function validateSpacefarerUpdate(req, tx) {
  const merged = await mergeWithCurrentSpacefarer(req, tx)
  if (!merged) return 'Spacefarer not found'
  return validateSpacefarerPayload(merged, tx)
}

module.exports = {
  STARDUST_MAX,
  validateSpacefarerPayload,
  validateSpacefarerUpdate,
  assertDepartmentOnPlanet,
  assertPositionInDepartment,
  assertNavigationSkill,
  assertSpacesuitColor,
  assertStardust,
}
