# Handy Commands — Precast App

Quick reference for local development. Run all commands from `C:\Projects\precastapp`.

## Daily workflow

```powershell
# PostgreSQL 18 runs as a Windows service (postgresql-x64-18) — no extra DB startup needed
npm run dev
```

Open **http://localhost:3000**

---

## App (Next.js)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (`predev` runs `prisma generate` first) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |

---

## PostgreSQL (installed)

Local development uses **PostgreSQL 18** on `localhost:5432`, database `precastapp`.

| Check | Command |
|-------|---------|
| Service running | `Get-Service postgresql-x64-18` |
| Connect (psql) | `"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d precastapp` |

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

| Command | Purpose |
|---------|---------|
| `npx prisma migrate dev --name <name>` | Apply schema changes via migration |
| `npx prisma migrate deploy` | Apply pending migrations (e.g. fresh DB) |
| `npx prisma generate` | Regenerate Prisma client (`app/generated/prisma`) |
| `npx prisma validate` | Check `schema.prisma` |
| `npx prisma migrate status` | See pending/applied migrations |

Example after editing `prisma/schema.prisma`:

```powershell
npx prisma migrate dev --name add_quote_models
npx prisma generate
```

---

## Browse data

| Command | Purpose |
|---------|---------|
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

---

## Useful URLs

| URL | Page |
|-----|------|
| http://localhost:3000 | Dashboard |
| http://localhost:3000/customers | Customers |
| http://localhost:3000/jobs | Jobs |
| http://localhost:3000/products | Products |
| http://localhost:3000/quotes | Quotes |
| http://localhost:3000/quotes/new | New quote |
| http://localhost:5555 | Prisma Studio (default port; check terminal output) |

---

## Git / GitHub (optional)

| Command | Purpose |
|---------|---------|
| `git status` | Working tree status |
| `git diff` | View changes |
| `gh pr create` | Create pull request (requires `gh` CLI) |

---

## Project paths

| Path | What |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `prisma/migrations/` | Migration SQL |
| `app/generated/prisma/` | Generated Prisma client (do not edit) |
| `.env` | `DATABASE_URL` and secrets (not committed) |
| `AGENTS.md` | Rules for AI agents working in this repo |
