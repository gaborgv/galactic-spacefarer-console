using { galactic as db } from '../db/schema';

@path: '/galactic'
service GalacticService {

  @readonly
  @(requires: 'any')
  entity Planets as projection on db.Planets;

  @readonly
  @(requires: 'any')
  entity Departments as projection on db.Departments;

  @readonly
  @(requires: 'any')
  entity Positions as projection on db.Positions;

  @readonly
  @(requires: 'any')
  entity NavigationSkillLevels as projection on db.NavigationSkillLevels;

  @readonly
  @(requires: 'any')
  entity SpacesuitColors as projection on db.SpacesuitColors;

  @(restrict: [
    { grant: 'READ',   to: 'authenticated-user', where: 'originPlanet.code = $user.planet' },
    { grant: 'UPDATE', to: 'authenticated-user', where: 'email = $user.id' },
    { grant: 'CREATE', to: 'any' }
  ])
  entity Spacefarers as projection on db.Spacefarers;
}

extend GalacticService.Spacefarers with columns {
  '' as password : String
}
