<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Security posture: internal, trusted-network tool only

This app has **no authentication or authorization layer** — there is no
`middleware.ts`, no session/user model, and no per-action access checks.
Every Server Action (creating/editing/deleting customers, jobs, and
products, and opening job folders on the host machine) is reachable by
anyone who can reach the running server.

This is intentional: the app is designed to run only on a trusted internal
LAN/VPN for a small office, not to be exposed on the open internet. Do not
add features that assume any form of access control exists today, and do
not deploy this app to a publicly reachable host without first adding a
real authentication layer.

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
