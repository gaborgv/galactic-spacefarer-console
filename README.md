# galactic-spacefarer-console

Spacefarer dashboard. CAP + Fiori Elements. SQLite locally.

## Requirements

- Node.js 20 (see `.nvmrc`)
- `@sap/cds-dk` globally: `npm i -g @sap/cds-dk`

```bash
node -v && cds -v
```

## Setup

```bash
git clone <repository-url>
cd galactic-spacefarer-console
npm install
npm run deploy
```

Seed data lives in `db/seed/` and is committed. Only `*.sqlite` files are gitignored.

## Run

```bash
cds watch
```

Open the app URL from the terminal output.

## Database

| Command                | Use                                                           |
| ---------------------- | ------------------------------------------------------------- |
| `npm run deploy`       | Apply schema changes to `db.sqlite`                           |
| `npm run deploy:fresh` | Drop DB files and redeploy from scratch                       |
| `npm test`             | Deploy `test.sqlite` from `test/data/`, run integration tests |

For breaking schema changes locally, use `deploy:fresh`. Production targets (HANA/PostgreSQL) can use CAP schema evolution — not configured for SQLite.

## Tests

Tests use the `test` profile: tear down `test.sqlite`, redeploy schema, load fixtures from `test/data/`.

```bash
npm test
```

## Demo logins

Spacefarers authenticate with **email + password**. Passwords are stored as bcrypt hashes only (`passwordHash` on `Spacefarers`). Demo password = origin planet code.

| email               | password | planet |
| ------------------- | -------- | ------ |
| picard@planet-x.gal | X        | X      |
| uhura@planet-x.gal  | X        | X      |
| worf@planet-y.gal   | Y        | Y      |

## Layout

```
db/         model + dev seed (db/seed/)
test/       integration tests + test fixtures (test/data/)
_i18n/      file-based UI translations
srv/        service, auth, handlers
app/        Fiori LR + OP
```
