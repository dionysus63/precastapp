# Precast Ops

Internal business app for quoting, jobs, inventory, and production — Next.js, Prisma, PostgreSQL, and Windows job-folder integration.

## Local development

See **[COMMANDS.md](COMMANDS.md)** for daily workflow (`npm run dev`, Prisma, troubleshooting).

```powershell
npm run dev
```

Open **http://localhost:3000**

### Desktop shell (optional)

With the dev server running:

```powershell
npm run electron:dev
```

## Office deployment

This app runs on a **Windows server on your LAN** with PostgreSQL and UNC job folders. Staff use a **Precast Ops desktop app** (Electron thin client) — not a browser bookmark.

**Full guide:** **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

| Step | Script / doc |
|------|----------------|
| Fill in server details | [docs/deployment-server-info.md](docs/deployment-server-info.md) |
| Check prerequisites | `.\scripts\deploy\install-prerequisites.ps1` |
| Verify UNC access | `.\scripts\deploy\verify-unc-access.ps1` |
| Build & migrate server | `.\scripts\deploy\deploy-app.ps1` |
| Smoke test server | `.\scripts\deploy\start-production.ps1` |
| Windows service | `.\scripts\deploy\install-windows-service.ps1` |
| Build desktop installer | `.\scripts\deploy\build-electron-client.ps1` |
| Staff rollout | [docs/office-rollout.md](docs/office-rollout.md) |

Copy [`.env.example`](.env.example) to `.env` on the server before deploying.

## Project docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Auth, security, database rules |
| [COMMANDS.md](COMMANDS.md) | Dev commands |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production office deploy |
