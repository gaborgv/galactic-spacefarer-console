const cds = require("@sap/cds");
const { SELECT } = cds.ql;
const { verifyPassword } = require("./lib/password");

module.exports = async function galacticAuth(req, res, next) {
  req._login = () =>
    res
      .set("WWW-Authenticate", 'Basic realm="Galactic Spacefarers"')
      .sendStatus(401);

  const auth = req.headers.authorization;
  if (!auth?.match(/^basic /i)) return next();

  const creds = Buffer.from(auth.slice(6), "base64").toString();
  const sep = creds.indexOf(":");
  if (sep < 0) return req._login();

  const email = creds.slice(0, sep);
  const password = creds.slice(sep + 1);
  if (!email || !password) return req._login();

  const spacefarer = await SELECT.one
    .from("galactic.Spacefarers")
    .where({ email, isDeleted: false });
  if (!spacefarer || !verifyPassword(password, spacefarer.passwordHash))
    return req._login();

  const user = new cds.User({
    id: email,
    roles: ["authenticated-user", "spacefarer"],
    attr: { planet: spacefarer.originPlanet_code, email },
  });

  if (cds.context) cds.context.user = user;
  req.user = user;
  next();
};
