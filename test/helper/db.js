const cds = require('@sap/cds')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const TEST_DB = path.join(ROOT, 'test.sqlite')

async function resetTestDb() {
  fs.rmSync(TEST_DB, { force: true })
  if (typeof cds.disconnect === 'function') {
    try { await cds.disconnect() } catch { /* first run */ }
  }
  cds.root = ROOT
  return cds.deploy('*').to(`sqlite:${TEST_DB}`)
}

module.exports = { resetTestDb, TEST_DB, ROOT }
