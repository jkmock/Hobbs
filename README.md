# Hobbs

*Named after the Hobbs meter, the clock in an airplane that measures flight time in tenths of an hour.*

A logbook and social app for student pilots. Log your flights, track your progress toward the FAA private pilot checkride requirements, see your routes on a map, and share flights with friends.

## Planned Features

- **Logbook:** record flights with aircraft, route, and time by category (dual, solo, cross-country, night, instrument), plus landings
- **Checkride progress:** track progress toward the 14 CFR 61.109 private pilot requirements
- **Route maps:** draw flights from airports or uploaded GPS tracks (GPX/KML)
- **Social:** follow friends, a flight feed, kudos and comments
- **Instructor role:** CFIs can view student progress and endorse flights

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Backend | Node.js |
| Database | PostgreSQL 17 + PostGIS 3.5 (Docker) |
| Migrations | dbmate (plain SQL) |
| Monorepo | pnpm workspaces |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Postgres client tools (`pg_dump`, `psql`), used by dbmate to write `db/schema.sql`. On macOS:

  ```bash
  brew install libpq
  echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
  ```

  Open a new terminal and confirm with `pg_dump --version`.

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/jkmock/Hobbs.git
   cd Hobbs
   pnpm install
   ```

2. Create your environment file and set a password:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and replace `changeme` with a real password in **both** `POSTGRES_PASSWORD` and `DATABASE_URL`. Use a URL-safe password, for example:

   ```bash
   openssl rand -hex 24
   ```

   > Postgres only reads these values the first time the database starts. If you change them later, reset the database with `docker compose down -v` (this deletes all local data).

3. Start the database:

   ```bash
   docker compose up -d
   ```

   Check that it's running with `docker compose ps`. The database is available at `localhost:5432`.

4. Run the database migrations:

   ```bash
   pnpm db:up
   ```

5. Load airport data (US airports from [OurAirports](https://ourairports.com/data/)):

   ```bash
   pnpm db:seed:download
   pnpm db:seed
   ```

   The seed is safe to rerun: it inserts new airports and updates changed ones.

6. Start the API and the web app (two terminals):

   ```bash
   pnpm dev
   ```

   ```bash
   pnpm dev:web
   ```

   Open http://localhost:5173. Vite forwards `/api/*` requests to the API on port 3000.

### Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API in watch mode |
| `pnpm dev:web` | Run the web app at localhost:5173 |
| `pnpm -r typecheck` | Type-check every package |
| `docker compose up -d` | Start the database in the background |
| `docker compose down` | Stop the database (data is kept) |
| `docker compose down -v` | Stop the database and **delete all data** |
| `docker compose exec db psql -U pilotlog -d pilotlog` | Open a SQL shell in the database |
| `pnpm db:up` | Apply all pending migrations |
| `pnpm db:status` | List migrations and whether each has been applied |
| `pnpm db:rollback` | Undo the most recent migration |
| `pnpm db:new <name>` | Create a new migration file |
| `pnpm db:dump` | Regenerate `db/schema.sql` from the database |
| `pnpm db:seed:download` | Download the latest `airports.csv` into `data/` |
| `pnpm db:seed` | Load or update airports from `data/airports.csv` |

## Database migrations

Schema changes are made only through migrations in `db/migrations/`, managed by [dbmate](https://github.com/amacneil/dbmate). Each file has a `-- migrate:up` section that applies the change and a `-- migrate:down` section that reverses it. dbmate records applied migrations in the `schema_migrations` table and regenerates `db/schema.sql` after each run.

To change the schema:

1. Create a migration with `pnpm db:new <descriptive_name>`.
2. Write the `up` and `down` SQL.
3. Run `pnpm db:up`, then test the reverse with `pnpm db:rollback` and `pnpm db:up` again.
4. Commit the migration together with the updated `db/schema.sql`.

> Never edit a migration after it has been pushed. Others' databases have already run it and won't run it again. Write a new migration instead.

## Disclaimer

Hobbs is a training and progress-tracking tool. It is not a substitute for your official pilot logbook.
