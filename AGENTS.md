<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Codebase exploration: use graphify first

This project has a graphify knowledge graph at `graphify-out/`. graphify is a
global CLI (`graphify`, on PATH) shared across editors — it is not Cursor-specific.

**Before using Read, Grep, Glob, or Bash to explore the codebase, run graphify first:**

- `graphify query "<question>"` — scoped subgraph for any codebase or architecture question
- `graphify path "<A>" "<B>"` — dependency path between two symbols
- `graphify explain "<concept>"` — all nodes related to a concept

This applies to you and to every subagent you spawn. Include this rule explicitly
in every subagent prompt that involves code exploration. Do not skip graphify
because files are "already known" or because you are executing a plan — the graph
surfaces cross-file and INFERRED edges that grep and Read cannot find.

Only use Read/Grep/Glob directly when:

1. graphify has already oriented you and you need to modify or debug specific lines
2. `graphify-out/graph.json` does not exist yet

- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review when
  query/path/explain do not surface enough context
- After modifying code files, run `graphify update .` to keep the graph current
  (AST-only, no API cost)

# Security posture: internal, trusted-network tool

This app runs on a trusted internal LAN/VPN for a small office. It is **not**
intended for public internet exposure.

## Authentication today

- **Two-step password sign-in** at `/login`: pick your account, then enter
  your password (`signInWithPassword` in `app/login/actions.ts`)
- **First sign-in sets the password**: accounts without a `passwordHash`
  create one at login (min 8 chars, scrypt-hashed — `lib/auth/password.ts`);
  `mustChangePassword` forces a reset on next sign-in
- **Database-backed sessions** (8-hour sliding expiry, httpOnly cookie; set
  `SESSION_COOKIE_SECURE=true` when serving over HTTPS)
- **Role-based permissions** with per-user grant/deny overrides
- **Admin user management** at Settings → Users & Access (`USERS_MANAGE`)

## Authorization

- Sidebar and routes are filtered by effective permissions
- Server actions call `requirePermission(...)` before mutations
- Sensitive disk operations require `FILES_MANAGE`

Do not deploy this app to a publicly reachable host without serving over
HTTPS (with `SESSION_COOKIE_SECURE=true`), reviewing permission boundaries,
and hardening beyond the office-LAN assumptions (rate limiting, password
strength, audit review).

# Project context

This is a local business app for a precast company using Next.js, Prisma,
and PostgreSQL.

## Prisma / Database Rules

Local development uses **installed PostgreSQL 18** on `localhost:5432`,
database `precastapp`. Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/precastapp"
```

The Windows service `postgresql-x64-18` must be running. No `npx prisma dev`
is required for daily work.

Never use:

```bash
npx prisma db push
```

Use migrations instead:

```bash
npx prisma migrate dev --name <descriptive_name>
npx prisma generate
```

Other commands:

- `npx prisma migrate status` — verify connectivity and migration state
- `npx prisma studio` — browse data (requires PostgreSQL running)
- `npx prisma generate` — regenerate client after schema changes

Full command reference: **[COMMANDS.md](COMMANDS.md)**
