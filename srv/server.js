const cds = require('@sap/cds')
const { middleware: throttle } = require('./lib/throttle')

cds.on('bootstrap', app => {
  app.use((req, res, next) => {
    if (req.path.includes('$batch')) {
      return res.status(501).json({
        error: { code: '501', message: 'Batch requests are not supported in this demo service.' },
      })
    }
    next()
  })

  app.use('/galactic/registerSpacefarer', throttle({ label: 'register' }))
  app.use('/galactic/resetPassword', throttle({ label: 'reset' }))
})

module.exports = cds.server
