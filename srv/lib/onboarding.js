const { getStardustMax } = require('./config')
const { validateNewSpacefarerData } = require('./validators')

const SKILL_MIN = 1
const SKILL_MAX = 7
const BASE_STARDUST_BONUS = 100
const DEPT_EXTRA_STARDUST_BONUS = 200
const RECRUIT_SKILL_BOOST = 1

function getBonusDepartmentCodes() {
  const raw = process.env.GALACTIC_BONUS_DEPARTMENT_CODES ?? 'ENG'
  return raw.split(',').map(code => code.trim()).filter(Boolean)
}

function departmentQualifiesForExtraBonus(departmentCode) {
  if (!departmentCode) return false
  return getBonusDepartmentCodes().includes(departmentCode)
}

async function prepareCandidateForLaunch(data, { departmentCode } = {}) {
  data.stardustCollection = data.stardustCollection ?? 0

  let stardustBonus = BASE_STARDUST_BONUS
  if (departmentQualifiesForExtraBonus(departmentCode)) {
    stardustBonus += DEPT_EXTRA_STARDUST_BONUS
  }

  data.stardustCollection += stardustBonus
  const max = getStardustMax()
  if (data.stardustCollection > max) {
    data.stardustCollection = max
  }

  const level = data.navigationSkill_level ?? SKILL_MIN
  data.navigationSkill_level = Math.min(SKILL_MAX, Math.max(SKILL_MIN, level + RECRUIT_SKILL_BOOST))

  return null
}

async function validateAndPrepareNewSpacefarer(data, tx) {
  const { error, departmentCode } = await validateNewSpacefarerData(data, tx)
  if (error) return error
  return prepareCandidateForLaunch(data, { departmentCode })
}

function verifyOnboardingPersisted(stored, prepared) {
  if (!stored || !prepared) return false
  return (
    stored.stardustCollection === prepared.stardustCollection &&
    stored.navigationSkill_level === prepared.navigationSkill_level
  )
}

module.exports = {
  BASE_STARDUST_BONUS,
  DEPT_EXTRA_STARDUST_BONUS,
  ENG_STARDUST_BONUS: BASE_STARDUST_BONUS + DEPT_EXTRA_STARDUST_BONUS,
  RECRUIT_SKILL_BOOST,
  SKILL_MAX,
  getBonusDepartmentCodes,
  departmentQualifiesForExtraBonus,
  prepareCandidateForLaunch,
  validateAndPrepareNewSpacefarer,
  verifyOnboardingPersisted,
}
