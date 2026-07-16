# Handy Commands — Precast App

Quick reference for local development. Run all commands from `C:\Projects\precastapp`.

## Daily workflow

```powershell
# PostgreSQL 18 runs as a Windows service (postgresql-x64-18) — no extra DB startup needed
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**

---

## App (Next.js)


| Command         | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Start dev server (`predev` runs `prisma generate` first) |
| `npm run build` | Production build                                         |
| `npm run start` | Run production build                                     |
| `npm run lint`  | ESLint                                                   |


---

## Electron desktop client

Thin shell that loads the server URL. **Build on the dev PC.** The server runs the app; staff PCs only run the installer.

| Machine | Path |
|---------|------|
| Dev PC | `C:\Projects\precastapp` |
| Server | `C:\Apps\precastapp` |


| Command                                                                           | Where | Purpose                                                                    |
| --------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `npm run electron:dev`                                                            | Dev PC | Open desktop app against `http://localhost:3000` (run `npm run dev` first) |
| `npm run electron:build`                                                          | Dev PC | Build Windows NSIS installer to `dist/electron/`                           |
| `.\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://192.168.1.20:3000"` | Dev PC | Set server URL and build installer                                         |
| `.\scripts\deploy\publish-electron-update.ps1 -ServerUrl "http://192.168.1.20:3000" -CopyTo "\\LIP-TITAN\C$\Apps\precastapp\public\updates"` | Dev PC | Build + copy auto-update files to the **server** |


Override dev server URL: `$env:PRECAST_SERVER_URL="http://localhost:3000"; npm run electron:dev`

Staff override after install: `%APPDATA%\Precast Ops\config.json` → `{ "serverUrl": "..." }`

---

## PostgreSQL (installed)

Local development uses **PostgreSQL 18** on `localhost:5432`, database `precastapp`.


| Check           | Command                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Service running | `Get-Service postgresql-x64-18`                                                                |
| Connect (psql)  | `"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d precastapp` |


Set in `.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/precastapp"
```

Use the password you set when installing PostgreSQL.

**First-time setup** (create database once):

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE precastapp;"
npx prisma migrate deploy
npx prisma generate
```

---

## Schema & migrations

**Do not use `npx prisma db push`** in this project.


| Command                                | Purpose                                           |
| -------------------------------------- | ------------------------------------------------- |
| `npx prisma migrate dev --name <name>` | Apply schema changes via migration                |
| `npx prisma migrate deploy`            | Apply pending migrations (e.g. fresh DB)          |
| `npx prisma generate`                  | Regenerate Prisma client (`app/generated/prisma`) |
| `npx prisma validate`                  | Check `schema.prisma`                             |
| `npx prisma migrate status`            | See pending/applied migrations                    |


Example after editing `prisma/schema.prisma`:

```powershell
npx prisma migrate dev --name add_quote_models
npx prisma generate
```

---

## Browse data


| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `npx prisma studio` | Web UI for tables (requires PostgreSQL running) |


---

## Troubleshooting

### `P1001` — Can't reach database server

PostgreSQL service is not running or `.env` has wrong host/port.

```powershell
Get-Service postgresql-x64-18
# If stopped, start it:
Start-Service postgresql-x64-18
npx prisma migrate status
```

### Password authentication failed

Update `.env` with the correct `postgres` user password from your PostgreSQL install.

### Prisma Studio — "Could not load schema metadata"

1. Confirm PostgreSQL service is **Running**
2. Verify `DATABASE_URL` in `.env` points to `localhost:5432/precastapp`
3. `npx prisma migrate status` — if OK, restart Studio

### Port 3000 already in use

Another `npm run dev` is running. Use the URL shown in the terminal (e.g. `http://localhost:3001`) or stop the other process.

### Quote PDF — "Could not find Chrome" / browser not found

PDF generation uses **Brave** first (headless, on the server — not your open browser tab), then Puppeteer's bundled Chrome, then Google Chrome.

Typical Brave path: `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`

If nothing is found, run:

```powershell
npm run puppeteer:install
```

Then restart `npm run dev`.

---

## Useful URLs


| URL                                                                  | Page                                                |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| [http://localhost:3000](http://localhost:3000)                       | Dashboard                                           |
| [http://localhost:3000/customers](http://localhost:3000/customers)   | Customers                                           |
| [http://localhost:3000/jobs](http://localhost:3000/jobs)             | Jobs                                                |
| [http://localhost:3000/products](http://localhost:3000/products)     | Products                                            |
| [http://localhost:3000/quotes](http://localhost:3000/quotes)         | Quotes                                              |
| [http://localhost:3000/quotes/new](http://localhost:3000/quotes/new) | New quote                                           |
| [http://localhost:5555](http://localhost:5555)                       | Prisma Studio (default port; check terminal output) |


---

## Git / GitHub (optional)


| Command        | Purpose                                 |
| -------------- | --------------------------------------- |
| `git status`   | Working tree status                     |
| `git diff`     | View changes                            |
| `gh pr create` | Create pull request (requires `gh` CLI) |


---

## Office deployment (Windows server)

Full step-by-step guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**


| Script                                         | Purpose                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| `.\scripts\deploy\install-prerequisites.ps1`   | Check Node, PostgreSQL, Git, browser              |
| `.\scripts\deploy\verify-unc-access.ps1`       | Test read/write on jobs/submittals paths          |
| `.\scripts\deploy\deploy-app.ps1`              | `npm ci`, migrate, build                          |
| `.\scripts\deploy\update-production.ps1`       | **One-command update**: stop service, pull, deploy-app, start, health check (rolls back the build on failure). Also `npm run deploy:update` |
| `.\scripts\deploy\start-production.ps1`        | Run production server (loads `.env`)              |
| `.\scripts\deploy\configure-firewall.ps1`      | LAN firewall rule for port 3000                   |
| `.\scripts\deploy\install-windows-service.ps1` | NSSM Windows service                              |
| `.\scripts\deploy\backup-database.ps1`         | `pg_dump` backup (schedule nightly)               |
| `.\scripts\deploy\post-deploy-config.ps1`      | Post-deploy checklist + optional file sync        |
| `.\scripts\deploy\build-electron-client.ps1`   | Build Precast Ops desktop installer for staff PCs |
| `.\scripts\deploy\publish-electron-update.ps1` | Build + publish desktop auto-update to server `public/updates/` |


Checklist template: [docs/deployment-server-info.md](docs/deployment-server-info.md)  
Staff rollout: [docs/office-rollout.md](docs/office-rollout.md)

---

## Project paths


| Path                    | What                                        |
| ----------------------- | ------------------------------------------- |
| `prisma/schema.prisma`  | Database schema                             |
| `prisma/migrations/`    | Migration SQL                               |
| `app/generated/prisma/` | Generated Prisma client (do not edit)       |
| `.env`                  | `DATABASE_URL` and secrets (not committed)  |
| `.env.example`          | Production env template                     |
| `docs/DEPLOYMENT.md`    | Office server deployment guide              |
| `scripts/deploy/`       | PowerShell deploy scripts                   |
| `electron/`             | Electron thin-client (main process, icon)   |
| `dist/electron/`        | Built desktop installer output (gitignored) |
| `AGENTS.md`             | Rules for AI agents working in this repo    |



---

## Database backups

Daily automated backup via Windows Task Scheduler (task: **"PrecastApp DB Backup"**,
runs `scripts/backup-database.ps1` at 12:00 PM while logged on).

- Backups: `C:\Backups\precastapp\precastapp_<date>_<time>.dump` (pg_dump custom format)
- Retention: 30 days, pruned automatically; log at `C:\Backups\precastapp\backup.log`
- Credentials come from `DATABASE_URL` in `.env` — no secrets in the script

Run a backup manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup-database.ps1
```

Restore over the live database (stop the app first):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost `
    -d precastapp --clean --if-exists "C:\Backups\precastapp\<file>.dump"
```

Restore into a scratch database to inspect without touching live data:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE precastapp_restore_test;"
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost -d precastapp_restore_test --no-owner "C:\Backups\precastapp\<file>.dump"
```

> The backup folder lives on the same disk as the database. Copy or sync
> `C:\Backups\precastapp` to a second machine, NAS, or cloud drive for real
> disaster protection.

---

## Tests

```bash
npm test         # run the vitest suite once
npm run test:watch
```

- Unit tests (`tests/unit/`) cover the money math (`lib/money.ts`,
  `lib/quotes/money-rules.ts`), quote status rules, and the Outlook
  draft builder — no database needed.
- Integration tests (`tests/integration/`) run real server-action logic
  (e.g. the job award flow) against a scratch database.
- The scratch DB is `precastapp_test`, derived from `DATABASE_URL` in
  `.env`; the harness refuses any database whose name doesn't end in
  `_test` and applies migrations via `prisma migrate deploy` on each run.
  The real database is never touched.
