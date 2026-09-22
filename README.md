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

### Fiori List Report

After `npm run watch`, open the **Galactic Spacefarer Adventure** app:

```
http://localhost:4004/galactic-spacefarers/webapp/index.html
```

Safari only prompts for Basic Auth when the app requests protected OData data (`/galactic/Spacefarers`). `$metadata` is public, so if the UI fails to start you may see no auth prompt at all — hard-refresh after pulling UI fixes.

Alternative CAP preview (useful while iterating on annotations):

```
http://localhost:4004/$fiori-preview/GalacticService/Spacefarers#preview-app
```

Sign in with HTTP Basic auth when prompted (email + password = origin planet code):

| email               | password |
| ------------------- | -------- |
| picard@planet-x.gal | X        |
| worf@planet-y.gal   | Y        |

Planet X users see Planet X spacefarers only; Planet Y users see Planet Y spacefarers only.

The list shows **name**, **stardust collection**, and **spacesuit color** (localized name, not hex). Sort, filter, and pagination are provided by Fiori Elements.

### Registration (no login)

Open the registration page directly:

```
http://localhost:4004/galactic-spacefarers/webapp/register.html
```

Unauthenticated visits to the list redirect here automatically. Registration is a separate page so it does not interfere with Fiori Elements routing. Complete the form and sign in afterward with your email and password.

### Object Page

Click a spacefarer row to open the Object Page. You can view any spacefarer on your planet read-only. On your own profile, use **Edit Profile**, **Change Password**, and **Delete Spacefarer Profile** (soft-delete).

**Edit Profile** opens a dialog to change stardust collection and spacesuit color. Native Object Page edit is not used — Fiori Elements requires draft or sticky services for that, which this app does not enable.

If the page stays blank, hard-refresh and check the browser console. Demo credentials: `picard@planet-x.gal` / `X`.

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
| `POST registerSpacefarer` | none | Create account (applies onboarding bonuses, sends welcome email to log) |
| `GET whoAmI()` | Basic | Current session email and planet (UI edit gating) |
| `POST changeMyPassword` | Basic | Change password only |
| `POST resetPassword` | none | Demo reset to origin planet code |
| `PATCH Spacefarers({id})` with `{ isDeleted: true }` | Basic | Soft-delete own profile (no DELETE) |

Optional env vars:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GALACTIC_LOCKOUT_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `GALACTIC_LOCKOUT_DURATION_MINUTES` | `15` | Lockout duration |
| `GALACTIC_RATE_LIMIT_MAX` | `2000` | Requests per window per IP (register/reset) |
| `GALACTIC_AUTH_FAIL_LIMIT` | `500` | Failed logins per IP per window before 429 |
| `GALACTIC_AUTH_CACHE_TTL_MS` | `600000` | Basic Auth session cache (10 min) |
| `GALACTIC_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `GALACTIC_STARDUST_MAX` | `999999` | Maximum stardust collection (validation and post-bonus cap) |
| `GALACTIC_BONUS_DEPARTMENT_CODES` | `ENG` | Comma-separated department codes that receive the extra +200 stardust signup bonus |

## Onboarding bonuses

When a spacefarer is created (`registerSpacefarer` or direct `CREATE` on `Spacefarers`), event handlers apply:

| Bonus | Rule |
| ----- | ---- |
| Stardust | +100 for all; +200 additional for configured department codes (default: `ENG`) |
| Stardust cap | `GALACTIC_STARDUST_MAX` (default 999,999; bonus may be trimmed to fit) |
| Navigation skill | +1 for all, capped at level 7 |
| Welcome email | Log-only mock (`cds.log('mail')` + in-memory queue for tests) |

Mail delivery failures do not roll back registration.

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
