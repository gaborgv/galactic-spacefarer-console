const bcrypt = require('bcrypt')

const ROUNDS = 10

function hashPassword(plain) {
  return bcrypt.hashSync(plain, ROUNDS)
}

function verifyPassword(plain, passwordHash) {
  return bcrypt.compareSync(plain, passwordHash)
}

module.exports = { hashPassword, verifyPassword, ROUNDS }
