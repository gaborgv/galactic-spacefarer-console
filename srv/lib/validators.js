const cds = require('@sap/cds')
const { SELECT } = cds.ql

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

async function validateSpacefarerAssignment(data, tx) {
  const planet = data.originPlanet_code ?? data.originPlanet?.code
  const department_ID = data.department_ID ?? data.department?.ID
  const position_ID = data.position_ID ?? data.position?.ID
  if (!planet || !department_ID || !position_ID) return 'originPlanet, department and position are required'

  const deptErr = await assertDepartmentOnPlanet(department_ID, planet, tx)
  if (deptErr) return deptErr
  const posErr = await assertPositionInDepartment(position_ID, department_ID, tx)
  if (posErr) return posErr
}

module.exports = { validateSpacefarerAssignment, assertDepartmentOnPlanet, assertPositionInDepartment }
