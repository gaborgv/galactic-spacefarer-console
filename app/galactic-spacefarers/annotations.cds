using GalacticService as service from '../../srv/galactic-service';

annotate service.Spacefarers with @(
  title: '{i18n>SpacefarersListTitle}',
  cds.search: name,
  UI: {
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
    PresentationVariant: {
      Text: '{i18n>SpacefarersListTitle}',
      Visualizations: ['@UI.LineItem'],
    },
  },
);

annotate service.Spacefarers with {
  passwordHash        @UI.Hidden;
  failedLoginAttempts @UI.Hidden;
  lockedUntil         @UI.Hidden;
  name                @UI.HiddenFilter;
  email               @UI.HiddenFilter;
  spacesuitColorName  @UI.HiddenFilter;
  ID                  @UI.HiddenFilter;
  isDeleted           @UI.HiddenFilter;
  createdAt           @UI.HiddenFilter;
  createdBy           @UI.HiddenFilter;
  modifiedAt          @UI.HiddenFilter;
  modifiedBy           @UI.HiddenFilter;
  originPlanet_code   @UI.HiddenFilter;
  navigationSkill_level @UI.HiddenFilter;
  department_ID       @UI.HiddenFilter;
  position_ID         @UI.HiddenFilter;
};

annotate service.Spacefarers with {
  spacesuitColor_code @(
    title: '{i18n>SpacesuitColor}',
    Common.Label: '{i18n>SpacesuitColor}',
    Common: {
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
};

annotate service.SpacesuitColorOptions with @(
  title: '{i18n>SpacesuitColor}',
  UI.Identification: [{Value: name}],
);
