using { galactic as db } from '../db/schema';

@path: '/galactic'
service GalacticService {

  @readonly
  @(requires: 'any')
  entity Planets as projection on db.Planets { * } where isDeleted = false;

  @readonly
  @(requires: 'any')
  entity Departments as projection on db.Departments { * } where isDeleted = false;

  @readonly
  @(requires: 'any')
  entity Positions as projection on db.Positions { * } where isDeleted = false;

  @readonly
  @(requires: 'any')
  entity NavigationSkillLevels as projection on db.NavigationSkillLevels { * } where isDeleted = false;

  @readonly
  @(requires: 'any')
  entity SpacesuitColors as projection on db.SpacesuitColors { * } where isDeleted = false;

  @cds.redirection.target
  @(requires: 'authenticated-user')
  @(restrict: [
    { grant: 'READ',   to: 'authenticated-user', where: 'originPlanet.code = $user.planet' },
    { grant: 'UPDATE', to: 'authenticated-user', where: 'email = $user.id' }
  ])
  entity Spacefarers as projection on db.Spacefarers
    where isDeleted = false;

  @(requires: 'authenticated-user')
  @(restrict: [
    { grant: 'READ', to: 'authenticated-user', where: 'originPlanet.code = $user.planet' }
  ])
  entity SpacefarersAll as projection on db.Spacefarers excluding { passwordHash, failedLoginAttempts };

  @(requires: 'any')
  action registerSpacefarer(
    name                  : String,
    email                 : String,
    password              : String,
    stardustCollection    : Integer,
    originPlanet_code     : String,
    navigationSkill_level : Integer,
    spacesuitColor_code   : String,
    department_ID         : UUID,
    position_ID           : UUID
  ) returns Spacefarers;

  @(requires: 'any')
  action resetPassword(
    email             : String,
    originPlanet_code : String
  ) returns { success : Boolean };

  @(requires: 'authenticated-user')
  action changeMyPassword(
    oldPassword : String,
    newPassword : String
  ) returns { success : Boolean };
}
