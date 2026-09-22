const cds = require('@sap/cds')
const { middleware: throttle } = require('./lib/throttle')

const EMPTY_FLEX = { changes: [], compVariants: [], contexts: [], variantSection: {} }

cds.on('bootstrap', app => {
  // OData V4 filter expressions must use %20; axios encodes spaces as '+' in params.
  app.use((req, _res, next) => {
    if (req.url.includes('$filter=')) {
      req.url = req.url.replace(/\+/g, '%20')
    }
    next()
  })

  // Local CAP dev has no ABAP LREP; return empty flex payloads so FE does not crash on 404.
  app.get('/sap/bc/lrep/flex/data/:appId', (_req, res) => res.json(EMPTY_FLEX))
  app.get('/sap/bc/lrep/flex/settings', (_req, res) => res.json({ enabled: false }))

  app.use('/galactic/registerSpacefarer', throttle({ label: 'register' }))
  app.use('/galactic/resetPassword', throttle({ label: 'reset' }))
})

module.exports = cds.server
