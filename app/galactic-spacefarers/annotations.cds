using GalacticService as service from '../../srv/galactic-service';

annotate service.Spacefarers with @(
  title: '{i18n>SpacefarersListTitle}',
  cds.search: name,
  Capabilities.DeleteRestrictions: { Deletable: false },
  UI: {
    DeleteHidden: true,
    CommunicationHidden: true,
    SelectionFields: [stardustCollection, spacesuitColor_code],
    LineItem: [
      {Value: name, Label: '{i18n>Spacefarer}'},
      {Value: stardustCollection, Label: '{i18n>StardustCollection}'},
      {Value: spacesuitColorName, Label: '{i18n>SpacesuitColor}'},
    ],
    HeaderInfo: {
      TypeName: '{i18n>Spacefarer}',
      TypeNamePlural: '{i18n>SpacefarersListTitle}',
      Title: {Value: name},
      Description: {Value: email},
    },
    Identification: [
      {Value: stardustCollection, Label: '{i18n>StardustCollection}'},
      {Value: spacesuitColor_code, Label: '{i18n>SpacesuitColor}'},
      {Value: navigationSkillLabel, Label: '{i18n>NavigationSkill}'},
    ],
    Facets: [
      {
        $Type: 'UI.ReferenceFacet',
        Label: '{i18n>CosmicDetails}',
        Target: '@UI.FieldGroup#Details',
      },
      {
        $Type: 'UI.ReferenceFacet',
        Label: '{i18n>Assignment}',
        Target: '@UI.FieldGroup#Assignment',
      },
    ],
    FieldGroup #Details: {
      Data: [
        {Value: name, Label: '{i18n>Name}'},
        {Value: email, Label: '{i18n>Email}'},
        {Value: originPlanetName, Label: '{i18n>OriginPlanet}'},
        {Value: stardustCollection, Label: '{i18n>StardustCollection}'},
        {Value: spacesuitColor_code, Label: '{i18n>SpacesuitColor}'},
        {Value: navigationSkillLabel, Label: '{i18n>NavigationSkill}'},
      ],
    },
    FieldGroup #Assignment: {
      Data: [
        {Value: departmentName, Label: '{i18n>Department}'},
        {Value: positionName, Label: '{i18n>Position}'},
      ],
    },
    PresentationVariant: {
      Text: '{i18n>SpacefarersListTitle}',
      Visualizations: ['@UI.LineItem'],
    },
  },
);

annotate service.Spacefarers with {
  passwordHash           @UI.Hidden;
  failedLoginAttempts    @UI.Hidden;
  lockedUntil            @UI.Hidden;
  isDeleted              @UI.Hidden;
  name                   @UI.HiddenFilter;
  email                  @UI.HiddenFilter;
  spacesuitColorName     @UI.HiddenFilter;
  departmentName         @UI.HiddenFilter;
  positionName           @UI.HiddenFilter;
  navigationSkillLabel   @UI.HiddenFilter;
  originPlanetName       @UI.HiddenFilter;
  ID                     @UI.HiddenFilter;
  createdAt              @UI.HiddenFilter;
  createdBy              @UI.HiddenFilter;
  modifiedAt             @UI.HiddenFilter;
  modifiedBy             @UI.HiddenFilter;
  originPlanet_code      @UI.HiddenFilter;
  navigationSkill_level  @UI.HiddenFilter;
  department_ID          @UI.HiddenFilter;
  position_ID            @UI.HiddenFilter;
  spacesuitColor_code    @UI.HiddenFilter;
};

annotate service.Spacefarers with {
  name                   @Common.FieldControl: #ReadOnly;
  email                  @Common.FieldControl: #ReadOnly;
  originPlanetName       @Common.FieldControl: #ReadOnly;
  originPlanet_code      @Common.FieldControl: #ReadOnly;
  navigationSkillLabel   @Common.FieldControl: #ReadOnly;
  navigationSkill_level  @Common.FieldControl: #ReadOnly;
  departmentName         @Common.FieldControl: #ReadOnly;
  department_ID          @Common.FieldControl: #ReadOnly;
  positionName           @Common.FieldControl: #ReadOnly;
  position_ID            @Common.FieldControl: #ReadOnly;
  spacesuitColorName     @Common.FieldControl: #ReadOnly;
  createdAt              @Common.FieldControl: #ReadOnly;
  createdBy              @Common.FieldControl: #ReadOnly;
  modifiedAt             @Common.FieldControl: #ReadOnly;
  modifiedBy             @Common.FieldControl: #ReadOnly;
  stardustCollection     @Common.FieldControl: #Mandatory;
  spacesuitColor_code    @Common.FieldControl: #Mandatory;
};

annotate service.Spacefarers with {
  spacesuitColor_code @(
    title: '{i18n>SpacesuitColor}',
    Common: {
      Text: spacesuitColorName,
      TextArrangement: #TextOnly,
      ValueListWithFixedValues: true,
      ValueList: {
        CollectionPath: 'SpacesuitColorOptions',
        Parameters: [
          {
            $Type: 'Common.ValueListParameterInOut',
            LocalDataProperty: spacesuitColor_code,
            ValueListProperty: 'code',
          },
          {
            $Type: 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name',
          },
        ],
      },
    },
  );
  stardustCollection @(
    title: '{i18n>StardustCollection}',
    UI.MultiLineText: false,
  );
  name               @title: '{i18n>Spacefarer}';
  email              @title: '{i18n>Email}';
  originPlanetName   @title: '{i18n>OriginPlanet}';
};

annotate service.SpacesuitColorOptions with @(
  title: '{i18n>SpacesuitColor}',
  UI.Identification: [{Value: name}],
);

annotate service.NavigationSkillChoices with @(
  title: '{i18n>NavigationSkill}',
  UI.Identification: [{Value: name}],
);
