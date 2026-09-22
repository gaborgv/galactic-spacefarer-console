process.env.CDS_ENV = 'test'

require('@cap-js/cds-test/lib/fixtures/mocha.js')

const { execSync } = require('child_process')
const { expect } = require('@cap-js/cds-test/lib/chai')

describe('Fiori metadata annotations', () => {
  it('exposes list report SelectionFields and LineItem in OData annotations', () => {
    const edmx = execSync('npx cds compile app/services.cds --to edmx 2>/dev/null', { encoding: 'utf8' })
    const selectionFields = edmx.match(/Term="UI\.SelectionFields">\s*<Collection>([\s\S]*?)<\/Collection>/)?.[1] ?? ''

    expect(selectionFields).to.include('<PropertyPath>stardustCollection</PropertyPath>')
    expect(selectionFields).to.include('<PropertyPath>spacesuitColor_code</PropertyPath>')
    expect(selectionFields).not.to.include('<PropertyPath>name</PropertyPath>')
    expect(selectionFields).not.to.include('<PropertyPath>email</PropertyPath>')
    expect(edmx).to.include('PropertyValue Property="Value" Path="spacesuitColorName"')
    expect(edmx).to.include('EntitySet Name="SpacesuitColorOptions"')
    expect(edmx).to.include('EntitySet Name="NavigationSkillChoices"')
    expect(edmx).to.include('PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Details"')
    expect(edmx).to.include('PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Assignment"')
    expect(edmx).to.include('FunctionImport Name="whoAmI"')
  })
})
