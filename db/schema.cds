using { managed } from '@sap/cds/common';

namespace galactic;

aspect softDelete {
  isDeleted : Boolean default false not null;
}

@assert.unique: { name: [name] }
entity Planets : managed, softDelete {
  key code : String(10);
      name : String(100) not null;

      departments : Association to many Departments
                      on departments.planet = $self;
      spacefarers : Association to many Spacefarers
                      on spacefarers.originPlanet = $self;
}

@assert.unique: { planetCode: [planet, code] }
entity Departments : managed, softDelete {
  key ID   : UUID;
      code : String(20)  not null;

      planet : Association to Planets not null;
      texts  : Composition of many DepartmentTexts
                 on texts.department = $self;
      positions   : Composition of many Positions
                      on positions.department = $self;
      spacefarers : Association to many Spacefarers
                      on spacefarers.department = $self;
}

entity DepartmentTexts : managed {
  key department : Association to Departments;
  key locale     : String(5);
      name         : String(100) not null;
}

@assert.unique: { codeDepartment: [department, code] }
entity Positions : managed, softDelete {
  key ID   : UUID;
      code : String(20) not null;

      department : Association to Departments not null;
      texts      : Composition of many PositionTexts
                     on texts.position = $self;

      spacefarers : Association to many Spacefarers
                      on spacefarers.position = $self;
}

entity PositionTexts : managed {
  key position : Association to Positions;
  key locale   : String(5);
      title      : String(100) not null;
}

entity NavigationSkillLevels : managed, softDelete {
  key level : Integer @assert.range: [1, 7];

      texts : Composition of many NavigationSkillLevelTexts
                on texts.skillLevel = $self;
}

entity NavigationSkillLevelTexts : managed {
  key skillLevel : Association to NavigationSkillLevels;
  key locale     : String(5);
      label        : String(50) not null;
}

entity SpacesuitColors : managed, softDelete {
  key code    : String(20);
      hexCode : String(7)  not null;

      texts : Composition of many SpacesuitColorTexts
                on texts.color = $self;
}

entity SpacesuitColorTexts : managed {
  key color  : Association to SpacesuitColors;
  key locale : String(5);
      name   : String(100) not null;
}

@assert.unique: { email: [email] }
entity Spacefarers : managed, softDelete {
  key ID           : UUID;
      name         : String(100) not null;
      email        : String(255) not null;
      passwordHash        : String(100)  not null;
      failedLoginAttempts : Integer default 0 @assert.range: [0, 999];
      lockedUntil           : Timestamp;

      stardustCollection : Integer default 0 @assert.range: [0, 999999];

      originPlanet    : Association to Planets not null;
      navigationSkill : Association to NavigationSkillLevels not null;
      spacesuitColor  : Association to SpacesuitColors not null;
      department      : Association to Departments not null;
      position        : Association to Positions not null;
}
