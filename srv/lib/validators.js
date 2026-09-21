const cds = require('@sap/cds')
const { SELECT } = cds.ql
const { getStardustMax } = require('./config')

function assertEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'A valid email address is required'
  }
}

async function fetchDepartmentOnPlanet(department_ID, planet_code, tx) {
  const department = await tx.run(
    SELECT.one.from('GalacticService.Departments').where({ ID: department_ID, isDeleted: false })
  )
  if (!department) return { error: 'Invalid department' }
  if (department.planet_code !== planet_code) return { error: 'Department does not belong to origin planet' }
  return { department }
}

async function assertDepartmentOnPlanet(department_ID, planet_code, tx) {
  const result = await fetchDepartmentOnPlanet(department_ID, planet_code, tx)
  return result.error
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
  const max = getStardustMax()
  if (value < 0 || value > max) return `Stardust collection must be between 0 and ${max}`
}

async function validateNewSpacefarerData(data, tx) {
  const emailErr = assertEmail(data.email)
  if (emailErr) return { error: emailErr }

  const planet = data.originPlanet_code ?? data.originPlanet?.code
  const department_ID = data.department_ID ?? data.department?.ID
  const position_ID = data.position_ID ?? data.position?.ID
  const navigationSkill_level = data.navigationSkill_level ?? data.navigationSkill?.level
  const spacesuitColor_code = data.spacesuitColor_code ?? data.spacesuitColor?.code

  if (!planet || !department_ID || !position_ID) {
    return { error: 'originPlanet, department and position are required' }
  }

  const deptResult = await fetchDepartmentOnPlanet(department_ID, planet, tx)
  if (deptResult.error) return { error: deptResult.error }

  const checks = [
    assertPositionInDepartment(position_ID, department_ID, tx),
    assertNavigationSkill(navigationSkill_level, tx),
    assertSpacesuitColor(spacesuitColor_code, tx),
  ]
  const results = await Promise.all(checks)
  const fieldErr = results.find(Boolean)
  if (fieldErr) return { error: fieldErr }

  const stardustErr = assertStardust(data.stardustCollection)
  if (stardustErr) return { error: stardustErr }

  return { departmentCode: deptResult.department.code }
}

async function validateSpacefarerPayload(data, tx) {
  const { error } = await validateNewSpacefarerData(data, tx)
  return error
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

  const planet = merged.originPlanet_code ?? merged.originPlanet?.code
  const department_ID = merged.department_ID ?? merged.department?.ID
  const position_ID = merged.position_ID ?? merged.position?.ID
  const navigationSkill_level = merged.navigationSkill_level ?? merged.navigationSkill?.level
  const spacesuitColor_code = merged.spacesuitColor_code ?? merged.spacesuitColor?.code

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
  return results.find(Boolean) ?? assertStardust(merged.stardustCollection)
}

module.exports = {
  getStardustMax,
  assertEmail,
  validateNewSpacefarerData,
  validateSpacefarerPayload,
  validateSpacefarerUpdate,
  assertDepartmentOnPlanet,
  assertPositionInDepartment,
  assertNavigationSkill,
  assertSpacesuitColor,
  assertStardust,
}
