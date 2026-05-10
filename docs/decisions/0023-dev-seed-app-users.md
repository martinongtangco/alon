# Dev Seed Data for App Users

Status: accepted

The admin dashboard Users page queries `app.users` but the dev seed script (`backend/scripts/seed-dev.js`) only creates an admin account — it inserts nothing into `app.users`. Running the dashboard locally against a fresh database shows an empty Users table, making the page untestable without manual data entry. The decision is to extend `seed-dev.js` to insert a representative set of fake app users so any developer or agent can spin up a fully working local environment in one step.

## Decision

Add 20 fake app users to `seed-dev.js`, inserted after the admin account seed under a clearly labelled comment. Spread the data across the dimensions the Users page filters on:

- **status**: mix of `Active`, `Suspended`, `Banned`
- **plan**: mix of `Free` and `Pro`
- **platform**: mix of `ios` and `android`
- **current_mode**: mix of `Vibe`, `Chill`, `Focus`
- **vibes**: a short array of strings per user (1–3 items drawn from a small fixed set: `music`, `coffee`, `tech`, `outdoors`, `art`, `fitness`, `gaming`, `food`)

Each user needs:

| Column | Value |
|---|---|
| `id` | `uuid_generate_v4()` — let Postgres generate it, or use the `uuid` npm package already in dependencies |
| `display_name` | Fake first name + last initial (e.g. `"Jordan K."`) |
| `internal_token` | A random UUID string — use `uuidv4()` |
| `current_mode` | One of the modes above |
| `vibes` | JSON array of 1–3 strings |
| `plan` | `'Free'` or `'Pro'` |
| `status` | `'Active'` / `'Suspended'` / `'Banned'` |
| `platform` | `'ios'` or `'android'` |
| `last_active_at` | `NOW() - interval` — vary between 1 hour and 30 days ago using `new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)` |
| `created_at` | Earlier than `last_active_at` |

Use a single bulk `INSERT … VALUES (…), (…)` statement (not 20 individual queries) with `ON CONFLICT DO NOTHING` so re-running the seed is idempotent.

After inserting, log: `Seeded N app users` (where N is the actual `rowCount`).

## File to modify

**Only one file changes:** `backend/scripts/seed-dev.js`

The existing file already imports `bcryptjs`, `pg`, and `dotenv` and has a `pool` instance — use them. Do not add new dependencies.

## Consequences

Running `node scripts/seed-dev.js` after a fresh `db-setup.sql` will populate both `admin.users` and `app.users`, giving a complete local environment for dashboard development and testing.
