# Handy Commands — Precast App

Quick reference for local development. Run all commands from `C:\Projects\precastapp`.

## Daily workflow

```powershell
# Terminal 1 — start local Postgres (runs in background after first start)
npx prisma dev

# Terminal 2 — app
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

## Prisma Dev (local Postgres)

| Command | Purpose |
|---------|---------|
| `npx prisma dev` | Start local Postgres (skipped if already running) |
| `npx prisma dev ls` | List servers, status, and **connection URLs** |
| `npx prisma dev stop default` | Stop the `default` dev server |
| `npx prisma dev start default` | Start a stopped server |

After `npx prisma dev` or `npx prisma dev ls`, copy the **TCP** / `postgres://...` URL into `.env`:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&..."
```

Use the port from **your** output (often `51214`).

---

## Schema & migrations

**Do not use `npx prisma db push`** in this project.

| Command | Purpose |
|---------|---------|
| `npx prisma migrate dev --name <name>` | Apply schema changes via migration |
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
| `npx prisma studio` | Web UI for tables (requires dev server running) |

---

## Troubleshooting

### `P1001` — Can't reach database server

Postgres is not running or `.env` has a stale port.

```powershell
npx prisma dev ls
# If not running:
npx prisma dev
# Update .env DATABASE_URL from ls output, then retry
```

### `Skipped!` when running `npx prisma dev`

The server is **already running** in the background. Use `npx prisma dev ls`.

### `P1017` during `migrate dev`

Shadow DB issue with local Prisma Postgres. Restart and retry:

```powershell
npx prisma dev stop default
npx prisma dev
npx prisma dev ls
# Update .env if port changed
npx prisma migrate dev --name <name>
```

### Prisma Studio — "Could not load schema metadata"

1. `npx prisma dev ls` — confirm server is **running**
2. Update `.env` with current `DATABASE_URL`
3. `npx prisma studio`

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
