using GalacticService as service from '../../srv/galactic-service';

annotate service.Spacefarers with @(
  title: '{i18n>SpacefarersListTitle}',
  cds.search: name,
  Capabilities.DeleteRestrictions: { Deletable: false },
  Capabilities.UpdateRestrictions: {
    Updatable: true,
    NonUpdatableProperties: [
      name,
      email,
      originPlanet_code,
      navigationSkill_level,
      department_ID,
      position_ID,
    ],
  },
  UI: {
    DeleteHidden: true,
    UpdateHidden: true,
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
};

annotate service.Spacefarers with {
  spacesuitColor @(
    title: '{i18n>SpacesuitColor}',
    Common: {
      Text: spacesuitColorName,
      TextArrangement: #TextOnly,
      ValueListWithFixedValues: true,
      ValueList: {
        CollectionPath: 'SpacesuitColorOptions',
        Label: '{i18n>SpacesuitColor}',
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
  UI.LineItem: [{Value: name, Label: '{i18n>SpacesuitColor}'}],
);

annotate service.SpacesuitColorOptions with {
  code @(
    title: '{i18n>SpacesuitColor}',
    Common.Text: name,
    Common.TextArrangement: #TextOnly
  );
  name @title: '{i18n>SpacesuitColor}';
  locale @UI.Hidden;
};

annotate service.NavigationSkillChoices with @(
  title: '{i18n>NavigationSkill}',
  UI.Identification: [{Value: name}],
);
