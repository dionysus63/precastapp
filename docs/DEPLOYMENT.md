# Office deployment — single Windows server + UNC job folders

Deploy Precast Ops on **one Windows machine** for the whole office: Next.js, PostgreSQL 18, and access to your existing job-folder UNC share. Staff use a **Precast Ops desktop app** (thin Electron client) on each PC — not a browser bookmark.

**Before you start:** fill out [deployment-server-info.md](deployment-server-info.md).

For day-to-day dev commands see [COMMANDS.md](../COMMANDS.md).

---

## Architecture

```mermaid
flowchart LR
  subgraph clients [Staff PCs]
    E1[Electron app]
    E2[Electron app]
  end
  subgraph server [Windows App Server]
    Next[Next.js port 3000]
    PG[(PostgreSQL 18)]
    Chrome[Brave or Chrome]
  end
  subgraph storage [File share]
    UNC["\\\\SERVER\\Jobs"]
  end
  E1 -->|"http://precast-srv:3000"| Next
  E2 --> Next
  Next --> PG
  Next --> UNC
  Next --> Chrome
```

### Important behavior

- **Desktop UI** — staff use the **Precast Ops** Electron app on their PCs; it loads the server over HTTP on your LAN.
- **Job files** — stored on your UNC share; paths configured in Settings → Files & Folders.
- **PDF generation** — headless Brave/Chrome on the **server** ([`lib/quote-pdf.ts`](../lib/quote-pdf.ts)).
- **“Open in Explorer”** — opens a window on the **server**, not the user’s desk ([`lib/windows-explorer.ts`](../lib/windows-explorer.ts)). Staff should use the in-app Files browser or map the same UNC drive locally.
- **Authentication** — username-only on LAN today; do not expose to the public internet without password login ([`AGENTS.md`](../AGENTS.md)).
- **Electron-only rollout** — distribute the desktop installer; do not give staff browser shortcuts. LAN firewall restricts who can reach port 3000.

---

## Quick start (scripted)

Run PowerShell **as Administrator** on the server from the repo root after cloning to `C:\Apps\precastapp`:

```powershell
# 1. Check prerequisites (Node, PostgreSQL, Git, browser)
.\scripts\deploy\install-prerequisites.ps1

# 2. Verify service account can write to UNC paths
.\scripts\deploy\verify-unc-access.ps1 -JobsRoot "\\FILESERVER\PrecastJobs" -StockSubmittalsRoot "\\FILESERVER\StockSubmittals"

# 3. Copy .env.example to .env, edit DATABASE_URL, then deploy
Copy-Item .env.example .env
# ... edit .env ...
.\scripts\deploy\deploy-app.ps1

# 4. Smoke test (manual)
.\scripts\deploy\start-production.ps1

# 5. Install Windows service + firewall (after smoke test passes)
.\scripts\deploy\configure-firewall.ps1 -Subnet "192.168.1.0/24"
.\scripts\deploy\install-windows-service.ps1 -ServiceAccount "DOMAIN\svc-precastapp"

# 6. Build Electron installer (on dev machine or server — not each desk PC)
.\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://precast-srv:3000"
```

Then complete **Phase 4** (app settings) in the desktop app and **Phase 7** (office rollout) below.

---

## Phase 1 — Prepare the Windows server

### Install prerequisites

| Software | Notes |
|----------|-------|
| Node.js 20 LTS or 22 LTS | [nodejs.org](https://nodejs.org) |
| Git for Windows | Clone/pull updates |
| PostgreSQL 18 | Service `postgresql-x64-18`; see [COMMANDS.md](../COMMANDS.md) |
| Brave or Google Chrome | Quote/drill-sheet PDFs |

Or run:

```powershell
.\scripts\deploy\install-prerequisites.ps1
```

### Service account

Create a dedicated account (e.g. `svc-precastapp`):

1. Grant **Log on as a service** (Local Security Policy → User Rights Assignment).
2. Grant **read/write** on the jobs UNC and stock submittals UNC (share + NTFS).
3. Verify:

```powershell
.\scripts\deploy\verify-unc-access.ps1 `
  -JobsRoot "\\FILESERVER\PrecastJobs" `
  -StockSubmittalsRoot "\\FILESERVER\StockSubmittals"
```

Run as the service account, or pass `-Credential` to the script.

### Firewall

Allow inbound TCP **3000** from your office subnet only:

```powershell
.\scripts\deploy\configure-firewall.ps1 -Subnet "192.168.1.0/24"
```

---

## Phase 2 — PostgreSQL

```powershell
Get-Service postgresql-x64-18

# Create database (once)
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d postgres -c "CREATE DATABASE precastapp;"
```

Optional: create a dedicated `precastapp` DB user instead of using `postgres`.

---

## Phase 3 — Deploy the application

1. Clone to a fixed path:

```powershell
git clone <your-repo-url> C:\Apps\precastapp
cd C:\Apps\precastapp
```

2. Create `.env` from [`.env.example`](../.env.example):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/precastapp"
NODE_ENV=production
# LAN HTTP — do not set SESSION_COOKIE_SECURE=true unless you add HTTPS
SESSION_COOKIE_SECURE=false
SETTINGS_RESET_PASSWORD=your-long-random-secret

# Optional — Send Quote via Office 365 SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=quotes@yourcompany.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=quotes@yourcompany.com
```

The mailbox used for `SMTP_USER` must have **SMTP AUTH** enabled in Microsoft 365. If MFA is on, create an **app password** and use that for `SMTP_PASSWORD`. `SMTP_FROM` must be the authenticated mailbox (or one it has Send As rights to).

3. Build and migrate:

```powershell
.\scripts\deploy\deploy-app.ps1
```

Or manually:

```powershell
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
```

4. **Seed or restore data**

Fresh office start:

```powershell
npm run db:seed
```

Copy from dev machine (on dev):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d precastapp -Fc -f precastapp.dump
```

On server (after `migrate deploy`):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -U postgres -d precastapp --clean --if-exists precastapp.dump
```

5. Smoke test:

```powershell
.\scripts\deploy\start-production.ps1
```

From another PC: open `http://SERVERNAME:3000` in a browser **once** to confirm the server is reachable (admin smoke test only — staff use the Electron app).

---

## Phase 4 — Configure paths and company settings

In the Precast Ops desktop app or a one-time browser session (admin user):

1. **Settings → Files & Folders**
   - Jobs root: your UNC (e.g. `\\FILESERVER\PrecastJobs`)
   - Stock submittals root
   - Quote PDF fallback directory (local on server if needed)
   - Click **Test write access** for each path

2. **Settings → Company / System** — logo, tax rate, estimators, trucks, etc.

3. **Settings → Users & Access** — add all staff with roles/permissions.

4. Optional — sync existing job folders into the file index:

```powershell
npm run db:sync-files
```

---

## Phase 5 — Windows service (24/7)

Uses [NSSM](https://nssm.cc/) to run `scripts/deploy/start-production.ps1` as a service.

1. Download NSSM or `winget install NSSM` if available.
2. Install the service:

```powershell
.\scripts\deploy\install-windows-service.ps1 `
  -AppRoot "C:\Apps\precastapp" `
  -ServiceAccount "DOMAIN\svc-precastapp" `
  -Port 3000
```

3. Service name: `PrecastApp` — set to **Automatic** start.

### Updates

```powershell
Stop-Service PrecastApp
cd C:\Apps\precastapp
git pull
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
Start-Service PrecastApp
```

Or:

```powershell
.\scripts\deploy\deploy-app.ps1 -SkipSeed
Restart-Service PrecastApp
```

---

## Phase 6 — Electron client (staff PCs)

The Electron app is a thin shell ([`electron/main.mjs`](../electron/main.mjs)) that loads your server URL. It does **not** bundle Next.js, PostgreSQL, or Puppeteer.

### Build the installer

On a machine with Node.js (your dev PC or the app server):

```powershell
cd C:\Apps\precastapp
.\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://precast-srv:3000"
```

Output: `dist/electron/Precast Ops Setup x.x.x.exe`

The server URL is baked into `electron/config.default.json` at build time. Staff can override it later via:

`%APPDATA%\Precast Ops\config.json`

```json
{ "serverUrl": "http://precast-srv:3000" }
```

### Install on each desk PC

1. Copy the installer from `dist/electron/` to a share, USB, or RMM deploy.
2. Run **Precast Ops Setup.exe** on each staff PC.
3. Silent install (optional): `Precast Ops Setup.exe /S`
4. Pin **Precast Ops** to the Start menu / taskbar.
5. Launch the app → sign in at `/login`.

### Local development with Electron

```powershell
# Terminal 1 — server
npm run dev

# Terminal 2 — desktop shell (defaults to http://localhost:3000)
npm run electron:dev
```

Override dev URL: `$env:PRECAST_SERVER_URL="http://localhost:3000"; npm run electron:dev`

### Client updates (auto-update from server)

Three machines are involved — keep them separate:

| Machine | Role | Repo path | IP / name (yours) |
|---------|------|-----------|-------------------|
| **Dev PC** | Write code, build installers, `git push` | `C:\Projects\precastapp` | Your desk PC |
| **Server** | Runs the app 24/7, hosts update files | `C:\Apps\precastapp` | `LIP-TITAN` / `192.168.1.20` |
| **Staff PCs** | Run Precast Ops desktop app only | *(no repo)* | Office workstations |

After the **first manual install** on each staff PC, desktop updates come from the **server** at `http://192.168.1.20:3000/updates/`. Clients check ~15 seconds after launch and every 4 hours.

---

#### A. Server app updates (quotes, jobs, UI — most changes)

**On the server only** — staff PCs need nothing:

```powershell
Stop-Service PrecastApp
cd C:\Apps\precastapp
git pull
.\scripts\deploy\deploy-app.ps1 -SkipInstall
Start-Service PrecastApp
```

Code reaches the server via **GitHub/GitLab**: you `git push` from the dev PC, then `git pull` on the server.

---

#### B. Desktop shell updates (Electron auto-update)

**Build on the dev PC.** **Host the files on the server.** Staff PCs update themselves.

**Step 1 — Dev PC:** commit/push your changes, then bump `version` in [`electron/package.json`](../electron/package.json) (e.g. `0.1.0` → `0.1.1`).

**Step 2 — Dev PC:** build and copy update files to the server over the network:

```powershell
cd C:\Projects\precastapp
git pull
.\scripts\deploy\publish-electron-update.ps1 `
  -ServerUrl "http://192.168.1.20:3000" `
  -CopyTo "\\LIP-TITAN\C$\Apps\precastapp\public\updates"
```

Use the server hostname or `\\192.168.1.20\C$\Apps\precastapp\public\updates` if the share path works better. You need write access to that folder (admin share or a file share you create).

**Step 3 — Server (once, first time only):** ensure the updates folder exists:

```powershell
New-Item -ItemType Directory -Path C:\Apps\precastapp\public\updates -Force
```

Also `git pull` on the server so middleware allows `/updates` without login (if you haven’t already).

**Step 4 — Any PC:** verify the feed is live:

```powershell
Invoke-WebRequest "http://192.168.1.20:3000/updates/latest.yml"
```

**Step 5 — Staff PCs:** they see “Update ready — Restart now” on the next check. No manual reinstall.

**First install on each staff PC** is still manual (USB, share, or copy `dist\electron\Precast Ops Setup x.x.x.exe` from the dev PC after the build step).

---

#### C. Server URL change only

Edit `%APPDATA%\Precast Ops\config.json` on each staff PC, or publish a new desktop build from the dev PC with the new `-ServerUrl`.

See [`public/updates/README.md`](../public/updates/README.md).

---

## Phase 7 — Office rollout

See [office-rollout.md](office-rollout.md) for staff communication, desktop app install, and backup scheduling.

Summary:

1. Stable server URL baked into the Electron installer (e.g. `http://precast-srv:3000`).
2. Install **Precast Ops** desktop app on every staff PC — no browser bookmarks.
3. Explain **Explorer opens on server** — use in-app Files or mapped UNC drives.
4. Schedule DB backups:

```powershell
# Example manual backup
.\scripts\deploy\backup-database.ps1 -OutputDir "D:\Backups\precastapp"
```

Register a Windows Scheduled Task to run that script nightly.

---

## Ongoing maintenance

| Task | Where | Action |
|------|-------|--------|
| Server app updates | **Server** | `git pull` → `deploy-app.ps1` → restart `PrecastApp` |
| Push code to server | **Dev PC** then **Server** | Dev: `git push` → Server: `git pull` |
| Desktop shell updates | **Dev PC** → **Server** | Dev: bump `electron/package.json` version → `publish-electron-update.ps1 -CopyTo \\SERVER\...` → Staff restart when prompted |
| Server URL change only | **Staff PCs** | Edit `%APPDATA%\Precast Ops\config.json` |
| Schema changes | **Server** | `npx prisma migrate deploy` + `npx prisma generate` (via `deploy-app.ps1`) |
| Database backup | **Server** | `backup-database.ps1` on a schedule |
| Job files | File share | Existing share backup policy |
| Re-index files | **Server** | `npm run db:sync-files` after bulk moves |

---

## Security checklist (internal LAN)

- App **not** reachable from the public internet
- Firewall limited to office subnet
- Plan password login before broad VPN exposure
- Strong `SETTINGS_RESET_PASSWORD` if data reset is enabled
- App runs under least-privilege service account with share access only

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `P1001` can't reach database | Start `postgresql-x64-18`; check `DATABASE_URL` |
| PDF — no browser found | Install Brave/Chrome or `npm run puppeteer:install` |
| Cannot write to jobs root | Fix UNC permissions for service account; test in Settings |
| Port 3000 unreachable | Firewall rule; service running; `Get-Service PrecastApp` |
| Electron — cannot connect | Server running; correct URL in installer or `%APPDATA%\Precast Ops\config.json`; on office LAN/VPN |
| Session cookie issues over HTTP | Leave `SESSION_COOKIE_SECURE` unset or `false` for LAN HTTP; set `true` only behind HTTPS. Restart app after `.env` change. |

---

## End-to-end smoke test

Use this checklist before wide office rollout:

1. **Server** — `PrecastApp` service running; `http://SERVERNAME:3000/login` loads from a test PC (browser OK for this step only).
2. **Build client** — `.\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://SERVERNAME:3000"`.
3. **Install on second PC** — run the NSIS installer from `dist/electron/`.
4. **Login via Electron** — open Precast Ops → pick user → dashboard loads.
5. **Settings** — Files & Folders → test write on jobs root and stock submittals.
6. **PDF** — generate a quote PDF; confirm file on UNC share.
7. **Reboot server** — confirm `PrecastApp` starts automatically; Electron still connects.

See also [COMMANDS.md](../COMMANDS.md).
