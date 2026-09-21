const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_planets_name ON galactic_Planets(name)',
  'CREATE INDEX IF NOT EXISTS idx_planets_isDeleted ON galactic_Planets(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_navigationSkillLevels_isDeleted ON galactic_NavigationSkillLevels(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_spacesuitColors_isDeleted ON galactic_SpacesuitColors(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_departments_planet ON galactic_Departments(planet_code)',
  'CREATE INDEX IF NOT EXISTS idx_departments_isDeleted ON galactic_Departments(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_positions_department ON galactic_Positions(department_ID)',
  'CREATE INDEX IF NOT EXISTS idx_positions_isDeleted ON galactic_Positions(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_spacefarers_originPlanet ON galactic_Spacefarers(originPlanet_code)',
  'CREATE INDEX IF NOT EXISTS idx_spacefarers_department ON galactic_Spacefarers(department_ID)',
  'CREATE INDEX IF NOT EXISTS idx_spacefarers_isDeleted ON galactic_Spacefarers(isDeleted)',
  'CREATE INDEX IF NOT EXISTS idx_spacefarers_spacesuitColor ON galactic_Spacefarers(spacesuitColor_code)',
]

module.exports = async tx => {
  for (const sql of INDEXES) await tx.run(sql)
}
