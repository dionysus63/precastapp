<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Security posture: internal, trusted-network tool

This app runs on a trusted internal LAN/VPN for a small office. It is **not**
intended for public internet exposure.

## Authentication today

- **Username-only sign-in** at `/login` (pick your account; no password yet)
- **Database-backed sessions** (8-hour idle timeout, httpOnly cookie)
- **Role-based permissions** with per-user grant/deny overrides
- **Admin user management** at Settings → Users & Access (`USERS_MANAGE`)

Password login is planned: the `User` model already has nullable `passwordHash`
and `mustChangePassword` fields for a future upgrade.

## Authorization

- Sidebar and routes are filtered by effective permissions
- Server actions call `requirePermission(...)` before mutations
- Sensitive disk operations require `FILES_MANAGE`

Do not deploy this app to a publicly reachable host without adding password
authentication and reviewing permission boundaries first.

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
