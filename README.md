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
npm run watch
```

Open the app URL from the terminal output (default `http://localhost:4004`).

### Restarting the dev server

If port 4004 is in use or you see `SqliteError: cannot rollback - no transaction is active`, a previous `cds watch` likely still holds the DB connection. **Don't close the terminal window abruptly** — use `Ctrl+C` in the watch terminal first.

Recovery:

```bash
npm run dev:stop      # free port 4004
npm run deploy:fresh  # wipe and recreate db.sqlite
npm run watch
```

Or in one step: `npm run dev:reset`

Only use `deploy:fresh` when you need a clean database — normal restarts are just `Ctrl+C` then `npm run watch`.

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

## API (`/galactic`)

| Resource / action | Auth | Purpose |
| ----------------- | ---- | ------- |
| `Planets`, `Departments`, `Positions`, … | none | Active code lists for registration (`isDeleted = false`) |
| `Spacefarers` | Basic | Active spacefarers on your planet |
| `SpacefarersAll` | Basic | All spacefarers on your planet (includes soft-deleted) |
| `POST registerSpacefarer` | none | Create account |
| `POST changeMyPassword` | Basic | Change password only |
| `POST resetPassword` | none | Demo reset to origin planet code |
| `PATCH Spacefarers({id})` with `{ isDeleted: true }` | Basic | Soft-delete own profile (no DELETE) |

Optional env vars:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GALACTIC_LOCKOUT_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `GALACTIC_LOCKOUT_DURATION_MINUTES` | `15` | Lockout duration |
| `GALACTIC_RATE_LIMIT_MAX` | `60` | Requests per window per IP (register/reset/auth) |
| `GALACTIC_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |

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
