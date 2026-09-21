const cds = require('@sap/cds')

const LOG = cds.log('mail')
const _sent = []
let _failNext = false

function clearSentMail() {
  _sent.length = 0
}

function getSentMail() {
  return [..._sent]
}

function setMailFailNext(value) {
  _failNext = Boolean(value)
}

function buildWelcomeMessage(spacefarer) {
  const name = spacefarer.name ?? 'Spacefarer'
  const planet = spacefarer.originPlanet_code ?? 'the galaxy'
  return {
    to: spacefarer.email,
    subject: 'Welcome aboard your galactic adventure!',
    text:
      `Dear ${name},\n\n` +
      `Congratulations on embarking on your journey from Planet ${planet}! ` +
      `Your stardust collection starts at ${spacefarer.stardustCollection ?? 0} ` +
      `and your navigation skill is level ${spacefarer.navigationSkill_level ?? 1}.\n\n` +
      `Safe travels among the stars!\n` +
      `— Galactic Spacefarer Command`,
  }
}

async function sendWelcomeEmail(spacefarer) {
  if (!spacefarer?.email) return

  if (_failNext) {
    _failNext = false
    throw new Error('Simulated mail transport failure')
  }

  const message = buildWelcomeMessage(spacefarer)
  _sent.push(message)
  LOG.info('Welcome email queued', { to: message.to, subject: message.subject })

  return message
}

module.exports = {
  sendWelcomeEmail,
  getSentMail,
  clearSentMail,
  buildWelcomeMessage,
  setMailFailNext,
}
